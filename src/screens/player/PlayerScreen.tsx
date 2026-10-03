import BlurredBackground from '@/components/layouts/BlurredBackground';
import PlayerSpotlightTutorial from '@/components/modals/PlayerSpotlightTutorial';
import { useTagFormStore } from '@/store/useTagFormStore';
import { openLocalCast, openPlayerMenu, openPlaylistSelector, openQueueSheet, openSleepTimer, openSpeedPitch, openTagManagerForTrack, openTrackMenu, useUIStore } from '@/store/useUIStore';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import MaskedView from '@react-native-masked-view/masked-view';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
    AppState,
    AppStateStatus,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TrackPlayer, {
    RepeatMode,
    State as TrackPlayerState,
    useProgress,
} from 'react-native-track-player';
import { extractColorFromImage, NativeVisualizer } from '../../../modules/native-equalizer';
import { usePlaybackState } from '../../hooks/usePlaybackState';

import { database } from '../../database';
import Album from '../../database/models/Album';
import Artist from '../../database/models/Artist';
import Tag from '../../database/models/Tag';
import { useCastStore } from '../../store/useCastStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useSleepTimerStore } from '../../store/useSleepTimerStore';

import { ABSliderMarkers } from '@/components/common/ABSliderMarkers';
import MarqueeText from '@/components/common/MarqueeText';
import PlayPauseButton from '@/components/common/PlayPauseButton';
import { ABRepeatIcon } from '@/components/player/ABRepeatIcon';
import { useAppTheme } from "@/hooks/useAppTheme";
import withObservables from '@nozbe/with-observables';
import { useTranslation } from 'react-i18next';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import Track from '../../database/models/Track';
import { useSyncedLyrics } from '../../hooks/useSyncedLyrics';
import { useABRepeatStore } from '../../store/useABRepeatStore';
import { useArtistsListSheetStore } from '../../store/useArtistsListSheetStore';
import { useToastStore } from '../../store/useToastStore';
import { getDynamicTagTextColor } from '../../utils/color';
import { formatTrackTime } from '../../utils/time';

const { width } = Dimensions.get('window');

const SKIP_PREVIOUS_THRESHOLD = 3;

// --- UI DEL REPRODUCTOR (SINCRONIZADA) ---
interface PlayerScreenUIProps {
    track: Track;
    album: Album | null;
    artist: Artist | null;
    artists: Artist[];
    tags: Tag[];
    navigation: any;
    formatTimestamp: (s: number) => string;
    hasNext: boolean;
    hasPrevious: boolean;
    isFocused: boolean;
}

// Helper functions for hex color conversions and dark background/gradient generation
const hexToHsl = (hex: string): { h: number, s: number, l: number } => {
    let r = 0, g = 0, b = 0;
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) {
        r = Number.parseInt(hex[0] + hex[0], 16);
        g = Number.parseInt(hex[1] + hex[1], 16);
        b = Number.parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
        r = Number.parseInt(hex.substring(0, 2), 16);
        g = Number.parseInt(hex.substring(2, 4), 16);
        b = Number.parseInt(hex.substring(4, 6), 16);
    }
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
};

const hslToHex = (h: number, s: number, l: number): string => {
    s /= 100;
    l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
        const y = Math.min(Math.max(Math.min(k(n) - 3, 9 - k(n)), -1), 1);
        return Math.round(255 * (l - a * y)).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
};

const generateDarkGradients = (extractedHex: string, defaultBg: string) => {
    try {
        const hsl = hexToHsl(extractedHex);
        const baseColor = hslToHex(hsl.h, 30, 10);
        const topColor = hslToHex(hsl.h, 35, 20);
        return {
            backgroundSolid: baseColor,
            topGradient: topColor,
            bottomGradient: baseColor
        };
    } catch {
        return {
            backgroundSolid: defaultBg,
            topGradient: '#121212',
            bottomGradient: defaultBg
        };
    }
};

const CanvasVideo = React.memo(({
    sourceUri,
    isImmersive,
    gradientColors
}: {
    sourceUri: string;
    isImmersive: boolean;
    gradientColors: string[];
}) => {
    // El vídeo Canvas se reproduce en bucle y mudo de forma inmediata
    const player = useVideoPlayer(sourceUri, (playerInstance) => {
        playerInstance.loop = true;
        playerInstance.muted = true;
        playerInstance.play();
    });

    useEffect(() => {
        if (player) {
            player.play();
        }
    }, [player, sourceUri]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active' && player) {
                player.play();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [player]);

    const blurOpacity = useSharedValue(isImmersive ? 0 : 1);
    const immersiveGradientOpacity = useSharedValue(isImmersive ? 1 : 0);

    useEffect(() => {
        blurOpacity.value = withTiming(isImmersive ? 0 : 1, { duration: 350, easing: Easing.bezier(0.25, 0.1, 0.25, 1.0) });
        immersiveGradientOpacity.value = withTiming(isImmersive ? 1 : 0, { duration: 350, easing: Easing.bezier(0.25, 0.1, 0.25, 1.0) });
    }, [isImmersive, blurOpacity, immersiveGradientOpacity]);

    const blurAnimatedStyle = useAnimatedStyle(() => ({
        opacity: blurOpacity.value,
    }));

    const normalGradientAnimatedStyle = useAnimatedStyle(() => ({
        opacity: 1 - immersiveGradientOpacity.value,
    }));

    const immersiveGradientAnimatedStyle = useAnimatedStyle(() => ({
        opacity: immersiveGradientOpacity.value,
    }));

    return (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <VideoView
                key={sourceUri}
                player={player}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
                nativeControls={false}
                allowsFullscreen={false}
                surfaceType="textureView"
            />
            <Animated.View style={[StyleSheet.absoluteFillObject, blurAnimatedStyle]}>
                <BlurView
                    intensity={20}
                    tint="dark"
                    style={StyleSheet.absoluteFillObject}
                />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFillObject, normalGradientAnimatedStyle]}>
                <LinearGradient
                    colors={gradientColors as any}
                    style={StyleSheet.absoluteFillObject}
                />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFillObject, immersiveGradientAnimatedStyle]}>
                <LinearGradient
                    colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.78)'] as any}
                    style={StyleSheet.absoluteFillObject}
                />
            </Animated.View>
        </View>
    );
});
CanvasVideo.displayName = 'CanvasVideo';

interface PlayerArtworkProps {
    coverUrl?: string | null;
    size: number;
    borderRadius?: number;
    shadowStyle?: any;
    cardBackgroundColor: string;
    textSecondaryColor: string;
}

const PlayerArtwork = ({
    coverUrl,
    size,
    borderRadius = 10,
    shadowStyle,
    cardBackgroundColor,
    textSecondaryColor,
}: PlayerArtworkProps) => {
    const [hasError, setHasError] = useState(false);
    const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

    // Mirror BlurredBackground: keep lastValidUriRef so null intermediates
    // (during track change while observable resolves) never flash a placeholder.
    const lastValidUriRef = useRef<string | null>(coverUrl || null);

    useEffect(() => {
        setHasError(false);
        if (coverUrl) {
            lastValidUriRef.current = coverUrl;
        } else {
            // If coverUrl stays null (genuine no-cover track), clear previous image after short grace period
            const timer = setTimeout(() => {
                lastValidUriRef.current = null;
                forceUpdate();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [coverUrl]);

    if (coverUrl) {
        lastValidUriRef.current = coverUrl;
    }
    const effectiveUri = coverUrl || lastValidUriRef.current;
    const showPlaceholder = !effectiveUri || hasError;

    const imageSource = useMemo(
        () => (effectiveUri ? { uri: effectiveUri } : null),
        [effectiveUri]
    );

    return (
        <View
            style={[
                {
                    width: size,
                    height: size,
                    borderRadius,
                    overflow: 'hidden',
                    backgroundColor: cardBackgroundColor,
                },
                shadowStyle,
            ]}
        >
            {showPlaceholder ? (
                <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: cardBackgroundColor }]}>
                    <Ionicons
                        name="musical-notes"
                        size={Math.min(80, Math.floor(size * 0.25))}
                        color={textSecondaryColor}
                    />
                </View>
            ) : (
                <Image
                    source={imageSource}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={250}
                    cachePolicy="memory-disk"
                    onError={() => setHasError(true)}
                />
            )}
        </View>
    );
};
PlayerArtwork.displayName = 'PlayerArtwork';



// --- HELPER HOOKS & SUBCOMPONENTS FOR PLAYERSCREEN ---

const getCleanTrackModel = async (item?: { id?: any }): Promise<Track | null> => {
    if (!item?.id) return null;
    const cleanId = item.id.toString().split('-')[0];
    return database.get<Track>('tracks').find(cleanId).catch(() => null);
};

const fetchAlbumCover = (
    model: Track | null,
    onSuccess: (url: string | null) => void
) => {
    if (!model) {
        onSuccess(null);
        return;
    }
    model.album.fetch()
        .then((alb: any) => onSuccess(alb?.coverUrl || null))
        .catch(() => onSuccess(null));
};

const resolveAdjacentTrackPair = async (queue: any[], activeIndex: number | null | undefined) => {
    if (activeIndex === undefined || activeIndex === null || queue.length === 0) {
        return { prevM: null, nextM: null, prevArtwork: null, nextArtwork: null };
    }
    const repeatMode = await TrackPlayer.getRepeatMode().catch(() => RepeatMode.Off);
    const isLooping = repeatMode !== RepeatMode.Off;

    let prevItem = activeIndex > 0 ? queue[activeIndex - 1] : null;
    let nextItem = activeIndex < queue.length - 1 ? queue[activeIndex + 1] : null;

    if (isLooping && queue.length > 1) {
        if (!prevItem) prevItem = queue.at(-1);
        if (!nextItem) nextItem = queue[0];
    }

    const prevM = prevItem ? await getCleanTrackModel(prevItem) : null;
    const nextM = nextItem ? await getCleanTrackModel(nextItem) : null;
    const prevArtwork = (prevItem?.artwork as string) || null;
    const nextArtwork = (nextItem?.artwork as string) || null;

    return { prevM, nextM, prevArtwork, nextArtwork };
};

const useAdjacentTracks = (trackId: string, queueVersion: number, windowVersion: number) => {
    const [prevTrackModel, setPrevTrackModel] = useState<Track | null>(() => usePlayerStore.getState().prevTrack);
    const [nextTrackModel, setNextTrackModel] = useState<Track | null>(() => usePlayerStore.getState().nextTrack);
    const [prevCoverUrl, setPrevCoverUrl] = useState<string | null>(null);
    const [nextCoverUrl, setNextCoverUrl] = useState<string | null>(null);

    const nextTrackModelRef = React.useRef(nextTrackModel);
    const nextCoverUrlRef = React.useRef(nextCoverUrl);
    const prevTrackModelRef = React.useRef(prevTrackModel);
    const prevCoverUrlRef = React.useRef(prevCoverUrl);

    useEffect(() => {
        let isMounted = true;
        const syncAdjacent = async () => {
            try {
                const queue = await TrackPlayer.getQueue();
                const activeIndex = await TrackPlayer.getActiveTrackIndex();
                const { prevM, nextM, prevArtwork, nextArtwork } = await resolveAdjacentTrackPair(queue, activeIndex);
                if (isMounted) {
                    setPrevTrackModel(prevM);
                    setNextTrackModel(nextM);
                    if (prevArtwork) {
                        setPrevCoverUrl(prevArtwork);
                        getOrExtractColor(prevArtwork).catch(() => {});
                    }
                    if (nextArtwork) {
                        setNextCoverUrl(nextArtwork);
                        getOrExtractColor(nextArtwork).catch(() => {});
                    }
                }
            } catch (e) {
                console.error("Error sincronizando canciones adyacentes en PlayerScreen:", e);
            }
        };

        void syncAdjacent();
        return () => { isMounted = false; };
    }, [trackId, queueVersion, windowVersion]);

    useEffect(() => {
        let isMounted = true;
        fetchAlbumCover(prevTrackModel, (url) => {
            if (isMounted && url) {
                setPrevCoverUrl(url);
                getOrExtractColor(url).catch(() => {});
            }
        });
        return () => { isMounted = false; };
    }, [prevTrackModel]);

    useEffect(() => {
        let isMounted = true;
        fetchAlbumCover(nextTrackModel, (url) => {
            if (isMounted && url) {
                setNextCoverUrl(url);
                getOrExtractColor(url).catch(() => {});
            }
        });
        return () => { isMounted = false; };
    }, [nextTrackModel]);

    useEffect(() => {
        nextTrackModelRef.current = nextTrackModel;
    }, [nextTrackModel]);

    useEffect(() => {
        nextCoverUrlRef.current = nextCoverUrl;
        if (nextCoverUrl) void Image.prefetch(nextCoverUrl);
    }, [nextCoverUrl]);

    useEffect(() => {
        prevTrackModelRef.current = prevTrackModel;
    }, [prevTrackModel]);

    useEffect(() => {
        prevCoverUrlRef.current = prevCoverUrl;
        if (prevCoverUrl) void Image.prefetch(prevCoverUrl);
    }, [prevCoverUrl]);

    return {
        prevTrackModel,
        nextTrackModel,
        prevCoverUrl,
        nextCoverUrl,
        nextTrackModelRef,
        nextCoverUrlRef,
        prevTrackModelRef,
        prevCoverUrlRef,
    };
};

const resolveAdjacentCoverFallback = (
    trackId: string,
    nextModel: Track | null,
    nextCover: string | null,
    prevModel: Track | null,
    prevCover: string | null
): string | null => {
    if (nextModel?.id === trackId && nextCover) return nextCover;
    if (prevModel?.id === trackId && prevCover) return prevCover;
    return null;
};

const playerCoverColorCache = new Map<string, string>();

const getCleanUrl = (url: string | null): string | null => {
    if (!url) return null;
    return url.split('?')[0];
};

const getCachedCoverColor = (url: string | null, localExtracted?: Record<string, string>): string | null => {
    if (!url) return null;
    const cleanUrl = getCleanUrl(url);

    const memoryColor = playerCoverColorCache.get(url) || (cleanUrl ? playerCoverColorCache.get(cleanUrl) : undefined);
    if (memoryColor) return memoryColor;

    if (localExtracted) {
        const extractedColor = localExtracted[url] || (cleanUrl ? localExtracted[cleanUrl] : undefined);
        if (extractedColor) return extractedColor;
    }

    return null;
};

const getOrExtractColor = async (url: string | null): Promise<string | null> => {
    if (!url) return null;
    const cleanUrl = getCleanUrl(url);
    if (!cleanUrl) return null;

    if (playerCoverColorCache.has(url)) return playerCoverColorCache.get(url)!;
    if (playerCoverColorCache.has(cleanUrl)) {
        const cached = playerCoverColorCache.get(cleanUrl)!;
        playerCoverColorCache.set(url, cached);
        return cached;
    }

    try {
        const color = await extractColorFromImage(cleanUrl);
        if (color) {
            playerCoverColorCache.set(url, color);
            playerCoverColorCache.set(cleanUrl, color);
            return color;
        }
        return null;
    } catch (e) {
        console.error("Error extracting color from image in PlayerScreen:", e);
        return null;
    }
};

const usePlayerCover = (
    track: Track,
    album: Album | null,
    nextTrackModel: Track | null,
    prevTrackModel: Track | null,
    nextCoverUrl: string | null,
    prevCoverUrl: string | null,
    defaultBackground: string
) => {
    const [asyncCoverUrl, setAsyncCoverUrl] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        setAsyncCoverUrl(null);

        const loadCover = async () => {
            try {
                const alb: any = await track.album.fetch();
                if (isMounted && alb?.coverUrl) {
                    setAsyncCoverUrl(alb.coverUrl);
                    return;
                }
            } catch {
                // Ignore album fetch error and proceed to TrackPlayer fallback
            }

            try {
                const tp: any = await TrackPlayer.getActiveTrack();
                if (isMounted && tp?.artwork) {
                    setAsyncCoverUrl(tp.artwork);
                }
            } catch {
                // Ignore active track fetch error
            }
        };

        void loadCover();

        return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [track.id]);

    const rawCoverUrl = album?.coverUrl || asyncCoverUrl || null;
    const initialCover = rawCoverUrl || resolveAdjacentCoverFallback(
        track.id,
        nextTrackModel,
        nextCoverUrl,
        prevTrackModel,
        prevCoverUrl
    );

    const stableCoverRef = React.useRef<{ trackId: string; url: string | null }>({
        trackId: track.id,
        url: initialCover,
    });

    if (stableCoverRef.current.trackId !== track.id) {
        stableCoverRef.current = { trackId: track.id, url: initialCover };
    } else if (!stableCoverRef.current.url && rawCoverUrl) {
        stableCoverRef.current = { ...stableCoverRef.current, url: rawCoverUrl };
    }

    const currentCoverUrl: string | null = stableCoverRef.current.url;

    const [extractedColors, setExtractedColors] = useState<Record<string, string>>({});

    const rawCoverColor = getCachedCoverColor(currentCoverUrl, extractedColors);
    const rawPrevCoverColor = getCachedCoverColor(prevCoverUrl, extractedColors);
    const rawNextCoverColor = getCachedCoverColor(nextCoverUrl, extractedColors);

    // If adjacent track shares cover with current track, immediately reuse coverColor
    const prevCoverColor = rawPrevCoverColor || (
        prevCoverUrl && currentCoverUrl && getCleanUrl(prevCoverUrl) === getCleanUrl(currentCoverUrl)
            ? rawCoverColor
            : null
    );

    const nextCoverColor = rawNextCoverColor || (
        nextCoverUrl && currentCoverUrl && getCleanUrl(nextCoverUrl) === getCleanUrl(currentCoverUrl)
            ? rawCoverColor
            : null
    );

    const coverColor = rawCoverColor;

    useEffect(() => {
        let isMounted = true;
        const urlsToExtract = [currentCoverUrl, prevCoverUrl, nextCoverUrl].filter(
            (url): url is string => Boolean(url && !getCachedCoverColor(url, extractedColors))
        );

        urlsToExtract.forEach(url => {
            void getOrExtractColor(url)
                .then(color => {
                    if (isMounted && color) {
                        setExtractedColors(prev => ({ ...prev, [url]: color }));
                    }
                })
                .catch(() => {
                    // Ignore extraction errors
                });
        });

        return () => {
            isMounted = false;
        };
    }, [currentCoverUrl, prevCoverUrl, nextCoverUrl, extractedColors]);

    const { finalBgColor, topGradientColor, bottomGradientColor } = useMemo(() => {
        if (!coverColor) {
            return {
                finalBgColor: defaultBackground,
                topGradientColor: defaultBackground,
                bottomGradientColor: defaultBackground,
            };
        }
        const grads = generateDarkGradients(coverColor, defaultBackground);
        return {
            finalBgColor: grads.backgroundSolid,
            topGradientColor: grads.topGradient,
            bottomGradientColor: grads.bottomGradient,
        };
    }, [coverColor, defaultBackground]);

    const { prevTopGradientColor, prevBottomGradientColor } = useMemo(() => {
        if (!prevCoverColor) {
            return {
                prevTopGradientColor: defaultBackground,
                prevBottomGradientColor: defaultBackground,
            };
        }
        const grads = generateDarkGradients(prevCoverColor, defaultBackground);
        return {
            prevTopGradientColor: grads.topGradient,
            prevBottomGradientColor: grads.bottomGradient,
        };
    }, [prevCoverColor, defaultBackground]);

    const { nextTopGradientColor, nextBottomGradientColor } = useMemo(() => {
        if (!nextCoverColor) {
            return {
                nextTopGradientColor: defaultBackground,
                nextBottomGradientColor: defaultBackground,
            };
        }
        const grads = generateDarkGradients(nextCoverColor, defaultBackground);
        return {
            nextTopGradientColor: grads.topGradient,
            nextBottomGradientColor: grads.bottomGradient,
        };
    }, [nextCoverColor, defaultBackground]);

    return {
        currentCoverUrl,
        coverColor,
        finalBgColor,
        topGradientColor,
        bottomGradientColor,
        prevCoverColor,
        prevTopGradientColor,
        prevBottomGradientColor,
        nextCoverColor,
        nextTopGradientColor,
        nextBottomGradientColor,
    };
};

const useScreenTransition = (isFocused: boolean, navigation: any) => {
    const [isTransitioning, setIsTransitioning] = useState(false);

    useEffect(() => {
        if (!isFocused) {
            setIsTransitioning(false);
            return;
        }

        setIsTransitioning(true);

        const unsubscribeEnd = navigation?.addListener?.('transitionEnd', () => {
            setIsTransitioning(false);
        });

        const timeout = setTimeout(() => {
            setIsTransitioning(false);
        }, 600);

        return () => {
            unsubscribeEnd?.();
            clearTimeout(timeout);
        };
    }, [isFocused, navigation]);

    return isTransitioning;
};

const useLyricsAnimation = (
    trackId: string,
    hasLyrics: boolean,
    showPlayerLyrics: boolean,
    currentPhrase: string
) => {
    const lyricsHeight = useSharedValue(hasLyrics ? 46 : 0);
    const lyricsOpacity = useSharedValue(hasLyrics ? 1 : 0);

    useEffect(() => {
        lyricsHeight.value = withTiming(hasLyrics ? 46 : 0, { duration: 200 });
        lyricsOpacity.value = withTiming(hasLyrics ? 1 : 0, { duration: 200 });
    }, [hasLyrics, lyricsHeight, lyricsOpacity]);

    const lyricsAnimatedStyle = useAnimatedStyle(() => ({
        height: lyricsHeight.value,
        opacity: lyricsOpacity.value,
    }));

    const [displayedPhrase, setDisplayedPhrase] = useState(currentPhrase);
    const lyricTextOpacity = useSharedValue(hasLyrics && currentPhrase.trim() !== '' ? 1 : 0);
    const prevTrackIdRef = React.useRef(trackId);

    useEffect(() => {
        // Caso 1: Cambio de canción
        if (prevTrackIdRef.current !== trackId) {
            prevTrackIdRef.current = trackId;
            cancelAnimation(lyricTextOpacity);
            setDisplayedPhrase(currentPhrase);
            lyricTextOpacity.value = (hasLyrics && currentPhrase.trim() !== '') ? 1 : 0;
            return;
        }

        // Caso 2: No hay letras o la visualización está desactivada
        if (!hasLyrics || !showPlayerLyrics) {
            cancelAnimation(lyricTextOpacity);
            lyricTextOpacity.value = 0;
            setDisplayedPhrase('');
            return;
        }

        // Caso 3: La frase no ha cambiado
        if (currentPhrase === displayedPhrase) {
            if (displayedPhrase.trim() !== '' && lyricTextOpacity.value < 0.9) {
                lyricTextOpacity.value = withTiming(1, { duration: 150 });
            }
            return;
        }

        // Caso 4: Transición hacia silencio o instrumental (frase vacía)
        if (currentPhrase.trim() === '') {
            lyricTextOpacity.value = withTiming(0, { duration: 150 }, (finished) => {
                if (finished) {
                    scheduleOnRN(setDisplayedPhrase, '');
                }
            });
            return;
        }

        // Caso 5: Transición desde silencio a una nueva frase
        if (displayedPhrase.trim() === '') {
            setDisplayedPhrase(currentPhrase);
            lyricTextOpacity.value = withTiming(1, { duration: 200 });
            return;
        }

        // Caso 6: Transición normal de frase A a frase B
        cancelAnimation(lyricTextOpacity);
        setDisplayedPhrase(currentPhrase);
        lyricTextOpacity.value = 1;
    }, [trackId, showPlayerLyrics, hasLyrics, currentPhrase, displayedPhrase, lyricTextOpacity]);

    const activeLyricText = currentPhrase.trim() !== '' ? currentPhrase : displayedPhrase;

    const textAnimatedStyle = useAnimatedStyle(() => ({
        opacity: lyricTextOpacity.value,
    }));

    return {
        lyricsAnimatedStyle,
        textAnimatedStyle,
        activeLyricText,
    };
};

const usePlayerArtworkSize = (
    measuredArtworkHeight: number,
    windowWidth: number,
    windowHeight: number,
    insets: { top: number; bottom: number },
    hasLyrics: boolean
): number => {
    const baseArtworkSize = windowWidth - 64;
    const nonArtworkSpace = insets.top + insets.bottom + (hasLyrics ? 490 : 430);
    const estimatedAvailableHeight = windowHeight - nonArtworkSpace;

    return useMemo(() => {
        const availableHeight = measuredArtworkHeight > 0
            ? measuredArtworkHeight - 28
            : estimatedAvailableHeight;

        if (availableHeight > 0 && availableHeight < baseArtworkSize) {
            return Math.max(140, Math.floor(availableHeight));
        }
        return baseArtworkSize;
    }, [measuredArtworkHeight, estimatedAvailableHeight, baseArtworkSize]);
};

const useDiscSpinAnimation = (playerCoverStyle: string, isPlaying: boolean) => {
    const spinDeg = useSharedValue(0);

    useEffect(() => {
        if ((playerCoverStyle === 'cd' || playerCoverStyle === 'vinyl') && isPlaying) {
            spinDeg.value = withRepeat(
                withTiming(spinDeg.value + 360, {
                    duration: playerCoverStyle === 'vinyl' ? 2500 : 4000,
                    easing: Easing.linear
                }),
                -1,
                false
            );
        } else {
            cancelAnimation(spinDeg);
        }
    }, [playerCoverStyle, isPlaying, spinDeg]);

    return useAnimatedStyle(() => ({
        transform: [{ rotateZ: `${spinDeg.value}deg` }],
    }));
};

const useImmersiveMode = (
    showCanvas: boolean,
    bgVideo?: string | null,
    insetsBottom: number = 0,
    onImmersiveActive?: () => void
) => {
    const [isImmersive, setIsImmersive] = useState(false);

    const toggleImmersiveMode = useCallback(() => {
        if (showCanvas && !!bgVideo) {
            setIsImmersive(prev => !prev);
        }
    }, [showCanvas, bgVideo]);

    useEffect(() => {
        if (!showCanvas || !bgVideo) {
            setIsImmersive(false);
        }
        if (isImmersive && onImmersiveActive) {
            onImmersiveActive();
        }
    }, [bgVideo, showCanvas, isImmersive, onImmersiveActive]);

    const immersiveProgress = useSharedValue(0);
    useEffect(() => {
        immersiveProgress.value = withTiming(isImmersive ? 1 : 0, {
            duration: 350,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1.0),
        });
    }, [isImmersive, immersiveProgress]);

    const bottomControlsAnimatedStyle = useAnimatedStyle(() => ({
        opacity: 1 - immersiveProgress.value,
        transform: [{ translateY: immersiveProgress.value * 60 }],
        maxHeight: (1 - immersiveProgress.value) * 270,
        overflow: 'hidden',
    }));

    const infoContainerAnimatedStyle = useAnimatedStyle(() => ({
        marginBottom: 8 + immersiveProgress.value * (insetsBottom + 62),
    }));

    return {
        isImmersive,
        setIsImmersive,
        toggleImmersiveMode,
        bottomControlsAnimatedStyle,
        infoContainerAnimatedStyle,
    };
};

interface UsePlayerGesturesParams {
    hasNext: boolean;
    hasPrevious: boolean;
    isSheetOrModalOpen: boolean;
    isFocused: boolean;
    trackId: string;
    isNextBgIdentical: boolean;
    isPrevBgIdentical: boolean;
    onSkipNext: () => Promise<void>;
    onSkipPrevious: () => Promise<void>;
    onDismiss: () => void;
    onLongPress: () => void;
    onTap: () => void;
}

const triggerHaptic = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

const usePlayerGestures = ({
    hasNext,
    hasPrevious,
    isSheetOrModalOpen,
    isFocused,
    trackId,
    isNextBgIdentical,
    isPrevBgIdentical,
    onSkipNext,
    onSkipPrevious,
    onDismiss,
    onLongPress,
    onTap,
}: UsePlayerGesturesParams) => {
    const translateX = useSharedValue(0);
    const hasTriggeredHaptic = useSharedValue(false);
    const lastTrackIdRef = React.useRef<string>(trackId);

    if (lastTrackIdRef.current !== trackId) {
        lastTrackIdRef.current = trackId;
        translateX.value = 0;
    }

    const hasNextShared = useSharedValue(hasNext);
    const hasPreviousShared = useSharedValue(hasPrevious);
    useEffect(() => { hasNextShared.value = hasNext; }, [hasNext, hasNextShared]);
    useEffect(() => { hasPreviousShared.value = hasPrevious; }, [hasPrevious, hasPreviousShared]);

    const performSkipNext = async () => {
        try {
            await onSkipNext();
        } catch {
            translateX.value = withSpring(0, { damping: 25, stiffness: 120 });
        }
    };

    const performSkipPrevious = async () => {
        try {
            await onSkipPrevious();
        } catch {
            translateX.value = withSpring(0, { damping: 25, stiffness: 120 });
        }
    };

    const panGesture = Gesture.Pan()
        .enabled(!isSheetOrModalOpen)
        .activeOffsetX([-10, 10])
        .failOffsetY([-35, 35])
        .onUpdate((event) => {
            let tx = event.translationX;
            if (!hasNextShared.value && tx < 0) tx = 0;
            if (!hasPreviousShared.value && tx > 0) tx = 0;
            translateX.value = tx;

            const isFarEnough = Math.abs(translateX.value) > 100;
            if (isFarEnough && !hasTriggeredHaptic.value) {
                hasTriggeredHaptic.value = true;
                scheduleOnRN(triggerHaptic);
            } else if (!isFarEnough) {
                hasTriggeredHaptic.value = false;
            }
        })
        .onEnd((event) => {
            const SWIPE_THRESHOLD = width * 0.25;
            const velocityX = event.velocityX;

            if ((translateX.value < -SWIPE_THRESHOLD || velocityX < -400) && hasNextShared.value) {
                translateX.value = withTiming(-width, { duration: 220 }, (finished) => {
                    if (finished) scheduleOnRN(performSkipNext);
                });
            } else if ((translateX.value > SWIPE_THRESHOLD || velocityX > 400) && hasPreviousShared.value) {
                translateX.value = withTiming(width, { duration: 220 }, (finished) => {
                    if (finished) scheduleOnRN(performSkipPrevious);
                });
            } else {
                translateX.value = withSpring(0, { damping: 25, stiffness: 120 });
            }
            hasTriggeredHaptic.value = false;
        });

    const longPressGesture = Gesture.LongPress()
        .enabled(!isSheetOrModalOpen)
        .minDuration(450)
        .onStart(() => {
            scheduleOnRN(triggerHaptic);
            scheduleOnRN(onLongPress);
        });

    const tapGesture = Gesture.Tap()
        .enabled(!isSheetOrModalOpen)
        .numberOfTaps(1)
        .onStart(() => {
            scheduleOnRN(onTap);
        });

    const composedGesture = Gesture.Race(
        panGesture,
        Gesture.Exclusive(longPressGesture, tapGesture)
    );

    const screenHeight = Dimensions.get('window').height;
    const dismissTranslateY = useSharedValue(0);

    useEffect(() => {
        if (isFocused || isSheetOrModalOpen) {
            dismissTranslateY.value = 0;
        }
    }, [isFocused, trackId, isSheetOrModalOpen, dismissTranslateY]);

    const dismissPanGesture = Gesture.Pan()
        .enabled(!isSheetOrModalOpen)
        .activeOffsetY(15)
        .failOffsetX([-25, 25])
        .onUpdate((event) => {
            dismissTranslateY.value = Math.max(0, event.translationY);
        })
        .onEnd((event) => {
            const DISMISS_THRESHOLD = screenHeight * 0.18;
            if (event.translationY > DISMISS_THRESHOLD || event.velocityY > 500) {
                dismissTranslateY.value = withTiming(screenHeight, { duration: 200 }, (finished) => {
                    if (finished) scheduleOnRN(onDismiss);
                });
            } else {
                dismissTranslateY.value = withSpring(0, { damping: 25, stiffness: 150 });
            }
        });

    const screenDismissAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: dismissTranslateY.value }],
    }));

    const swipeAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }]
    }));

    const bgSwipeAnimatedStyle = useAnimatedStyle(() => {
        let tx = translateX.value;
        if ((tx < 0 && isNextBgIdentical) || (tx > 0 && isPrevBgIdentical)) {
            tx = 0;
        }
        return {
            transform: [{ translateX: tx }]
        };
    });

    return {
        panGesture,
        dismissPanGesture,
        composedGesture,
        swipeAnimatedStyle,
        screenDismissAnimatedStyle,
        bgSwipeAnimatedStyle,
    };
};

interface PlayerBackgroundSlotProps {
    style?: any;
    trackModel?: Track | null;
    coverUrl: string | null;
    bgVideo?: string | null;
    gradientColors: string[];
    showCanvas: boolean;
    isImmersive?: boolean;
    slotKey: string;
    showImage?: boolean;
}

const PlayerBackgroundSlot = React.memo(({
    style,
    trackModel,
    coverUrl,
    bgVideo,
    gradientColors,
    showCanvas,
    isImmersive = false,
    slotKey,
    showImage = true,
}: PlayerBackgroundSlotProps) => {
    const hasVideo = showCanvas && !!bgVideo;

    return (
        <View style={style}>
            {hasVideo ? (
                <CanvasVideo
                    key={`bg-canvas-${slotKey}-${trackModel?.id || 'curr'}-${bgVideo}`}
                    sourceUri={bgVideo!}
                    isImmersive={isImmersive}
                    gradientColors={gradientColors}
                />
            ) : (
                <BlurredBackground
                    key={`blur-${slotKey}`}
                    imageUrl={showImage ? coverUrl : null}
                    blurIntensity={10}
                    gradientColors={gradientColors}
                    showImage={showImage}
                />
            )}
        </View>
    );
});
PlayerBackgroundSlot.displayName = 'PlayerBackgroundSlot';

interface PlayerBackgroundProps {
    width: number;
    bgSwipeAnimatedStyle: any;
    prevTrackModel: Track | null;
    prevCoverUrl: string | null;
    track: Track;
    currentCoverUrl: string | null;
    nextTrackModel: Track | null;
    nextCoverUrl: string | null;
    showCanvas: boolean;
    isImmersive: boolean;
    isFocused: boolean;
    isTransitioning: boolean;
    playerBackgroundStyle: string;
    coverColor: string | null;
    topGradientColor: string;
    bottomGradientColor: string;
    prevCoverColor?: string | null;
    prevTopGradientColor?: string;
    prevBottomGradientColor?: string;
    nextCoverColor?: string | null;
    nextTopGradientColor?: string;
    nextBottomGradientColor?: string;
    backgroundColor: string;
}

const PlayerBackground = React.memo(({
    width: bgWidth,
    bgSwipeAnimatedStyle,
    prevTrackModel,
    prevCoverUrl,
    track,
    currentCoverUrl,
    nextTrackModel,
    nextCoverUrl,
    showCanvas,
    isImmersive,
    isFocused,
    isTransitioning,
    playerBackgroundStyle,
    coverColor,
    topGradientColor,
    bottomGradientColor,
    prevCoverColor,
    prevTopGradientColor,
    prevBottomGradientColor,
    nextCoverColor,
    nextTopGradientColor,
    nextBottomGradientColor,
    backgroundColor,
}: PlayerBackgroundProps) => {
    const isGradientMode = playerBackgroundStyle === 'gradient';

    const defaultGrad = useMemo(
        () => ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)', backgroundColor],
        [backgroundColor]
    );

    const lastValidCurrGradRef = useRef<string[] | null>(null);

    const currGrad = useMemo(() => {
        if (isGradientMode) {
            if (coverColor) {
                const grad = [topGradientColor, bottomGradientColor, bottomGradientColor];
                lastValidCurrGradRef.current = grad;
                return grad;
            }
            return lastValidCurrGradRef.current || ['#121212', backgroundColor, backgroundColor];
        }
        return defaultGrad;
    }, [isGradientMode, coverColor, topGradientColor, bottomGradientColor, defaultGrad, backgroundColor]);

    const prevGrad = useMemo(() => {
        if (isGradientMode) {
            if (prevCoverColor && prevTopGradientColor && prevBottomGradientColor) {
                return [prevTopGradientColor, prevBottomGradientColor, prevBottomGradientColor];
            }
            if (coverColor) {
                return [topGradientColor, bottomGradientColor, bottomGradientColor];
            }
            return lastValidCurrGradRef.current || ['#121212', backgroundColor, backgroundColor];
        }
        return defaultGrad;
    }, [isGradientMode, prevCoverColor, prevTopGradientColor, prevBottomGradientColor, coverColor, topGradientColor, bottomGradientColor, defaultGrad, backgroundColor]);

    const nextGrad = useMemo(() => {
        if (isGradientMode) {
            if (nextCoverColor && nextTopGradientColor && nextBottomGradientColor) {
                return [nextTopGradientColor, nextBottomGradientColor, nextBottomGradientColor];
            }
            if (coverColor) {
                return [topGradientColor, bottomGradientColor, bottomGradientColor];
            }
            return lastValidCurrGradRef.current || ['#121212', backgroundColor, backgroundColor];
        }
        return defaultGrad;
    }, [isGradientMode, nextCoverColor, nextTopGradientColor, nextBottomGradientColor, coverColor, topGradientColor, bottomGradientColor, defaultGrad, backgroundColor]);

    const canvasGrad = useMemo(
        () => ['rgba(0,0,0,0.10)', 'rgba(0,0,0,0.72)', 'rgba(0,0,0,0.97)'],
        []
    );

    return (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <Animated.View style={[bgSwipeAnimatedStyle, { width: bgWidth, height: '100%' }]}>
                {/* Slot -1: Previous */}
                <PlayerBackgroundSlot
                    slotKey="prev"
                    style={{ position: 'absolute', left: -bgWidth, width: bgWidth, height: '100%', overflow: 'hidden' }}
                    trackModel={prevTrackModel}
                    coverUrl={prevCoverUrl}
                    bgVideo={prevTrackModel?.bgVideo}
                    showCanvas={showCanvas}
                    isImmersive={false}
                    gradientColors={prevTrackModel?.bgVideo && showCanvas ? canvasGrad : prevGrad}
                    showImage={!isGradientMode}
                />

                {/* Slot 0: Current */}
                <PlayerBackgroundSlot
                    slotKey="curr"
                    style={{ width: bgWidth, height: '100%', overflow: 'hidden' }}
                    trackModel={track}
                    coverUrl={currentCoverUrl}
                    bgVideo={track.bgVideo}
                    showCanvas={showCanvas}
                    isImmersive={isImmersive}
                    gradientColors={track.bgVideo && showCanvas ? canvasGrad : currGrad}
                    showImage={!isGradientMode}
                />

                {/* Slot +1: Next */}
                <PlayerBackgroundSlot
                    slotKey="next"
                    style={{ position: 'absolute', left: bgWidth, width: bgWidth, height: '100%', overflow: 'hidden' }}
                    trackModel={nextTrackModel}
                    coverUrl={nextCoverUrl}
                    bgVideo={nextTrackModel?.bgVideo}
                    showCanvas={showCanvas}
                    isImmersive={false}
                    gradientColors={nextTrackModel?.bgVideo && showCanvas ? canvasGrad : nextGrad}
                    showImage={!isGradientMode}
                />
            </Animated.View>
        </View>
    );
});
PlayerBackground.displayName = 'PlayerBackground';

interface DiscCoverProps {
    playerCoverStyle: 'cd' | 'vinyl';
    album: Album | null;
    artworkSize: number;
    spinStyle: any;
    coverColor: string | null;
}

const DiscCover = React.memo(({ playerCoverStyle, album, artworkSize, spinStyle, coverColor }: DiscCoverProps) => {
    if (playerCoverStyle === 'cd') {
        if (album?.cdArtUrl) {
            return (
                <View style={{ width: artworkSize, height: artworkSize, alignSelf: 'center', position: 'relative' }}>
                    <MaskedView
                        style={StyleSheet.absoluteFillObject}
                        maskElement={
                            <View style={{
                                width: artworkSize,
                                height: artworkSize,
                                borderRadius: artworkSize / 2,
                                borderWidth: (artworkSize - 35) / 2,
                                borderColor: 'black',
                                backgroundColor: 'transparent',
                            }} />
                        }
                    >
                        <Animated.View style={[{ width: '100%', height: '100%' }, spinStyle]}>
                            <Image
                                source={{ uri: album.cdArtUrl }}
                                style={{ width: '100%', height: '100%' }}
                                contentFit="cover"
                            />
                        </Animated.View>
                    </MaskedView>
                    <Animated.View style={[StyleSheet.absoluteFillObject, spinStyle]}>
                        <Image
                            source={require('../../assets/cd-custom.svg')}
                            style={{ position: 'absolute', width: '100%', height: '100%' }}
                            contentFit="contain"
                        />
                    </Animated.View>
                </View>
            );
        }
        return (
            <View style={{ width: artworkSize, height: artworkSize, alignSelf: 'center', position: 'relative' }}>
                <Animated.View style={[{ width: '100%', height: '100%' }, spinStyle]}>
                    <Image
                        source={require('../../assets/cd-base.webp')}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="contain"
                    />
                </Animated.View>
            </View>
        );
    }

    return (
        <View style={{ width: artworkSize, height: artworkSize, alignSelf: 'center', position: 'relative' }}>
            <Animated.View style={[{ width: '100%', height: '100%' }, spinStyle]}>
                <Image
                    source={require('../../assets/vinyl.svg')}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="contain"
                />
                {coverColor && (
                    <View
                        style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            borderRadius: artworkSize / 2,
                            backgroundColor: coverColor,
                            opacity: 0.25,
                        }}
                        pointerEvents="none"
                    />
                )}
            </Animated.View>
        </View>
    );
});
DiscCover.displayName = 'DiscCover';

interface ActiveArtworkCenterProps {
    isImmersive: boolean;
    showPlayerVisualizer: boolean;
    playerVisualizerType: any;
    playerVisualizerColorMode: string;
    currentCoverUrl: string | null;
    accentLightColor: string;
    showCanvas: boolean;
    bgVideo?: string | null;
    artworkSize: number;
    playerCoverStyle: string;
    album: Album | null;
    spinStyle: any;
    coverColor: string | null;
    borderRadius: number;
    shadowStyle: any;
    cardBackgroundColor: string;
    textSecondaryColor: string;
}

const ActiveArtworkCenter = ({
    isImmersive,
    showPlayerVisualizer,
    playerVisualizerType,
    playerVisualizerColorMode,
    currentCoverUrl,
    accentLightColor,
    showCanvas,
    bgVideo,
    artworkSize,
    playerCoverStyle,
    album,
    spinStyle,
    coverColor,
    borderRadius,
    shadowStyle,
    cardBackgroundColor,
    textSecondaryColor,
}: ActiveArtworkCenterProps) => {
    if (isImmersive) {
        return <View style={StyleSheet.absoluteFillObject} />;
    }
    if (showPlayerVisualizer) {
        return (
            <NativeVisualizer
                active={true}
                type={playerVisualizerType}
                color={playerVisualizerColorMode === 'cover' ? 'cover' : accentLightColor || '#8B5CF6'}
                coverUrl={currentCoverUrl || undefined}
                style={{
                    width: '100%',
                    height: 240,
                    backgroundColor: 'transparent',
                }}
            />
        );
    }
    if (showCanvas && !!bgVideo) {
        return <View style={{ width: artworkSize, height: artworkSize }} />;
    }
    if (playerCoverStyle === 'cd' || playerCoverStyle === 'vinyl') {
        return (
            <DiscCover
                playerCoverStyle={playerCoverStyle}
                album={album}
                artworkSize={artworkSize}
                spinStyle={spinStyle}
                coverColor={coverColor}
            />
        );
    }
    return (
        <PlayerArtwork
            coverUrl={currentCoverUrl}
            size={artworkSize}
            borderRadius={borderRadius}
            shadowStyle={shadowStyle}
            cardBackgroundColor={cardBackgroundColor}
            textSecondaryColor={textSecondaryColor}
        />
    );
};

interface AdjacentArtworkSlotProps {
    trackModel: Track | null;
    coverUrl: string | null;
    showCanvas: boolean;
    artworkSize: number;
    borderRadius: number;
    shadowStyle: any;
    cardBackgroundColor: string;
    textSecondaryColor: string;
    isNext?: boolean;
    shuffleOnQueueEnd?: boolean;
    placeholderStyle: any;
}

const AdjacentArtworkSlot = ({
    trackModel,
    coverUrl,
    showCanvas,
    artworkSize,
    borderRadius,
    shadowStyle,
    cardBackgroundColor,
    textSecondaryColor,
    isNext = false,
    shuffleOnQueueEnd = false,
    placeholderStyle,
}: AdjacentArtworkSlotProps) => {
    if (!trackModel) {
        const iconName = isNext && shuffleOnQueueEnd ? "shuffle" : "musical-notes";
        return (
            <View style={placeholderStyle}>
                <Ionicons
                    name={iconName as any}
                    size={Math.min(80, Math.floor(artworkSize * 0.25))}
                    color={textSecondaryColor}
                />
            </View>
        );
    }
    if (showCanvas && !!trackModel.bgVideo) {
        return <View style={{ width: artworkSize, height: artworkSize }} />;
    }
    return (
        <PlayerArtwork
            key={`art-${isNext ? 'next' : 'prev'}-${trackModel.id}`}
            coverUrl={coverUrl}
            size={artworkSize}
            borderRadius={borderRadius}
            shadowStyle={shadowStyle}
            cardBackgroundColor={cardBackgroundColor}
            textSecondaryColor={textSecondaryColor}
        />
    );
};

interface PlayerArtworkStageProps {
    artworkRef: React.RefObject<View | null>;
    artworkLayout: React.RefObject<any>;
    onArtworkHeightMeasured: (h: number) => void;
    measuredArtworkHeight: number;
    isAltDisplay: boolean;
    isImmersive: boolean;
    composedGesture: any;
    swipeAnimatedStyle: any;
    width: number;
    prevTrackModel: Track | null;
    prevCoverUrl: string | null;
    showCanvas: boolean;
    artworkSize: number;
    radiiMd: number;
    shadowsLg: any;
    cardBackgroundColor: string;
    textSecondaryColor: string;
    showPlayerVisualizer: boolean;
    playerVisualizerType: any;
    playerVisualizerColorMode: string;
    currentCoverUrl: string | null;
    accentLightColor: string;
    track: Track;
    playerCoverStyle: string;
    album: Album | null;
    spinStyle: any;
    coverColor: string | null;
    nextTrackModel: Track | null;
    nextCoverUrl: string | null;
    shuffleOnQueueEnd: boolean;
    styles: any;
}

const PlayerArtworkStage = ({
    artworkRef,
    artworkLayout,
    onArtworkHeightMeasured,
    measuredArtworkHeight,
    isAltDisplay,
    isImmersive,
    composedGesture,
    swipeAnimatedStyle,
    width: stageWidth,
    prevTrackModel,
    prevCoverUrl,
    showCanvas,
    artworkSize,
    radiiMd,
    shadowsLg,
    cardBackgroundColor,
    textSecondaryColor,
    showPlayerVisualizer,
    playerVisualizerType,
    playerVisualizerColorMode,
    currentCoverUrl,
    accentLightColor,
    track,
    playerCoverStyle,
    album,
    spinStyle,
    coverColor,
    nextTrackModel,
    nextCoverUrl,
    shuffleOnQueueEnd,
    styles,
}: PlayerArtworkStageProps) => {
    return (
        <View
            ref={artworkRef}
            collapsable={false}
            onLayout={(e) => {
                artworkLayout.current = e.nativeEvent.layout;
                const h = e.nativeEvent.layout.height;
                if (h > 0 && Math.abs(h - measuredArtworkHeight) > 2) {
                    onArtworkHeightMeasured(h);
                }
            }}
            style={[
                styles.artworkContainer,
                isAltDisplay && { paddingHorizontal: 0 },
                isImmersive && { flex: 1, paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0, marginVertical: 0 }
            ]}
        >
            <GestureDetector gesture={composedGesture}>
                <Animated.View style={[
                    swipeAnimatedStyle,
                    {
                        width: stageWidth,
                        height: '100%',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }
                ]}>
                    {/* Slot -1: Previous */}
                    <View style={{
                        position: 'absolute',
                        left: -stageWidth,
                        width: stageWidth,
                        height: '100%',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }} pointerEvents="none">
                        <AdjacentArtworkSlot
                            trackModel={prevTrackModel}
                            coverUrl={prevCoverUrl}
                            showCanvas={showCanvas}
                            artworkSize={artworkSize}
                            borderRadius={radiiMd}
                            shadowStyle={shadowsLg}
                            cardBackgroundColor={cardBackgroundColor}
                            textSecondaryColor={textSecondaryColor}
                            placeholderStyle={[styles.artwork, styles.artworkPlaceholder]}
                        />
                    </View>

                    {/* Slot 0: Current */}
                    <View style={{
                        width: stageWidth,
                        height: '100%',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}>
                        <ActiveArtworkCenter
                            isImmersive={isImmersive}
                            showPlayerVisualizer={showPlayerVisualizer}
                            playerVisualizerType={playerVisualizerType}
                            playerVisualizerColorMode={playerVisualizerColorMode}
                            currentCoverUrl={currentCoverUrl}
                            accentLightColor={accentLightColor}
                            showCanvas={showCanvas}
                            bgVideo={track.bgVideo}
                            artworkSize={artworkSize}
                            playerCoverStyle={playerCoverStyle}
                            album={album}
                            spinStyle={spinStyle}
                            coverColor={coverColor}
                            borderRadius={radiiMd}
                            shadowStyle={shadowsLg}
                            cardBackgroundColor={cardBackgroundColor}
                            textSecondaryColor={textSecondaryColor}
                        />
                    </View>

                    {/* Slot +1: Next */}
                    <View style={{
                        position: 'absolute',
                        left: stageWidth,
                        width: stageWidth,
                        height: '100%',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }} pointerEvents="none">
                        <AdjacentArtworkSlot
                            trackModel={nextTrackModel}
                            coverUrl={nextCoverUrl}
                            showCanvas={showCanvas}
                            artworkSize={artworkSize}
                            borderRadius={radiiMd}
                            shadowStyle={shadowsLg}
                            cardBackgroundColor={cardBackgroundColor}
                            textSecondaryColor={textSecondaryColor}
                            isNext={true}
                            shuffleOnQueueEnd={shuffleOnQueueEnd}
                            placeholderStyle={[styles.artwork, styles.artworkPlaceholder]}
                        />
                    </View>
                </Animated.View>
            </GestureDetector>
        </View>
    );
};

interface PlayerHeaderProps {
    marginTop: number;
    colors: any;
    t: any;
    albumTitle?: string;
    isImmersive: boolean;
    onDismiss: () => void;
    onOpenPlayerMenu: () => void;
    onAlbumPress: () => void;
    onOpenTutorial: () => void;
    onMorePress: () => void;
    visualizerButtonRef: React.RefObject<View | null>;
    visualizerButtonLayout: React.RefObject<any>;
    moreButtonRef: React.RefObject<View | null>;
    moreButtonLayout: React.RefObject<any>;
    styles: any;
    trackId: string;
}

const PlayerHeader = ({
    marginTop,
    colors,
    t,
    albumTitle,
    isImmersive,
    onDismiss,
    onOpenPlayerMenu,
    onAlbumPress,
    onOpenTutorial,
    onMorePress,
    visualizerButtonRef,
    visualizerButtonLayout,
    moreButtonRef,
    moreButtonLayout,
    styles,
    trackId,
}: PlayerHeaderProps) => {
    return (
        <View style={[styles.header, { marginTop }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TouchableOpacity
                    onPress={onDismiss}
                    style={styles.dismissButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel={t('actions.close') || 'Cerrar'}
                >
                    <Ionicons name="chevron-down" size={32} color={colors.text} />
                </TouchableOpacity>

                <View
                    ref={visualizerButtonRef}
                    collapsable={false}
                    onLayout={(e) => {
                        visualizerButtonLayout.current = e.nativeEvent.layout;
                    }}
                >
                    <TouchableOpacity
                        onPress={onOpenPlayerMenu}
                        style={styles.moreButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityLabel={t('visualizer.menu_title') || 'Opciones de Visualización'}
                    >
                        <Ionicons name="color-palette-outline" size={23} color={colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            <TouchableOpacity
                style={styles.headerTextContainer}
                onPress={onAlbumPress}
            >
                <MarqueeText
                    key={`album-${trackId}-${albumTitle || ''}`}
                    text={albumTitle || t('actions.unknown')}
                    style={styles.headerTitle}
                    speed={35}
                    pauseDuration={2000}
                />
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TouchableOpacity
                    onPress={onOpenTutorial}
                    disabled={isImmersive}
                    style={[styles.moreButton, isImmersive && { opacity: 0.65 }]}
                    accessibilityLabel={t('player_tutorial.help_btn')}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons
                        name="help-circle-outline"
                        size={24}
                        color={isImmersive ? colors.textSecondary : colors.text}
                    />
                </TouchableOpacity>

                <View
                    ref={moreButtonRef}
                    collapsable={false}
                    onLayout={(e) => {
                        moreButtonLayout.current = e.nativeEvent.layout;
                    }}
                >
                    <TouchableOpacity
                        style={styles.moreButton}
                        onPress={onMorePress}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

interface PlayerInfoSectionProps {
    track: Track;
    artist: Artist | null;
    artists: Artist[];
    tags: Tag[];
    showTagColors: boolean;
    isAltDisplay: boolean;
    artworkSource: any;
    colors: any;
    t: any;
    heartAnimatedStyle: any;
    infoContainerAnimatedStyle: any;
    tagsRef: React.RefObject<View | null>;
    tagsLayout: React.RefObject<any>;
    actionsRef: React.RefObject<View | null>;
    actionsLayout: React.RefObject<any>;
    onArtistPress: () => void;
    onLikePress: () => void;
    onOpenTagManager: () => void;
    onOpenPlaylistSelector: () => void;
    styles: any;
}

const PlayerInfoSection = ({
    track,
    artist,
    artists,
    tags,
    showTagColors,
    isAltDisplay,
    artworkSource,
    colors,
    t,
    heartAnimatedStyle,
    infoContainerAnimatedStyle,
    tagsRef,
    tagsLayout,
    actionsRef,
    actionsLayout,
    onArtistPress,
    onLikePress,
    onOpenTagManager,
    onOpenPlaylistSelector,
    styles,
}: PlayerInfoSectionProps) => {
    const artistDisplayText = useMemo(() => {
        if (artists && artists.length > 0) {
            return artists.map(a => a.name).join(', ');
        }
        return artist?.name || t('actions.unknown');
    }, [artists, artist, t]);

    return (
        <Animated.View style={[styles.infoContainer, infoContainerAnimatedStyle]}>
            <View style={styles.infoTextContainer}>
                {/* Tags row */}
                <View
                    ref={tagsRef}
                    collapsable={false}
                    onLayout={(e) => {
                        tagsLayout.current = e.nativeEvent.layout;
                    }}
                    style={styles.tagsRow}
                >
                    {tags && tags.length > 0 ? (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.tagsScroll}
                            keyboardShouldPersistTaps="handled"
                        >
                            {tags.map(tagItem => (
                                <TouchableOpacity
                                    key={tagItem.id}
                                    style={[styles.tagBadge, { backgroundColor: showTagColors ? tagItem.color : colors.overlayAlpha08 }]}
                                    onPress={onOpenTagManager}
                                >
                                    <Text style={[styles.tagText, { color: showTagColors ? getDynamicTagTextColor(tagItem.color) : colors.text }]}>
                                        {tagItem.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    ) : (
                        <TouchableOpacity
                            style={styles.addTagButton}
                            onPress={onOpenTagManager}
                        >
                            <Ionicons name="add-circle-outline" size={14} color={colors.textSecondary} />
                            <Text style={styles.addTagText}>{t('actions.add_tag')}</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Title & Artist row with optional mini cover */}
                <View style={isAltDisplay ? { flexDirection: 'row', alignItems: 'center' } : null}>
                    {isAltDisplay && artworkSource && (
                        <Image
                            source={artworkSource}
                            style={styles.miniArtwork}
                            contentFit="cover"
                            transition={200}
                            cachePolicy="memory-disk"
                        />
                    )}
                    <View style={isAltDisplay ? { flex: 1 } : null}>
                        <MarqueeText
                            key={`title-${track.id}`}
                            text={track.title}
                            style={styles.title}
                            speed={45}
                            pauseDuration={1800}
                        />
                        <TouchableOpacity onPress={onArtistPress}>
                            <MarqueeText
                                key={`artist-${track.id}`}
                                text={artistDisplayText}
                                style={styles.artist}
                                speed={35}
                                pauseDuration={2000}
                            />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Actions Column (Heart + Plus) */}
            <View
                ref={actionsRef}
                collapsable={false}
                onLayout={(e) => {
                    actionsLayout.current = e.nativeEvent.layout;
                }}
                style={styles.infoActionsContainer}
            >
                <Animated.View style={heartAnimatedStyle}>
                    <TouchableOpacity
                        onPress={onLikePress}
                        style={styles.actionButton}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        <Ionicons
                            name={track.isFavorite ? "heart" : "heart-outline"}
                            size={28}
                            color={track.isFavorite ? colors.heartIcon : colors.text}
                        />
                    </TouchableOpacity>
                </Animated.View>

                <TouchableOpacity
                    onPress={onOpenPlaylistSelector}
                    style={styles.actionButton}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                >
                    <Ionicons name="add" size={28} color={colors.text} />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
};

interface PlayerProgressSectionProps {
    isLocalCastActive: boolean;
    duration: number;
    displayPosition: number;
    isSeeking: boolean;
    seekValue: number;
    onSlidingStart: (value: number) => void;
    onValueChange: (value: number) => void;
    onSlidingComplete: (value: number) => void;
    formatTimestamp: (s: number) => string;
    colors: any;
    t: any;
    styles: any;
}

const PlayerProgressSection = ({
    isLocalCastActive,
    duration,
    displayPosition,
    isSeeking,
    seekValue,
    onSlidingStart,
    onValueChange,
    onSlidingComplete,
    formatTimestamp,
    colors,
    t,
    styles,
}: PlayerProgressSectionProps) => {
    if (isLocalCastActive) {
        return (
            <View style={styles.castingRemoteBanner}>
                <Ionicons name="radio" size={16} color={colors.accentLight || colors.text} />
                <Text style={[styles.castingRemoteText, { color: colors.textSecondary }]}>
                    {t('cast.remote_mode_banner', 'LocalCast activo · Modo control remoto')}
                </Text>
            </View>
        );
    }

    const sliderValue = isSeeking ? seekValue : displayPosition;
    const maxVal = duration > 0 ? duration : 1;

    return (
        <View style={styles.progressSection}>
            <View style={{ position: 'relative', width: '100%', height: 40, marginVertical: -8 }}>
                <ABSliderMarkers duration={duration} />
                <Slider
                    style={{ width: '100%', height: 40 }}
                    minimumValue={0}
                    maximumValue={maxVal}
                    value={sliderValue}
                    minimumTrackTintColor={colors.text}
                    maximumTrackTintColor={colors.overlayAlpha20}
                    thumbTintColor={colors.text}
                    onSlidingStart={onSlidingStart}
                    onValueChange={onValueChange}
                    onSlidingComplete={onSlidingComplete}
                />
            </View>
            <View style={styles.timeContainer}>
                <Text style={styles.timeText}>{formatTimestamp(displayPosition)}</Text>
                <Text style={styles.timeText}>{formatTimestamp(duration)}</Text>
            </View>
        </View>
    );
};

interface PlayerControlsProps {
    isShuffleEnabled: boolean;
    hasPrevious: boolean;
    hasNext: boolean;
    position: number;
    repeatMode: RepeatMode;
    colors: any;
    controlsRef: React.RefObject<View | null>;
    controlsLayout: React.RefObject<any>;
    onToggleShuffle: () => void;
    onSkipPrevious: () => void;
    onSkipNext: () => void;
    onCycleRepeat: () => void;
    styles: any;
}

const PlayerControls = ({
    isShuffleEnabled,
    hasPrevious,
    hasNext,
    position,
    repeatMode,
    colors,
    controlsRef,
    controlsLayout,
    onToggleShuffle,
    onSkipPrevious,
    onSkipNext,
    onCycleRepeat,
    styles,
}: PlayerControlsProps) => {
    const isPrevActive = hasPrevious || position > SKIP_PREVIOUS_THRESHOLD;

    return (
        <View
            ref={controlsRef}
            collapsable={false}
            onLayout={(e) => {
                controlsLayout.current = e.nativeEvent.layout;
            }}
            style={styles.controlsContainer}
        >
            {/* Shuffle */}
            <TouchableOpacity
                onPress={onToggleShuffle}
                style={styles.secondaryControlButton}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
                <Ionicons
                    name={isShuffleEnabled ? 'shuffle' : 'shuffle-outline'}
                    size={24}
                    color={isShuffleEnabled ? colors.accentLight : colors.disabled}
                />
            </TouchableOpacity>

            {/* Back */}
            <TouchableOpacity
                onPress={onSkipPrevious}
                style={styles.controlButton}
                disabled={!isPrevActive}
            >
                <Ionicons
                    name="play-back"
                    size={38}
                    color={isPrevActive ? colors.text : colors.disabled}
                />
            </TouchableOpacity>

            <PlayPauseButton size={84} iconType="circle" style={styles.mainControlButton} />

            {/* Forward */}
            <TouchableOpacity
                onPress={onSkipNext}
                style={styles.controlButton}
                disabled={!hasNext}
            >
                <Ionicons
                    name="play-forward"
                    size={38}
                    color={hasNext ? colors.text : colors.disabled}
                />
            </TouchableOpacity>

            {/* Repeat */}
            <TouchableOpacity
                onPress={onCycleRepeat}
                style={styles.secondaryControlButton}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
                <View>
                    <Ionicons
                        name={repeatMode === RepeatMode.Off ? 'repeat-outline' : 'repeat'}
                        size={24}
                        color={repeatMode === RepeatMode.Off ? colors.disabled : colors.accentLight}
                    />
                    {repeatMode === RepeatMode.Track && (
                        <Text style={styles.repeatOneBadge}>1</Text>
                    )}
                </View>
            </TouchableOpacity>
        </View>
    );
};

interface PlayerFooterProps {
    insetsBottom: number;
    isServerRunning: boolean;
    isSleepTimerActive: boolean;
    isSpeedPitchActive: boolean;
    isLocalCastActive: boolean;
    isChromecastConnected: boolean;
    isCasting: boolean;
    pointA: number | null;
    pointB: number | null;
    colors: any;
    onOpenSleepTimer: () => void;
    onOpenSpeedPitch: () => void;
    onNavigateLyrics: () => void;
    onOpenCast: () => void;
    onABPress: () => void;
    onABLongPress: () => void;
    onShare: () => void;
    onOpenQueue: () => void;
    sleepTimerRef: React.RefObject<View | null>;
    sleepTimerLayout: React.RefObject<any>;
    speedRef: React.RefObject<View | null>;
    speedLayout: React.RefObject<any>;
    lyricsRef: React.RefObject<View | null>;
    lyricsLayout: React.RefObject<any>;
    castRef: React.RefObject<View | null>;
    castLayout: React.RefObject<any>;
    abRepeatRef: React.RefObject<View | null>;
    abRepeatLayout: React.RefObject<any>;
    shareRef: React.RefObject<View | null>;
    shareLayout: React.RefObject<any>;
    queueRef: React.RefObject<View | null>;
    queueLayout: React.RefObject<any>;
    styles: any;
}

const PlayerFooter = ({
    insetsBottom,
    isServerRunning,
    isSleepTimerActive,
    isSpeedPitchActive,
    isLocalCastActive,
    isChromecastConnected,
    isCasting,
    pointA,
    pointB,
    colors,
    onOpenSleepTimer,
    onOpenSpeedPitch,
    onNavigateLyrics,
    onOpenCast,
    onABPress,
    onABLongPress,
    onShare,
    onOpenQueue,
    sleepTimerRef,
    sleepTimerLayout,
    speedRef,
    speedLayout,
    lyricsRef,
    lyricsLayout,
    castRef,
    castLayout,
    abRepeatRef,
    abRepeatLayout,
    shareRef,
    shareLayout,
    queueRef,
    queueLayout,
    styles,
}: PlayerFooterProps) => {
    let castIconName = "desktop-outline";
    if (isChromecastConnected) {
        castIconName = "tv";
    } else if (isLocalCastActive) {
        castIconName = "desktop";
    }

    let castColor = colors.textSecondary;
    if (isCasting) {
        castColor = isChromecastConnected ? "#60A5FA" : colors.accentLight;
    }

    let sleepTimerColor = colors.textSecondary;
    if (isServerRunning) {
        sleepTimerColor = colors.disabled;
    } else if (isSleepTimerActive) {
        sleepTimerColor = colors.accentLight;
    }

    let speedPitchColor = colors.textSecondary;
    if (isServerRunning) {
        speedPitchColor = colors.disabled;
    } else if (isSpeedPitchActive) {
        speedPitchColor = colors.accentLight;
    }

    return (
        <View style={[styles.footer, { marginBottom: insetsBottom + 30 }]}>
            {/* Left group */}
            <View style={styles.footerLeftGroup}>
                <View
                    ref={sleepTimerRef}
                    collapsable={false}
                    onLayout={(e) => {
                        sleepTimerLayout.current = e.nativeEvent.layout;
                    }}
                >
                    <TouchableOpacity
                        onPress={onOpenSleepTimer}
                        style={styles.footerButton}
                        disabled={isServerRunning}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        <Ionicons
                            name="timer-outline"
                            size={24}
                            color={sleepTimerColor}
                        />
                    </TouchableOpacity>
                </View>

                <View
                    ref={speedRef}
                    collapsable={false}
                    onLayout={(e) => {
                        speedLayout.current = e.nativeEvent.layout;
                    }}
                >
                    <TouchableOpacity
                        onPress={onOpenSpeedPitch}
                        style={styles.footerButton}
                        disabled={isServerRunning}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        <Ionicons
                            name="speedometer-outline"
                            size={24}
                            color={speedPitchColor}
                        />
                    </TouchableOpacity>
                </View>

                <View
                    ref={lyricsRef}
                    collapsable={false}
                    onLayout={(e) => {
                        lyricsLayout.current = e.nativeEvent.layout;
                    }}
                >
                    <TouchableOpacity
                        onPress={onNavigateLyrics}
                        style={styles.footerButton}
                        disabled={isLocalCastActive}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        <Ionicons
                            name="mic-outline"
                            size={24}
                            color={isLocalCastActive ? colors.disabled : colors.textSecondary}
                        />
                    </TouchableOpacity>
                </View>

                <View
                    ref={castRef}
                    collapsable={false}
                    onLayout={(e) => {
                        castLayout.current = e.nativeEvent.layout;
                    }}
                >
                    <TouchableOpacity
                        onPress={onOpenCast}
                        style={styles.footerButton}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        <Ionicons
                            name={castIconName as any}
                            size={24}
                            color={castColor}
                        />
                    </TouchableOpacity>
                </View>

                <View
                    ref={abRepeatRef}
                    collapsable={false}
                    onLayout={(e) => {
                        abRepeatLayout.current = e.nativeEvent.layout;
                    }}
                >
                    <TouchableOpacity
                        onPress={onABPress}
                        onLongPress={onABLongPress}
                        delayLongPress={350}
                        style={styles.footerButton}
                        disabled={isCasting}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        <ABRepeatIcon
                            pointA={pointA}
                            pointB={pointB}
                            disabled={isCasting}
                        />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Right group */}
            <View style={styles.footerRightGroup}>
                <View
                    ref={shareRef}
                    collapsable={false}
                    onLayout={(e) => {
                        shareLayout.current = e.nativeEvent.layout;
                    }}
                >
                    <TouchableOpacity
                        onPress={onShare}
                        style={styles.footerButton}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        <Ionicons
                            name="share-social-outline"
                            size={24}
                            color={colors.textSecondary}
                        />
                    </TouchableOpacity>
                </View>

                <View
                    ref={queueRef}
                    collapsable={false}
                    onLayout={(e) => {
                        queueLayout.current = e.nativeEvent.layout;
                    }}
                >
                    <TouchableOpacity
                        onPress={onOpenQueue}
                        style={styles.footerButton}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        <Ionicons name="list" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const usePlayerTutorial = (isFocused: boolean, isImmersive: boolean) => {
    const hasSeenPlayerTutorial = useSettingsStore(state => state.hasSeenPlayerTutorial);
    const setHasSeenPlayerTutorial = useSettingsStore(state => state.setHasSeenPlayerTutorial);
    const [isTutorialVisible, setIsTutorialVisible] = useState(false);

    useEffect(() => {
        if (isFocused && !hasSeenPlayerTutorial && !isImmersive) {
            setIsTutorialVisible(true);
        }
        if (isImmersive) {
            setIsTutorialVisible(false);
        }
    }, [isFocused, hasSeenPlayerTutorial, isImmersive]);

    const handleCloseTutorial = useCallback(() => {
        setIsTutorialVisible(false);
        if (!hasSeenPlayerTutorial) {
            setHasSeenPlayerTutorial(true);
        }
    }, [hasSeenPlayerTutorial, setHasSeenPlayerTutorial]);

    return {
        isTutorialVisible,
        setIsTutorialVisible,
        handleCloseTutorial,
    };
};

interface UsePlayerNavigationParams {
    track: Track;
    album: Album | null;
    artist: Artist | null;
    artists: Artist[];
    currentCoverUrl: string | null;
    navigation: any;
}

const usePlayerNavigation = ({
    track,
    album,
    artist,
    artists,
    currentCoverUrl,
    navigation,
}: UsePlayerNavigationParams) => {
    const handleMorePress = useCallback(() => {
        openTrackMenu(track, {
            album: (albumId: string) => navigation.navigate('AlbumDetail', { albumId }),
            artist: (artistId: string) => navigation.navigate('ArtistDetail', { artistId }),
        });
    }, [track, navigation]);

    const handleAlbumPress = useCallback(() => {
        if ((track as any)?.isExternal) return;
        if (album?.id) {
            navigation.navigate('AlbumDetail', { albumId: album.id });
        }
    }, [track, album, navigation]);

    const handleArtistPress = useCallback(() => {
        if ((track as any)?.isExternal) return;
        if (artists && artists.length > 1) {
            useArtistsListSheetStore.getState().openSheet(artists);
        } else {
            const targetArtistId = artists && artists.length > 0 ? artists[0].id : artist?.id;
            if (!targetArtistId) return;
            navigation.navigate('ArtistDetail', { artistId: targetArtistId });
        }
    }, [track, artists, artist, navigation]);

    const handleOpenTagManager = useCallback(() => {
        if ((track as any)?.isExternal) {
            useToastStore.getState().showToast('Archivo externo no guardado en la biblioteca', 'information-circle');
            return;
        }
        openTagManagerForTrack(track);
    }, [track]);

    const handleOpenPlaylistSelector = useCallback(() => {
        if ((track as any)?.isExternal) {
            useToastStore.getState().showToast('Archivo externo no guardado en la biblioteca', 'information-circle');
            return;
        }
        openPlaylistSelector(track);
    }, [track]);

    const handleShare = useCallback(() => {
        if (!track?.fileUrl) return;
        navigation.navigate('ShareSong', {
            trackId: track.id,
            title: track.title,
            artist: artist?.name || '',
            album: album?.title || '',
            coverUrl: currentCoverUrl || null,
            fileUrl: track.fileUrl,
            duration: track.duration,
        });
    }, [track, artist, album, navigation, currentCoverUrl]);

    return {
        handleMorePress,
        handleAlbumPress,
        handleArtistPress,
        handleOpenTagManager,
        handleOpenPlaylistSelector,
        handleShare,
    };
};

const usePlayerActions = (track: Track, t: any) => {
    const isShuffleEnabled = usePlayerStore(state => state.isShuffleEnabled);
    const [repeatMode, setRepeatMode] = useState<RepeatMode>(RepeatMode.Off);

    useEffect(() => {
        TrackPlayer.getRepeatMode().then(setRepeatMode).catch(() => { });
    }, []);

    const cycleRepeatMode = useCallback(async () => {
        try {
            let next: RepeatMode;
            if (repeatMode === RepeatMode.Off) {
                next = RepeatMode.Queue;
            } else if (repeatMode === RepeatMode.Queue) {
                next = RepeatMode.Track;
            } else {
                next = RepeatMode.Off;
            }
            await TrackPlayer.setRepeatMode(next);
            setRepeatMode(next);
            await usePlayerStore.getState().updateQueueStatus();
        } catch (e) {
            console.error('Error cycling repeat mode:', e);
        }
    }, [repeatMode]);

    const toggleShuffle = useCallback(() => {
        void usePlayerStore.getState().toggleShuffle();
    }, []);

    const heartScale = useSharedValue(1);
    const heartAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: heartScale.value }]
    }));

    const handleLikePress = useCallback(async () => {
        heartScale.value = withSequence(
            withSpring(1.2, { damping: 15, stiffness: 300 }),
            withSpring(1.0, { damping: 15, stiffness: 300 })
        );
        try {
            await track.toggleLike();
            if (track.isFavorite) {
                useToastStore.getState().showToast(t('toasts.added_to_favourites'), 'heart');
            }
        } catch (e) {
            console.error('Error al dar me gusta:', e);
        }
    }, [track, heartScale, t]);

    return {
        isShuffleEnabled,
        repeatMode,
        cycleRepeatMode,
        toggleShuffle,
        heartAnimatedStyle,
        handleLikePress,
    };
};

// --- MAIN COORDINATOR COMPONENT ---

const PlayerScreenUI = ({
    track, album, artist, artists, tags, navigation, formatTimestamp, hasNext, hasPrevious, isFocused
}: PlayerScreenUIProps) => {
    const { colors, fonts, layout, spacing, radii, fontWeights, shadows } = useAppTheme({ ignoreTheme: true });
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();

    const isSleepTimerActive = useSleepTimerStore(state => state.isActive);
    const playbackSpeed = usePlayerStore(state => state.playbackSpeed);
    const playbackPitch = usePlayerStore(state => state.playbackPitch);
    const isSpeedPitchActive = playbackSpeed !== 1.0 || playbackPitch !== 1.0;

    const queueVersion = usePlayerStore(state => state.queueVersion);
    const windowVersion = usePlayerStore(state => state.windowVersion);

    const showCanvas = useSettingsStore(state => state.showCanvas);

    // Immersive Mode
    const {
        isImmersive,
        toggleImmersiveMode,
        bottomControlsAnimatedStyle,
        infoContainerAnimatedStyle,
    } = useImmersiveMode(showCanvas, track.bgVideo, insets.bottom);

    // Tutorial state & refs
    const { isTutorialVisible, setIsTutorialVisible, handleCloseTutorial } = usePlayerTutorial(isFocused, isImmersive);
    const activeSheet = useUIStore(state => state.activeSheet);
    const isTagFormVisible = useTagFormStore(state => state.isVisible);
    const isSheetOrModalOpen = activeSheet !== null || isTagFormVisible || isTutorialVisible;

    // Tutorial refs & layouts
    const rootRef = React.useRef<View>(null);
    const moreButtonRef = React.useRef<View>(null);
    const visualizerButtonRef = React.useRef<View>(null);
    const artworkRef = React.useRef<View>(null);
    const tagsRef = React.useRef<View>(null);
    const actionsRef = React.useRef<View>(null);
    const controlsRef = React.useRef<View>(null);
    const sleepTimerRef = React.useRef<View>(null);
    const speedRef = React.useRef<View>(null);
    const lyricsRef = React.useRef<View>(null);
    const castRef = React.useRef<View>(null);
    const abRepeatRef = React.useRef<View>(null);
    const shareRef = React.useRef<View>(null);
    const queueRef = React.useRef<View>(null);

    const moreButtonLayout = React.useRef<any>(null);
    const visualizerButtonLayout = React.useRef<any>(null);
    const artworkLayout = React.useRef<any>(null);
    const tagsLayout = React.useRef<any>(null);
    const actionsLayout = React.useRef<any>(null);
    const controlsLayout = React.useRef<any>(null);
    const sleepTimerLayout = React.useRef<any>(null);
    const speedLayout = React.useRef<any>(null);
    const lyricsLayout = React.useRef<any>(null);
    const castLayout = React.useRef<any>(null);
    const abRepeatLayout = React.useRef<any>(null);
    const shareLayout = React.useRef<any>(null);
    const queueLayout = React.useRef<any>(null);

    // Adjacent tracks
    const {
        prevTrackModel,
        nextTrackModel,
        prevCoverUrl,
        nextCoverUrl,
    } = useAdjacentTracks(track.id, queueVersion, windowVersion);

    // Cover & background colors
    const {
        currentCoverUrl,
        coverColor,
        finalBgColor,
        topGradientColor,
        bottomGradientColor,
        prevCoverColor,
        prevTopGradientColor,
        prevBottomGradientColor,
        nextCoverColor,
        nextTopGradientColor,
        nextBottomGradientColor,
    } = usePlayerCover(
        track,
        album,
        nextTrackModel,
        prevTrackModel,
        nextCoverUrl,
        prevCoverUrl,
        colors.background
    );

    const isTransitioning = useScreenTransition(isFocused, navigation);

    // Settings
    const showTagColors = useSettingsStore(state => state.showTagColors);
    const showPlayerVisualizer = useSettingsStore(state => state.showPlayerVisualizer);
    const playerVisualizerType = useSettingsStore(state => state.playerVisualizerType);
    const playerVisualizerColorMode = useSettingsStore(state => state.playerVisualizerColorMode);
    const playerCoverStyle = useSettingsStore(state => state.playerCoverStyle);
    const playerBackgroundStyle = useSettingsStore(state => state.playerBackgroundStyle);
    const showPlayerLyrics = useSettingsStore(state => state.showPlayerLyrics);
    const shuffleOnQueueEnd = useSettingsStore(state => state.shuffleOnQueueEnd);

    // Cast
    const isServerRunning = useCastStore(state => state.isServerRunning);
    const isLocalCastActive = useCastStore(state => state.isLocalCastActive);
    const isChromecastConnected = useCastStore(state => state.isChromecastConnected);
    const isCasting = isLocalCastActive || isChromecastConnected;

    // Progress & Lyrics
    const { position, duration } = useProgress();
    const { parsedLyrics, activeIndex, isSynced } = useSyncedLyrics(track, position);
    const hasLyrics = !isLocalCastActive && showPlayerLyrics && isSynced && parsedLyrics.length > 0;
    const currentPhrase = hasLyrics && activeIndex >= 0 && activeIndex < parsedLyrics.length
        ? parsedLyrics[activeIndex].text
        : '';

    const { lyricsAnimatedStyle, textAnimatedStyle, activeLyricText } = useLyricsAnimation(
        track.id,
        hasLyrics,
        showPlayerLyrics,
        currentPhrase
    );

    // Dynamic artwork sizing
    const [measuredArtworkHeight, setMeasuredArtworkHeight] = useState<number>(0);
    const artworkSize = usePlayerArtworkSize(
        measuredArtworkHeight,
        windowWidth,
        windowHeight,
        insets,
        hasLyrics
    );

    const styles = useMemo(
        () => getStyles({ colors, fonts, layout, spacing, radii, fontWeights, shadows }, artworkSize),
        [colors, fonts, layout, spacing, radii, fontWeights, shadows, artworkSize]
    );

    const isAltDisplay = showPlayerVisualizer || playerCoverStyle === 'cd' || playerCoverStyle === 'vinyl' || (showCanvas && !!track.bgVideo);

    // AB Repeat
    const pointA = useABRepeatStore(state => state.pointA);
    const pointB = useABRepeatStore(state => state.pointB);
    const handleABButtonPress = useABRepeatStore(state => state.handleButtonPress);
    const handleABLongPress = useABRepeatStore(state => state.handleLongPress);

    // Seeking
    const [isSeeking, setIsSeeking] = useState(false);
    const [seekValue, setSeekValue] = useState(0);
    const displayPosition = isSeeking ? seekValue : position;

    // Actions (shuffle, repeat, like)
    const {
        isShuffleEnabled,
        repeatMode,
        cycleRepeatMode,
        toggleShuffle,
        heartAnimatedStyle,
        handleLikePress,
    } = usePlayerActions(track, t);

    // Spin animation
    const playbackState = usePlaybackState();
    const isPlaying = playbackState.state === TrackPlayerState.Playing;
    const spinStyle = useDiscSpinAnimation(playerCoverStyle, isPlaying);

    // Background swipe identity
    const currBgVideo = (showCanvas && !!track.bgVideo) ? track.bgVideo : null;
    const prevBgVideo = (showCanvas && !!prevTrackModel?.bgVideo) ? prevTrackModel.bgVideo : null;
    const nextBgVideo = (showCanvas && !!nextTrackModel?.bgVideo) ? nextTrackModel.bgVideo : null;

    const isPrevBgIdentical = useMemo(() => {
        if (!prevTrackModel) return true;
        if (currBgVideo || prevBgVideo) return false;
        return currentCoverUrl === prevCoverUrl;
    }, [prevTrackModel, currBgVideo, prevBgVideo, currentCoverUrl, prevCoverUrl]);

    const isNextBgIdentical = useMemo(() => {
        if (!nextTrackModel) return true;
        if (currBgVideo || nextBgVideo) return false;
        return currentCoverUrl === nextCoverUrl;
    }, [nextTrackModel, currBgVideo, nextBgVideo, currentCoverUrl, nextCoverUrl]);

    // Navigation handlers
    const {
        handleMorePress,
        handleAlbumPress,
        handleArtistPress,
        handleOpenTagManager,
        handleOpenPlaylistSelector,
        handleShare,
    } = usePlayerNavigation({
        track,
        album,
        artist,
        artists,
        currentCoverUrl,
        navigation,
    });

    // Gestures
    const {
        composedGesture,
        swipeAnimatedStyle,
        screenDismissAnimatedStyle,
        bgSwipeAnimatedStyle,
        dismissPanGesture,
    } = usePlayerGestures({
        hasNext,
        hasPrevious,
        isSheetOrModalOpen,
        isFocused,
        trackId: track.id,
        isNextBgIdentical,
        isPrevBgIdentical,
        onSkipNext: () => usePlayerStore.getState().skipToNext().catch(() => {}),
        onSkipPrevious: () => TrackPlayer.skipToPrevious().catch(() => {}),
        onDismiss: () => navigation.goBack(),
        onLongPress: handleMorePress,
        onTap: toggleImmersiveMode,
    });

    const artworkSource = useMemo(() =>
        currentCoverUrl ? { uri: currentCoverUrl } : null
    , [currentCoverUrl]);

    return (
        <GestureDetector gesture={dismissPanGesture}>
            <Animated.View
                ref={rootRef}
                collapsable={false}
                style={[
                    styles.container,
                    playerBackgroundStyle === 'gradient' && coverColor && { backgroundColor: finalBgColor },
                    screenDismissAnimatedStyle
                ]}
            >
                <PlayerBackground
                    width={width}
                    bgSwipeAnimatedStyle={bgSwipeAnimatedStyle}
                    prevTrackModel={prevTrackModel}
                    prevCoverUrl={prevCoverUrl}
                    track={track}
                    currentCoverUrl={currentCoverUrl}
                    nextTrackModel={nextTrackModel}
                    nextCoverUrl={nextCoverUrl}
                    showCanvas={showCanvas}
                    isImmersive={isImmersive}
                    isFocused={isFocused}
                    isTransitioning={isTransitioning}
                    playerBackgroundStyle={playerBackgroundStyle}
                    coverColor={coverColor}
                    topGradientColor={topGradientColor}
                    bottomGradientColor={bottomGradientColor}
                    prevCoverColor={prevCoverColor}
                    prevTopGradientColor={prevTopGradientColor}
                    prevBottomGradientColor={prevBottomGradientColor}
                    nextCoverColor={nextCoverColor}
                    nextTopGradientColor={nextTopGradientColor}
                    nextBottomGradientColor={nextBottomGradientColor}
                    backgroundColor={colors.background}
                />

                <View style={styles.safeArea}>
                    <PlayerHeader
                        marginTop={insets.top}
                        colors={colors}
                        t={t}
                        albumTitle={album?.title}
                        isImmersive={isImmersive}
                        onDismiss={() => navigation.goBack()}
                        onOpenPlayerMenu={openPlayerMenu}
                        onAlbumPress={handleAlbumPress}
                        onOpenTutorial={() => setIsTutorialVisible(true)}
                        onMorePress={handleMorePress}
                        visualizerButtonRef={visualizerButtonRef}
                        visualizerButtonLayout={visualizerButtonLayout}
                        moreButtonRef={moreButtonRef}
                        moreButtonLayout={moreButtonLayout}
                        styles={styles}
                        trackId={track.id}
                    />

                    <PlayerArtworkStage
                        artworkRef={artworkRef}
                        artworkLayout={artworkLayout}
                        onArtworkHeightMeasured={setMeasuredArtworkHeight}
                        measuredArtworkHeight={measuredArtworkHeight}
                        isAltDisplay={isAltDisplay}
                        isImmersive={isImmersive}
                        composedGesture={composedGesture}
                        swipeAnimatedStyle={swipeAnimatedStyle}
                        width={width}
                        prevTrackModel={prevTrackModel}
                        prevCoverUrl={prevCoverUrl}
                        showCanvas={showCanvas}
                        artworkSize={artworkSize}
                        radiiMd={radii.md || 10}
                        shadowsLg={shadows.lg}
                        cardBackgroundColor={colors.cardBackground}
                        textSecondaryColor={colors.textSecondary}
                        showPlayerVisualizer={showPlayerVisualizer}
                        playerVisualizerType={playerVisualizerType}
                        playerVisualizerColorMode={playerVisualizerColorMode}
                        currentCoverUrl={currentCoverUrl}
                        accentLightColor={colors.accentLight}
                        track={track}
                        playerCoverStyle={playerCoverStyle}
                        album={album}
                        spinStyle={spinStyle}
                        coverColor={coverColor}
                        nextTrackModel={nextTrackModel}
                        nextCoverUrl={nextCoverUrl}
                        shuffleOnQueueEnd={shuffleOnQueueEnd}
                        styles={styles}
                    />

                    {hasLyrics && (
                        <TouchableOpacity
                            activeOpacity={0.8}
                            disabled={isLocalCastActive}
                            onPress={() => navigation.navigate('Lyrics')}
                        >
                            <Animated.View style={[styles.lyricsContainer, lyricsAnimatedStyle]}>
                                <Animated.Text numberOfLines={2} style={[styles.lyricText, textAnimatedStyle]}>
                                    {activeLyricText}
                                </Animated.Text>
                            </Animated.View>
                        </TouchableOpacity>
                    )}

                    <PlayerInfoSection
                        track={track}
                        artist={artist}
                        artists={artists}
                        tags={tags}
                        showTagColors={showTagColors}
                        isAltDisplay={isAltDisplay}
                        artworkSource={artworkSource}
                        colors={colors}
                        t={t}
                        heartAnimatedStyle={heartAnimatedStyle}
                        infoContainerAnimatedStyle={infoContainerAnimatedStyle}
                        tagsRef={tagsRef}
                        tagsLayout={tagsLayout}
                        actionsRef={actionsRef}
                        actionsLayout={actionsLayout}
                        onArtistPress={handleArtistPress}
                        onLikePress={handleLikePress}
                        onOpenTagManager={handleOpenTagManager}
                        onOpenPlaylistSelector={handleOpenPlaylistSelector}
                        styles={styles}
                    />

                    <Animated.View
                        style={[bottomControlsAnimatedStyle]}
                        pointerEvents={isImmersive ? 'none' : 'auto'}
                    >
                        <PlayerProgressSection
                            isLocalCastActive={isLocalCastActive}
                            duration={duration}
                            displayPosition={displayPosition}
                            isSeeking={isSeeking}
                            seekValue={seekValue}
                            onSlidingStart={(value) => {
                                setIsSeeking(true);
                                setSeekValue(value);
                            }}
                            onValueChange={setSeekValue}
                            onSlidingComplete={(value) => {
                                setIsSeeking(false);
                                TrackPlayer.seekTo(value).catch(() => {});
                            }}
                            formatTimestamp={formatTimestamp}
                            colors={colors}
                            t={t}
                            styles={styles}
                        />

                        <PlayerControls
                            isShuffleEnabled={isShuffleEnabled}
                            hasPrevious={hasPrevious}
                            hasNext={hasNext}
                            position={position}
                            repeatMode={repeatMode}
                            colors={colors}
                            controlsRef={controlsRef}
                            controlsLayout={controlsLayout}
                            onToggleShuffle={toggleShuffle}
                            onSkipPrevious={() => {
                                if (position > SKIP_PREVIOUS_THRESHOLD) {
                                    TrackPlayer.seekTo(0).catch(() => {});
                                } else {
                                    TrackPlayer.skipToPrevious().catch(() => {});
                                }
                            }}
                            onSkipNext={() => usePlayerStore.getState().skipToNext().catch(() => {})}
                            onCycleRepeat={cycleRepeatMode}
                            styles={styles}
                        />

                        <PlayerFooter
                            insetsBottom={insets.bottom}
                            isServerRunning={isServerRunning}
                            isSleepTimerActive={isSleepTimerActive}
                            isSpeedPitchActive={isSpeedPitchActive}
                            isLocalCastActive={isLocalCastActive}
                            isChromecastConnected={isChromecastConnected}
                            isCasting={isCasting}
                            pointA={pointA}
                            pointB={pointB}
                            colors={colors}
                            onOpenSleepTimer={openSleepTimer}
                            onOpenSpeedPitch={openSpeedPitch}
                            onNavigateLyrics={() => navigation.navigate('Lyrics')}
                            onOpenCast={openLocalCast}
                            onABPress={() => handleABButtonPress(position)}
                            onABLongPress={handleABLongPress}
                            onShare={handleShare}
                            onOpenQueue={openQueueSheet}
                            sleepTimerRef={sleepTimerRef}
                            sleepTimerLayout={sleepTimerLayout}
                            speedRef={speedRef}
                            speedLayout={speedLayout}
                            lyricsRef={lyricsRef}
                            lyricsLayout={lyricsLayout}
                            castRef={castRef}
                            castLayout={castLayout}
                            abRepeatRef={abRepeatRef}
                            abRepeatLayout={abRepeatLayout}
                            shareRef={shareRef}
                            shareLayout={shareLayout}
                            queueRef={queueRef}
                            queueLayout={queueLayout}
                            styles={styles}
                        />
                    </Animated.View>
                </View>

                {/* Tutorial Contextual Spotlight de PlayerScreen */}
                <PlayerSpotlightTutorial
                    visible={isTutorialVisible}
                    onClose={handleCloseTutorial}
                    rootRef={rootRef}
                    moreButtonRef={moreButtonRef}
                    visualizerButtonRef={visualizerButtonRef}
                    artworkRef={artworkRef}
                    tagsRef={tagsRef}
                    actionsRef={actionsRef}
                    controlsRef={controlsRef}
                    sleepTimerRef={sleepTimerRef}
                    speedRef={speedRef}
                    lyricsRef={lyricsRef}
                    castRef={castRef}
                    abRepeatRef={abRepeatRef}
                    shareRef={shareRef}
                    queueRef={queueRef}
                    moreButtonLayout={moreButtonLayout}
                    visualizerButtonLayout={visualizerButtonLayout}
                    artworkLayout={artworkLayout}
                    tagsLayout={tagsLayout}
                    actionsLayout={actionsLayout}
                    controlsLayout={controlsLayout}
                    sleepTimerLayout={sleepTimerLayout}
                    speedLayout={speedLayout}
                    lyricsLayout={lyricsLayout}
                    castLayout={castLayout}
                    abRepeatLayout={abRepeatLayout}
                    shareLayout={shareLayout}
                    queueLayout={queueLayout}
                />
            </Animated.View>
        </GestureDetector>
    );
};

const ObservablePlayerScreenUI = withObservables(['trackModel'], ({ trackModel }) => ({
    track: trackModel.observe(),
    album: trackModel.album.observe().pipe(catchError(() => of(null))),
    artist: trackModel.artist.observe().pipe(catchError(() => of(null))),
    artists: trackModel.queryCollaborators.observe() as any,
    tags: trackModel.queryTags.observe(),
}))(PlayerScreenUI);

function KeepAwakeController() {
    useKeepAwake();
    return null;
}

const PlayerScreen = () => {
    const activeTrackModel = usePlayerStore(state => state.activeTrack);
    const hasNext = usePlayerStore(state => state.hasNext);
    const hasPrevious = usePlayerStore(state => state.hasPrevious);
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    const isKeepAwakeEnabled = useSettingsStore(state => state.isKeepAwakeEnabled);

    useEffect(() => {
        if (isFocused) {
            usePlayerStore.getState().syncWithTrackPlayer().catch(() => { });
        }
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active' && isFocused) {
                usePlayerStore.getState().syncWithTrackPlayer().catch(() => { });
            }
        });
        return () => {
            subscription.remove();
        };
    }, [isFocused]);

    if (!activeTrackModel) return null;

    if ((activeTrackModel as any).isExternal) {
        return (
            <>
                {isKeepAwakeEnabled && isFocused && <KeepAwakeController />}
                <PlayerScreenUI
                    track={activeTrackModel}
                    album={(activeTrackModel as any).albumObj || null}
                    artist={(activeTrackModel as any).artistObj || null}
                    artists={(activeTrackModel as any).artistsList || []}
                    tags={[]}
                    navigation={navigation}
                    formatTimestamp={formatTrackTime}
                    hasNext={hasNext}
                    hasPrevious={hasPrevious}
                    isFocused={isFocused}
                />
            </>
        );
    }

    return (
        <>
            {isKeepAwakeEnabled && isFocused && <KeepAwakeController />}
            <ObservablePlayerScreenUI
                trackModel={activeTrackModel}
                navigation={navigation}
                formatTimestamp={formatTrackTime}
                hasNext={hasNext}
                hasPrevious={hasPrevious}
                isFocused={isFocused}
            />
        </>
    );
};

const DEFAULT_PLAYER_SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
const DEFAULT_PLAYER_RADII = { sm: 4, md: 8, lg: 12, full: 9999 };
const DEFAULT_PLAYER_FONT_WEIGHTS = { regular: '400', semiBold: '600', bold: '700' };
const DEFAULT_PLAYER_SHADOWS = { lg: {} };

const getStyles = (
    {
        colors,
        fonts,
        layout,
        spacing = DEFAULT_PLAYER_SPACING,
        radii = DEFAULT_PLAYER_RADII,
        fontWeights = DEFAULT_PLAYER_FONT_WEIGHTS,
        shadows = DEFAULT_PLAYER_SHADOWS,
    }: any,
    artworkSize: number = width - 64
) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md || 16,
        height: 60,
    },
    dismissButton: {
        padding: spacing.xs || 4,
    },
    headerTitle: {
        color: colors.text,
        fontSize: 13,
        fontWeight: fontWeights.bold,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        fontFamily: fonts.regular,
        textAlign: 'center',
    },
    headerTextContainer: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: spacing.sm || 10,
    },
    artworkContainer: {
        flex: 1,
        width: width,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 0,
        paddingTop: spacing.md || 16,
        paddingBottom: spacing.sm || 8,
    },
    artwork: {
        width: artworkSize,
        height: artworkSize,
        borderRadius: radii.md || 10,
        backgroundColor: colors.cardBackground,
        ...shadows.lg,
    },
    artworkPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.cardBackground,
    },
    lyricsContainer: {
        width: '100%',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingHorizontal: 20,
        marginBottom: 12,
        overflow: 'hidden',
    },
    lyricText: {
        fontSize: 16,
        fontWeight: fontWeights.bold,
        color: colors.text,
        textAlign: 'left',
        textShadowColor: 'rgba(0, 0, 0, 0.6)',
        textShadowOffset: { width: 0, height: 1.5 },
        textShadowRadius: 4,
        fontFamily: fonts.regular,
    },
    miniArtwork: {
        width: 48,
        height: 48,
        borderRadius: radii.sm || 6,
        marginRight: 12,
        backgroundColor: colors.cardBackground,
    },
    infoContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 8,
    },
    infoTextContainer: {
        flex: 1,
        marginRight: 16,
    },
    infoActionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingBottom: 0,
    },
    actionButton: {
        padding: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tagsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
        minHeight: 24,
    },
    tagsScroll: {
        gap: 6,
    },
    tagBadge: {
        paddingHorizontal: spacing.sm || 8,
        paddingVertical: spacing.xs || 3,
        borderRadius: radii.sm || 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tagText: {
        color: colors.text,
        fontSize: 11,
        fontFamily: fonts.regular,
        fontWeight: fontWeights.bold,
    },
    addTagButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs || 4,
        paddingVertical: spacing.xs || 3,
    },
    addTagText: {
        color: colors.textSecondary,
        fontSize: 12,
        fontFamily: fonts.regular,
        fontWeight: fontWeights.bold,
    },
    title: {
        color: colors.text,
        fontSize: 26,
        fontWeight: fontWeights.bold,
        fontFamily: fonts.regular,
        marginBottom: spacing.xs || 4,
    },
    artist: {
        color: colors.textSecondary,
        fontSize: 16,
        fontFamily: fonts.regular,
        fontWeight: fontWeights.bold,
    },
    progressSection: {
        paddingHorizontal: 5,
        marginBottom: 5,
    },
    slider: {
        width: '100%',
        height: 40,
        marginVertical: -8,
    },
    timeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        marginTop: 4,
    },
    timeText: {
        color: colors.textSecondary,
        fontSize: 12,
        fontFamily: fonts.regular,
        fontWeight: fontWeights.bold,
    },
    castingRemoteBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        marginBottom: 8,
        borderRadius: radii.full || 9999,
        backgroundColor: colors.overlayAlpha10 || 'rgba(255,255,255,0.06)',
        alignSelf: 'center',
        gap: 8,
    },
    castingRemoteText: {
        fontSize: 12,
        fontFamily: fonts.regular,
        fontWeight: fontWeights.bold,
    },
    controlsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: 4,
        marginBottom: 10,
    },
    controlButton: {
        padding: 10,
    },
    mainControlButton: {
        padding: 10,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 13,
    },
    footerLeftGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    footerRightGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    footerButton: {
        padding: 8,
    },
    secondaryControlButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    moreButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    repeatOneBadge: {
        position: 'absolute',
        bottom: -4,
        right: -6,
        color: colors.accentLight,
        fontSize: 9,
        fontFamily: fonts.regular,
        fontWeight: fontWeights.bold,
    },
});

export default PlayerScreen;