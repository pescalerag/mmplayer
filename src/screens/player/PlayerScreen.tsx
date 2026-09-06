import BlurredBackground from '@/components/layouts/BlurredBackground';
import PlayerSpotlightTutorial from '@/components/modals/PlayerSpotlightTutorial';
import { openLocalCast, openPlayerMenu, openPlaylistSelector, openQueueSheet, openSleepTimer, openSpeedPitch, openTagManagerForTrack, openTrackMenu, useUIStore } from '@/store/useUIStore';
import { useTagFormStore } from '@/store/useTagFormStore';
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
import React, { useEffect, useState } from 'react';
import {
    AppState,
    AppStateStatus,
    Dimensions,
    InteractionManager,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TrackPlayer, {
    RepeatMode,
    State as TrackPlayerState,
    useProgress,
} from 'react-native-track-player';
import { usePlaybackState } from '../../hooks/usePlaybackState';
import { extractColorFromImage, NativeVisualizer } from '../../../modules/native-equalizer';

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
import { useAppTheme } from "@/hooks/useAppTheme";
import withObservables from '@nozbe/with-observables';
import * as Sharing from 'expo-sharing';
import { useTranslation } from 'react-i18next';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import Track from '../../database/models/Track';
import { useSyncedLyrics } from '../../hooks/useSyncedLyrics';
import { useABRepeatStore } from '../../store/useABRepeatStore';
import ABRepeatIcon from '@/components/player/ABRepeatIcon';
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
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
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
    } catch (e) {
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
    }, [isImmersive]);

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

let hasShownCustomizeHint = false;

const PlayerScreenUI = ({
    track, album, artist, artists, tags, navigation, formatTimestamp, hasNext, hasPrevious, isFocused
}: PlayerScreenUIProps) => {
    const { colors, fonts, layout, spacing, radii, fontWeights, shadows } = useAppTheme();
    const { t } = useTranslation();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout, spacing, radii, fontWeights, shadows), [colors, fonts, layout, spacing, radii, fontWeights, shadows]);
    const insets = useSafeAreaInsets();
    const openQueue = openQueueSheet;
    const isSleepTimerActive = useSleepTimerStore(state => state.isActive);
    const playbackSpeed = usePlayerStore(state => state.playbackSpeed);
    const playbackPitch = usePlayerStore(state => state.playbackPitch);
    const isSpeedPitchActive = playbackSpeed !== 1.0 || playbackPitch !== 1.0;

    const queueVersion = usePlayerStore(state => state.queueVersion);
    const windowVersion = usePlayerStore(state => state.windowVersion);

    const hasSeenPlayerTutorial = useSettingsStore(state => state.hasSeenPlayerTutorial);
    const setHasSeenPlayerTutorial = useSettingsStore(state => state.setHasSeenPlayerTutorial);
    const [isTutorialVisible, setIsTutorialVisible] = useState(false);

    const activeSheet = useUIStore(state => state.activeSheet);
    const isTagFormVisible = useTagFormStore(state => state.isVisible);
    const isSheetOrModalOpen = activeSheet !== null || isTagFormVisible || isTutorialVisible;

    useEffect(() => {
        if (isFocused && !hasSeenPlayerTutorial) {
            setIsTutorialVisible(true);
        }
    }, [isFocused, hasSeenPlayerTutorial]);

    const handleCloseTutorial = () => {
        setIsTutorialVisible(false);
        if (!hasSeenPlayerTutorial) {
            setHasSeenPlayerTutorial(true);
        }
    };

    const rootRef = React.useRef<View>(null);
    const moreButtonRef = React.useRef<View>(null);
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

    // Estado para las canciones previa y siguiente
    const [prevTrackModel, setPrevTrackModel] = useState<Track | null>(null);
    const [nextTrackModel, setNextTrackModel] = useState<Track | null>(null);

    // Sincronización continua de canciones adyacentes
    useEffect(() => {
        let isMounted = true;
        const syncAdjacentTracks = async () => {
            try {
                const queue = await TrackPlayer.getQueue();
                const activeIndex = await TrackPlayer.getActiveTrackIndex();
                if (activeIndex === undefined || activeIndex === null || queue.length === 0) {
                    if (isMounted) {
                        setPrevTrackModel(null);
                        setNextTrackModel(null);
                    }
                    return;
                }

                let prevM: Track | null = null;
                if (activeIndex > 0) {
                    const prevTP = queue[activeIndex - 1];
                    if (prevTP?.id) {
                        const cleanId = prevTP.id.toString().split('-')[0];
                        prevM = await database.get<Track>('tracks').find(cleanId).catch(() => null);
                    }
                }

                let nextM: Track | null = null;
                if (activeIndex < queue.length - 1) {
                    const nextTP = queue[activeIndex + 1];
                    if (nextTP?.id) {
                        const cleanId = nextTP.id.toString().split('-')[0];
                        nextM = await database.get<Track>('tracks').find(cleanId).catch(() => null);
                    }
                }

                if (isMounted) {
                    setPrevTrackModel(prevM);
                    setNextTrackModel(nextM);
                }
            } catch (e) {
                console.error("Error sincronizando canciones adyacentes en PlayerScreen:", e);
            }
        };

        syncAdjacentTracks();

        return () => { isMounted = false; };
    }, [track.id, queueVersion, windowVersion]);

    const [prevCoverUrl, setPrevCoverUrl] = useState<string | null>(null);
    const [nextCoverUrl, setNextCoverUrl] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        if (prevTrackModel) {
            prevTrackModel.album.fetch().then((alb: any) => {
                if (isMounted) setPrevCoverUrl(alb?.coverUrl || null);
            }).catch(() => { if (isMounted) setPrevCoverUrl(null); });
        } else {
            setPrevCoverUrl(null);
        }
        return () => { isMounted = false; };
    }, [prevTrackModel]);

    useEffect(() => {
        let isMounted = true;
        if (nextTrackModel) {
            nextTrackModel.album.fetch().then((alb: any) => {
                if (isMounted) setNextCoverUrl(alb?.coverUrl || null);
            }).catch(() => { if (isMounted) setNextCoverUrl(null); });
        } else {
            setNextCoverUrl(null);
        }
        return () => { isMounted = false; };
    }, [nextTrackModel]);

    const [isTransitioning, setIsTransitioning] = React.useState(false);

    // ── Shared values for swipe gesture (worklet-safe, no stale closures) ─────────────────────────────
    // panGesture runs in a Reanimated worklet and cannot safely read React state via
    // closure — the value freezes at render time. Using shared values ensures the
    // worklet always sees the current value even after drag reorders update the store.
    const hasNextShared = useSharedValue(hasNext);
    const hasPreviousShared = useSharedValue(hasPrevious);
    useEffect(() => { hasNextShared.value = hasNext; }, [hasNext, hasNextShared]);
    useEffect(() => { hasPreviousShared.value = hasPrevious; }, [hasPrevious, hasPreviousShared]);

    React.useEffect(() => {
        if (!isFocused) {
            setIsTransitioning(false);
            return;
        }

        setIsTransitioning(true);

        const unsubscribeEnd = navigation.addListener('transitionEnd', () => {
            setIsTransitioning(false);
        });

        const task = InteractionManager.runAfterInteractions(() => {
            setIsTransitioning(false);
        });

        const timeout = setTimeout(() => {
            setIsTransitioning(false);
        }, 600);

        return () => {
            unsubscribeEnd();
            task.cancel();
            clearTimeout(timeout);
        };
    }, [isFocused, navigation]);
    const { position, duration } = useProgress();
    const showTagColors = useSettingsStore(state => state.showTagColors);
    const showPlayerVisualizer = useSettingsStore(state => state.showPlayerVisualizer);
    const playerVisualizerType = useSettingsStore(state => state.playerVisualizerType);
    const playerVisualizerColorMode = useSettingsStore(state => state.playerVisualizerColorMode);
    const playerCoverStyle = useSettingsStore(state => state.playerCoverStyle);
    const playerBackgroundStyle = useSettingsStore(state => state.playerBackgroundStyle);
    const showCanvas = useSettingsStore(state => state.showCanvas);
    const showPlayerLyrics = useSettingsStore(state => state.showPlayerLyrics);

    const isServerRunning = useCastStore(state => state.isServerRunning);
    const isLocalCastActive = useCastStore(state => state.isLocalCastActive);
    const isChromecastConnected = useCastStore(state => state.isChromecastConnected);
    const isCasting = isLocalCastActive || isChromecastConnected;
    const openCastSheet = openLocalCast;

    const { parsedLyrics, activeIndex, isSynced } = useSyncedLyrics(track);
    const hasLyrics = !isLocalCastActive && showPlayerLyrics && isSynced && parsedLyrics.length > 0;
    const currentPhrase = hasLyrics && activeIndex >= 0 && activeIndex < parsedLyrics.length
        ? parsedLyrics[activeIndex].text
        : '';

    const isAltDisplay = showPlayerVisualizer || playerCoverStyle === 'cd' || playerCoverStyle === 'vinyl' || (showCanvas && !!track.bgVideo);

    const pointA = useABRepeatStore(state => state.pointA);
    const pointB = useABRepeatStore(state => state.pointB);
    const handleABButtonPress = useABRepeatStore(state => state.handleButtonPress);
    const handleABLongPress = useABRepeatStore(state => state.handleLongPress);

    const artworkSource = React.useMemo(() =>
        album?.coverUrl ? { uri: album.coverUrl } : null
        , [album?.coverUrl]);

    const [coverColor, setCoverColor] = useState<string | null>(null);

    const { finalBgColor, topGradientColor, bottomGradientColor } = React.useMemo(() => {
        if (coverColor) {
            const grads = generateDarkGradients(coverColor, colors.background);
            return {
                finalBgColor: grads.backgroundSolid,
                topGradientColor: grads.topGradient,
                bottomGradientColor: grads.bottomGradient,
            };
        }
        return {
            finalBgColor: colors.background,
            topGradientColor: colors.background,
            bottomGradientColor: colors.background,
        };
    }, [coverColor, colors.background]);

    useEffect(() => {
        let isMounted = true;
        if (!album?.coverUrl) {
            setCoverColor(null);
            return;
        }

        extractColorFromImage(album.coverUrl)
            .then(color => {
                if (isMounted) {
                    setCoverColor(color);
                }
            })
            .catch(err => {
                console.error("Error extracting cover color in PlayerScreen:", err);
                if (isMounted) {
                    setCoverColor(null);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [album?.coverUrl]);

    const isShuffleEnabled = usePlayerStore(state => state.isShuffleEnabled);

    // Seeking state
    const [isSeeking, setIsSeeking] = useState(false);
    const [seekValue, setSeekValue] = useState(0);

    const displayPosition = isSeeking ? seekValue : position;

    // Repeat mode
    const [repeatMode, setRepeatModeState] = useState<RepeatMode>(RepeatMode.Off);

    // Like Heart Animation
    const heartScale = useSharedValue(1);

    const heartAnimatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: heartScale.value }]
        };
    });

    // Swipe Gestures
    const translateX = useSharedValue(0);
    const hasTriggeredHaptic = useSharedValue(false);

    // RESET TRANSPARENTE: Cuando la canción cambia en React, reseteamos translateX a 0 sin saltos visuales
    useEffect(() => {
        translateX.value = 0;
    }, [track.id, translateX]);

    // CD / Vinyl spin animation
    const spinDeg = useSharedValue(0);
    const playbackState = usePlaybackState();
    const isPlaying = playbackState.state === TrackPlayerState.Playing;

    React.useEffect(() => {
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
    }, [playerCoverStyle, isPlaying]);

    const spinStyle = useAnimatedStyle(() => ({
        transform: [{ rotateZ: `${spinDeg.value}deg` }],
    }));

    const [isImmersive, setIsImmersive] = useState(false);
    const toggleImmersiveMode = () => {
        if (showCanvas && !!track.bgVideo) {
            setIsImmersive(prev => !prev);
        }
    };

    useEffect(() => {
        if (!showCanvas || !track.bgVideo) {
            setIsImmersive(false);
        }
    }, [track.bgVideo, showCanvas]);

    const longPressHintOpacity = useSharedValue(0);
    useEffect(() => {
        if (isFocused && !isTransitioning && playerCoverStyle === 'cover' && !hasShownCustomizeHint) {
            hasShownCustomizeHint = true;
            longPressHintOpacity.value = withSequence(
                withTiming(1, { duration: 600 }),
                withDelay(1500, withTiming(0, { duration: 800 }))
            );
        } else {
            longPressHintOpacity.value = 0;
        }
    }, [isFocused, isTransitioning, playerCoverStyle]);

    const longPressHintStyle = useAnimatedStyle(() => ({
        opacity: longPressHintOpacity.value
    }));

    const lyricsShift = useSharedValue(0);
    useEffect(() => {
        lyricsShift.value = withTiming(hasLyrics && !isImmersive ? -10 : 0, {
            duration: 300,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1.0)
        });
    }, [hasLyrics, isImmersive, lyricsShift]);

    const lyricsHeight = useSharedValue(hasLyrics ? 46 : 0);
    const lyricsOpacity = useSharedValue(hasLyrics ? 1 : 0);
    useEffect(() => {
        lyricsHeight.value = withSpring(hasLyrics ? 46 : 0, { damping: 15 });
        lyricsOpacity.value = withTiming(hasLyrics ? 1 : 0, { duration: 300 });
    }, [hasLyrics, lyricsHeight, lyricsOpacity]);

    const lyricsAnimatedStyle = useAnimatedStyle(() => ({
        height: lyricsHeight.value,
        opacity: lyricsOpacity.value,
    }));

    const [displayedPhrase, setDisplayedPhrase] = useState(currentPhrase);
    const lyricTextOpacity = useSharedValue(hasLyrics && currentPhrase.trim() !== '' ? 1 : 0);
    const prevTrackIdRef = React.useRef(track.id);

    useEffect(() => {
        // Caso 1: Cambio de canción
        if (prevTrackIdRef.current !== track.id) {
            prevTrackIdRef.current = track.id;
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
            // Guardián de seguridad: si la frase no está vacía pero la opacidad se quedó en 0
            if (displayedPhrase.trim() !== '' && lyricTextOpacity.value < 0.9) {
                lyricTextOpacity.value = withTiming(1, { duration: 150 });
            }
            return;
        }

        // Caso 4: Transición hacia silencio o instrumental (frase vacía)
        if (currentPhrase.trim() === '') {
            lyricTextOpacity.value = withTiming(0, { duration: 150 }, (finished) => {
                if (finished) {
                    runOnJS(setDisplayedPhrase)('');
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

        // Caso 6: Transición normal de frase A a frase B (entre línea y línea) -> Sin animación de fade
        cancelAnimation(lyricTextOpacity);
        setDisplayedPhrase(currentPhrase);
        lyricTextOpacity.value = 1;
    }, [track.id, showPlayerLyrics, hasLyrics, currentPhrase, displayedPhrase, isFocused, lyricTextOpacity]);

    const activeLyricText = currentPhrase.trim() !== '' ? currentPhrase : displayedPhrase;

    const textAnimatedStyle = useAnimatedStyle(() => ({
        opacity: lyricTextOpacity.value,
    }));

    const immersiveProgress = useSharedValue(0);

    useEffect(() => {
        immersiveProgress.value = withTiming(isImmersive ? 1 : 0, {
            duration: 350,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1.0),
        });
    }, [isImmersive]);

    const bottomControlsAnimatedStyle = useAnimatedStyle(() => {
        return {
            opacity: 1 - immersiveProgress.value,
            transform: [
                { translateY: immersiveProgress.value * 60 }
            ],
            maxHeight: (1 - immersiveProgress.value) * 270,
            overflow: 'hidden',
        };
    });

    const infoContainerAnimatedStyle = useAnimatedStyle(() => {
        return {
            marginBottom: 8 + immersiveProgress.value * (insets.bottom + 62),
        };
    });

    const triggerHaptic = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const performSkipNext = async () => {
        try {
            await TrackPlayer.skipToNext();
            // Immediately bump windowVersion so adjacent slots in the swipe view refresh
            // without waiting for the full PlaybackActiveTrackChanged event chain
            usePlayerStore.setState((s: any) => ({ windowVersion: (s.windowVersion || 0) + 1 }));
        } catch (e) {
            translateX.value = withSpring(0, { damping: 25, stiffness: 120 });
        }
    };

    const performSkipPrevious = async () => {
        try {
            await TrackPlayer.skipToPrevious();
            usePlayerStore.setState((s: any) => ({ windowVersion: (s.windowVersion || 0) + 1 }));
        } catch (e) {
            translateX.value = withSpring(0, { damping: 25, stiffness: 120 });
        }
    };

    // Derive hasNext/hasPrevious from the live queue at gesture time (not the potentially
    // stale Zustand values) so swipe is never blocked after a drag reorder.
    const getCanSkipNext = React.useCallback(async () => {
        try {
            const queue = await TrackPlayer.getQueue();
            const idx = await TrackPlayer.getActiveTrackIndex();
            if (idx === undefined || idx === null) return false;
            return idx < queue.length - 1;
        } catch { return hasNext; }
    }, [hasNext]);

    const getCanSkipPrevious = React.useCallback(async () => {
        try {
            const idx = await TrackPlayer.getActiveTrackIndex();
            if (idx === undefined || idx === null) return false;
            return idx > 0;
        } catch { return hasPrevious; }
    }, [hasPrevious]);

    const panGesture = Gesture.Pan()
        .enabled(!isSheetOrModalOpen)
        .activeOffsetX([-10, 10])
        .failOffsetY([-35, 35])
        .onUpdate((event) => {
            let tx = event.translationX;

            // Block left swipe if there is no next track
            if (!hasNextShared.value && tx < 0) {
                tx = 0;
            }

            // Block right swipe if there is no previous track
            if (!hasPreviousShared.value && tx > 0) {
                tx = 0;
            }

            translateX.value = tx;

            if (Math.abs(translateX.value) > 100 && !hasTriggeredHaptic.value) {
                hasTriggeredHaptic.value = true;
                runOnJS(triggerHaptic)();
            } else if (Math.abs(translateX.value) <= 100) {
                hasTriggeredHaptic.value = false;
            }
        })
        .onEnd((event) => {
            const SWIPE_THRESHOLD = width * 0.25;
            const velocityX = event.velocityX;

            if ((translateX.value < -SWIPE_THRESHOLD || velocityX < -400) && hasNextShared.value) {
                // Animate off-screen and call skip. translateX resets to 0 when track.id changes.
                translateX.value = withTiming(-width, { duration: 220 }, (finished) => {
                    if (finished) {
                        runOnJS(performSkipNext)();
                    }
                });
            } else if ((translateX.value > SWIPE_THRESHOLD || velocityX > 400) && hasPreviousShared.value) {
                translateX.value = withTiming(width, { duration: 220 }, (finished) => {
                    if (finished) {
                        runOnJS(performSkipPrevious)();
                    }
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
            runOnJS(triggerHaptic)();
            runOnJS(openPlayerMenu)();
        });

    const tapGesture = Gesture.Tap()
        .enabled(!isSheetOrModalOpen)
        .numberOfTaps(1)
        .onStart(() => {
            runOnJS(toggleImmersiveMode)();
        });

    const composedGesture = Gesture.Race(
        panGesture,
        Gesture.Exclusive(longPressGesture, tapGesture)
    );

    const screenHeight = Dimensions.get('window').height;
    const dismissTranslateY = useSharedValue(0);

    useEffect(() => {
        if (isFocused) {
            dismissTranslateY.value = 0;
        }
    }, [isFocused, track.id, dismissTranslateY]);

    useEffect(() => {
        if (isSheetOrModalOpen) {
            dismissTranslateY.value = 0;
        }
    }, [isSheetOrModalOpen, dismissTranslateY]);

    const performGoBack = React.useCallback(() => {
        navigation.goBack();
    }, [navigation]);

    const dismissPanGesture = Gesture.Pan()
        .enabled(!isSheetOrModalOpen)
        .activeOffsetY(15)
        .failOffsetX([-25, 25])
        .onUpdate((event) => {
            if (event.translationY > 0) {
                dismissTranslateY.value = event.translationY;
            } else {
                dismissTranslateY.value = 0;
            }
        })
        .onEnd((event) => {
            const DISMISS_THRESHOLD = screenHeight * 0.18;
            if (event.translationY > DISMISS_THRESHOLD || event.velocityY > 500) {
                dismissTranslateY.value = withTiming(screenHeight, { duration: 200 }, (finished) => {
                    if (finished) {
                        runOnJS(performGoBack)();
                    }
                });
            } else {
                dismissTranslateY.value = withSpring(0, { damping: 25, stiffness: 150 });
            }
        });

    const screenDismissAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: dismissTranslateY.value }],
    }));

    const swipeAnimatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: translateX.value },
                { translateY: lyricsShift.value }
            ]
        };
    });

    const handleLikePress = async () => {
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
    };

    useEffect(() => {
        TrackPlayer.getRepeatMode().then(setRepeatModeState).catch(() => { });
    }, []);

    const toggleShuffle = () => usePlayerStore.getState().toggleShuffle();

    const cycleRepeatMode = async () => {
        try {
            const next =
                repeatMode === RepeatMode.Off ? RepeatMode.Queue :
                    repeatMode === RepeatMode.Queue ? RepeatMode.Track :
                        RepeatMode.Off;
            await TrackPlayer.setRepeatMode(next);
            setRepeatModeState(next);
            await usePlayerStore.getState().updateQueueStatus();
        } catch (e) {
            console.error('Error cycling repeat mode:', e);
        }
    };

    const handleAlbumPress = () => {
        if (album?.id) {
            navigation.navigate('AlbumDetail', { albumId: album.id });
        }
    };

    const handleMorePress = () => {
        openTrackMenu(track, {
            album: (albumId: string) => {
                navigation.navigate('AlbumDetail', { albumId });
            },
            artist: (artistId: string) => {
                navigation.navigate('ArtistDetail', { artistId });
            },
        });
    };

    const handleArtistPress = () => {
        if (artists && artists.length > 1) {
            useArtistsListSheetStore.getState().openSheet(artists);
        } else {
            const targetArtistId = artists && artists.length > 0 ? artists[0].id : artist?.id;
            if (!targetArtistId) return;
            navigation.navigate('ArtistDetail', { artistId: targetArtistId });
        }
    };

    const handleOpenTagManager = React.useCallback(() => {
        openTagManagerForTrack(track);
    }, [track]);

    const handleOpenPlaylistSelector = React.useCallback(() => {
        openPlaylistSelector(track);
    }, [track]);

    const handleShare = React.useCallback(() => {
        if (!track?.fileUrl) return;
        navigation.navigate('ShareSong', {
            trackId: track.id,
            title: track.title,
            artist: artist?.name || '',
            album: album?.title || '',
            coverUrl: album?.coverUrl || null,
            fileUrl: track.fileUrl,
            duration: track.duration,
        });
    }, [track, artist, album, navigation]);

    const [imageError, setImageError] = React.useState(false);

    React.useEffect(() => {
        setImageError(false);
    }, [track.id]);

    const currBgVideo = (showCanvas && !!track.bgVideo) ? track.bgVideo : null;
    const prevBgVideo = (showCanvas && !!prevTrackModel?.bgVideo) ? prevTrackModel.bgVideo : null;
    const nextBgVideo = (showCanvas && !!nextTrackModel?.bgVideo) ? nextTrackModel.bgVideo : null;

    const currCover = album?.coverUrl || null;

    const isPrevBgIdentical = React.useMemo(() => {
        if (!prevTrackModel) return true;
        if (currBgVideo !== prevBgVideo) return false;
        return currCover === prevCoverUrl;
    }, [prevTrackModel, currBgVideo, prevBgVideo, currCover, prevCoverUrl]);

    const isNextBgIdentical = React.useMemo(() => {
        if (!nextTrackModel) return true;
        if (currBgVideo !== nextBgVideo) return false;
        return currCover === nextCoverUrl;
    }, [nextTrackModel, currBgVideo, nextBgVideo, currCover, nextCoverUrl]);

    const bgSwipeAnimatedStyle = useAnimatedStyle(() => {
        let tx = translateX.value;
        if (tx < 0 && isNextBgIdentical) {
            tx = 0;
        } else if (tx > 0 && isPrevBgIdentical) {
            tx = 0;
        }
        return {
            transform: [
                { translateX: tx }
            ]
        };
    });

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
            {/* 3-Slot Sliding Background Stage Container */}
            <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                <Animated.View style={[
                    bgSwipeAnimatedStyle,
                    {
                        width: width,
                        height: '100%',
                    }
                ]}>
                    {/* Background Slot -1: Previous Track (-width) */}
                    <View style={{
                        position: 'absolute',
                        left: -width,
                        width: width,
                        height: '100%',
                        overflow: 'hidden',
                    }}>
                        {prevTrackModel && showCanvas && !!prevTrackModel.bgVideo ? (
                            <CanvasVideo
                                key={`bg-canvas-prev-${prevTrackModel.id}-${prevTrackModel.bgVideo}-${windowVersion}`}
                                sourceUri={prevTrackModel.bgVideo}
                                isImmersive={false}
                                gradientColors={['rgba(0,0,0,0.10)', 'rgba(0,0,0,0.72)', 'rgba(0,0,0,0.97)']}
                            />
                        ) : (
                            <BlurredBackground
                                key={`blur-prev-${prevTrackModel?.id || 'none'}-${windowVersion}`}
                                imageUrl={prevCoverUrl}
                                blurIntensity={10}
                                gradientColors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)', colors.background]}
                            />
                        )}
                    </View>

                    {/* Background Slot 0: Active Track (Center 0) */}
                    <View style={{
                        width: width,
                        height: '100%',
                        overflow: 'hidden',
                    }}>
                        {isFocused && !isTransitioning && showCanvas && !!track.bgVideo ? (
                            <CanvasVideo
                                key={`bg-canvas-curr-${track.id}-${track.bgVideo}`}
                                sourceUri={track.bgVideo}
                                isImmersive={isImmersive}
                                gradientColors={['rgba(0,0,0,0.10)', 'rgba(0,0,0,0.72)', 'rgba(0,0,0,0.97)']}
                            />
                        ) : (
                            <BlurredBackground
                                key={`blur-curr-${track.id}`}
                                imageUrl={album?.coverUrl}
                                blurIntensity={10}
                                gradientColors={
                                    playerBackgroundStyle === 'gradient' && coverColor
                                        ? [topGradientColor, bottomGradientColor, bottomGradientColor]
                                        : ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)', colors.background]
                                }
                            />
                        )}
                    </View>

                    {/* Background Slot +1: Next Track (+width) */}
                    <View style={{
                        position: 'absolute',
                        left: width,
                        width: width,
                        height: '100%',
                        overflow: 'hidden',
                    }}>
                        {nextTrackModel && showCanvas && !!nextTrackModel.bgVideo ? (
                            <CanvasVideo
                                key={`bg-canvas-next-${nextTrackModel.id}-${nextTrackModel.bgVideo}-${windowVersion}`}
                                sourceUri={nextTrackModel.bgVideo}
                                isImmersive={false}
                                gradientColors={['rgba(0,0,0,0.10)', 'rgba(0,0,0,0.72)', 'rgba(0,0,0,0.97)']}
                            />
                        ) : (
                            <BlurredBackground
                                key={`blur-next-${nextTrackModel?.id || 'none'}-${windowVersion}`}
                                imageUrl={nextCoverUrl}
                                blurIntensity={10}
                                gradientColors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)', colors.background]}
                            />
                        )}
                    </View>
                </Animated.View>
            </View>

            <View style={styles.safeArea}>
                {/* Header */}
                <View style={[styles.header, { marginTop: insets.top }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.dismissButton}>
                        <Ionicons name="chevron-down" size={32} color={colors.text} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.headerTextContainer}
                        onPress={handleAlbumPress}
                    >
                        <MarqueeText
                            text={album?.title || t('actions.unknown')}
                            style={styles.headerTitle}
                            speed={35}
                            pauseDuration={2000}
                        />
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity
                            onPress={() => setIsTutorialVisible(true)}
                            style={styles.moreButton}
                            accessibilityLabel={t('player_tutorial.help_btn')}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="help-circle-outline" size={24} color={colors.text} />
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
                                onPress={handleMorePress}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Artwork / Visualizer / CD / Vinyl Container */}
                <View
                    ref={artworkRef}
                    collapsable={false}
                    onLayout={(e) => {
                        artworkLayout.current = e.nativeEvent.layout;
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
                                width: width,
                                height: '100%',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }
                        ]}>
                            {/* Slot -1: Previous Track (-width) */}
                            <View style={{
                                position: 'absolute',
                                left: -width,
                                width: width,
                                height: '100%',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }} pointerEvents="none">
                                {(() => {
                                    if (!prevTrackModel) {
                                        return (
                                            <View style={[styles.artwork, styles.artworkPlaceholder]}>
                                                <Ionicons name="musical-notes" size={80} color={colors.textSecondary} />
                                            </View>
                                        );
                                    }
                                    if (showCanvas && !!prevTrackModel.bgVideo) {
                                        return <View style={{ width: width - 64, height: width - 64 }} />;
                                    }
                                    const formattedUri = prevCoverUrl
                                        ? (prevCoverUrl.startsWith('file://') && !prevCoverUrl.includes('?t=') ? `${prevCoverUrl}?t=${Date.now()}` : prevCoverUrl)
                                        : null;
                                    if (formattedUri) {
                                        return (
                                            <View style={{ position: 'relative', width: width - 64, height: width - 64 }}>
                                                <Image
                                                    key={`prev-${prevTrackModel.id}-${windowVersion}`}
                                                    source={{ uri: formattedUri }}
                                                    style={styles.artwork}
                                                    contentFit="cover"
                                                    transition={200}
                                                    cachePolicy="memory-disk"
                                                />
                                            </View>
                                        );
                                    }
                                    return (
                                        <View style={[styles.artwork, styles.artworkPlaceholder]}>
                                            <Ionicons name="musical-notes" size={80} color={colors.textSecondary} />
                                        </View>
                                    );
                                })()}
                            </View>

                            {/* Slot 0: Active Track (Center 0) */}
                            <View style={{
                                width: width,
                                height: '100%',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}>
                                {isImmersive ? (
                                    <View style={StyleSheet.absoluteFillObject} />
                                ) : showPlayerVisualizer ? (
                                    <NativeVisualizer
                                        active={true}
                                        type={playerVisualizerType}
                                        color={playerVisualizerColorMode === 'cover' ? 'cover' : colors.accentLight || '#8B5CF6'}
                                        coverUrl={album?.coverUrl || undefined}
                                        style={{
                                            width: '100%',
                                            height: 240,
                                            backgroundColor: 'transparent',
                                        }}
                                    />
                                ) : (showCanvas && !!track.bgVideo) ? (
                                    <View style={{ width: width - 64, height: width - 64 }} />
                                ) : playerCoverStyle === 'cd' || playerCoverStyle === 'vinyl' ? (
                                    <View style={{
                                        width: width - 64,
                                        height: width - 64,
                                        alignSelf: 'center',
                                        position: 'relative'
                                    }}>
                                        {playerCoverStyle === 'cd' ? (
                                            album?.cdArtUrl ? (
                                                <>
                                                    <MaskedView
                                                        style={StyleSheet.absoluteFillObject}
                                                        maskElement={
                                                            <View style={{
                                                                width: width - 64,
                                                                height: width - 64,
                                                                borderRadius: (width - 64) / 2,
                                                                borderWidth: ((width - 64) - 35) / 2,
                                                                borderColor: 'black',
                                                                backgroundColor: 'transparent',
                                                            }} />
                                                        }
                                                    >
                                                        <Animated.View style={[{ width: '100%', height: '100%' }, spinStyle]}>
                                                            <Image
                                                                source={{ uri: album?.cdArtUrl || undefined }}
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
                                                </>
                                            ) : (
                                                <Animated.View style={[{ width: '100%', height: '100%' }, spinStyle]}>
                                                    <Image
                                                        source={require('../../assets/cd-base.svg')}
                                                        style={{ width: '100%', height: '100%' }}
                                                        contentFit="contain"
                                                    />
                                                </Animated.View>
                                            )
                                        ) : (
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
                                                            borderRadius: (width - 64) / 2,
                                                            backgroundColor: coverColor,
                                                            opacity: 0.25,
                                                        }}
                                                        pointerEvents="none"
                                                    />
                                                )}
                                            </Animated.View>
                                        )}
                                    </View>
                                ) : (
                                    artworkSource && !imageError ? (
                                        <View style={{ position: 'relative', width: width - 64, height: width - 64 }}>
                                            <Image
                                                key={track.id}
                                                source={artworkSource}
                                                style={styles.artwork}
                                                contentFit="cover"
                                                transition={300}
                                                cachePolicy="memory-disk"
                                                onError={() => setImageError(true)}
                                            />
                                        </View>
                                    ) : (
                                        <View style={[styles.artwork, styles.artworkPlaceholder]}>
                                            <Ionicons name="musical-notes" size={80} color={colors.textSecondary} />
                                        </View>
                                    )
                                )}
                            </View>

                            {/* Slot +1: Next Track (+width) */}
                            <View style={{
                                position: 'absolute',
                                left: width,
                                width: width,
                                height: '100%',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }} pointerEvents="none">
                                {(() => {
                                    if (!nextTrackModel) {
                                        return (
                                            <View style={[styles.artwork, styles.artworkPlaceholder]}>
                                                <Ionicons name="musical-notes" size={80} color={colors.textSecondary} />
                                            </View>
                                        );
                                    }
                                    if (showCanvas && !!nextTrackModel.bgVideo) {
                                        return <View style={{ width: width - 64, height: width - 64 }} />;
                                    }
                                    const formattedUri = nextCoverUrl
                                        ? (nextCoverUrl.startsWith('file://') && !nextCoverUrl.includes('?t=') ? `${nextCoverUrl}?t=${Date.now()}` : nextCoverUrl)
                                        : null;
                                    if (formattedUri) {
                                        return (
                                            <View style={{ position: 'relative', width: width - 64, height: width - 64 }}>
                                                <Image
                                                    key={`next-${nextTrackModel.id}-${windowVersion}`}
                                                    source={{ uri: formattedUri }}
                                                    style={styles.artwork}
                                                    contentFit="cover"
                                                    transition={200}
                                                    cachePolicy="memory-disk"
                                                />
                                            </View>
                                        );
                                    }
                                    return (
                                        <View style={[styles.artwork, styles.artworkPlaceholder]}>
                                            <Ionicons name="musical-notes" size={80} color={colors.textSecondary} />
                                        </View>
                                    );
                                })()}
                            </View>
                        </Animated.View>
                    </GestureDetector>
                    {!isImmersive && (
                        <Animated.View
                            pointerEvents="none"
                            style={[
                                {
                                    position: 'absolute',
                                    backgroundColor: 'rgba(0, 0, 0, 0.35)',
                                    paddingHorizontal: 50,
                                    paddingVertical: 8,
                                    borderRadius: 20,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 8,
                                },
                                longPressHintStyle
                            ]}
                        >
                            <Ionicons name="color-palette-outline" size={16} color="#FFFFFF" />
                            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600', fontFamily: fonts.regular }}>
                                {t('actions.longPressCoverToCustomize')}
                            </Text>
                        </Animated.View>
                    )}
                </View>

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

                {/* Info */}
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
                                    {tags.map(t => (
                                        <TouchableOpacity
                                            key={t.id}
                                            style={[styles.tagBadge, { backgroundColor: showTagColors ? t.color : colors.overlayAlpha08 }]}
                                            onPress={handleOpenTagManager}
                                        >
                                            <Text style={[styles.tagText, { color: showTagColors ? getDynamicTagTextColor(t.color) : colors.text }]}>{t.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            ) : (
                                <TouchableOpacity
                                    style={styles.addTagButton}
                                    onPress={handleOpenTagManager}
                                >
                                    <Ionicons name="add-circle-outline" size={14} color={colors.textSecondary} />
                                    <Text style={styles.addTagText}>{t('actions.add_tag')}</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Title & Artist row with optional mini cover */}
                        <View style={isAltDisplay ? { flexDirection: 'row', alignItems: 'center' } : null}>
                            {isAltDisplay && artworkSource && !imageError && (
                                <Image
                                    key={`mini-${track.id}`}
                                    source={artworkSource}
                                    style={styles.miniArtwork}
                                    contentFit="cover"
                                    cachePolicy="memory-disk"
                                />
                            )}
                            <View style={isAltDisplay ? { flex: 1 } : null}>
                                <MarqueeText
                                    text={track.title}
                                    style={styles.title}
                                    speed={45}
                                    pauseDuration={1800}
                                />
                                <TouchableOpacity
                                    onPress={handleArtistPress}
                                >
                                    <MarqueeText
                                        text={artists && artists.length > 0 ? artists.map(a => a.name).join(', ') : (artist?.name || t('actions.unknown'))}
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
                                onPress={handleLikePress}
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
                            onPress={handleOpenPlaylistSelector}
                            style={styles.actionButton}
                            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        >
                            <Ionicons name="add" size={28} color={colors.text} />
                        </TouchableOpacity>
                    </View>
                </Animated.View>

                {/* Animated Bottom Controls Group */}
                <Animated.View
                    style={[bottomControlsAnimatedStyle]}
                    pointerEvents={isImmersive ? 'none' : 'auto'}
                >
                    {/* Progress Slider or Cast Remote Indicator */}
                    {isLocalCastActive ? (
                        <View style={styles.castingRemoteBanner}>
                            <Ionicons name="radio" size={16} color={colors.accentLight || colors.text} />
                            <Text style={[styles.castingRemoteText, { color: colors.textSecondary }]}>
                                {'LocalCast activo · Modo control remoto'}
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.progressSection}>
                            <View style={{ position: 'relative', width: '100%', height: 40, marginVertical: -8 }}>
                                <ABSliderMarkers duration={duration} />
                                <Slider
                                    style={{ width: '100%', height: 40 }}
                                    minimumValue={0}
                                    maximumValue={duration > 0 ? duration : 1}
                                    value={isSeeking ? seekValue : position}
                                    minimumTrackTintColor={colors.text}
                                    maximumTrackTintColor={colors.overlayAlpha20}
                                    thumbTintColor={colors.text}
                                    onSlidingStart={(value) => {
                                        setIsSeeking(true);
                                        setSeekValue(value);
                                    }}
                                    onValueChange={(value) => {
                                        setSeekValue(value);
                                    }}
                                    onSlidingComplete={(value) => {
                                        setIsSeeking(false);
                                        TrackPlayer.seekTo(value).catch(() => { });
                                    }}
                                />
                            </View>
                            <View style={styles.timeContainer}>
                                <Text style={styles.timeText}>{formatTimestamp(displayPosition)}</Text>
                                <Text style={styles.timeText}>{formatTimestamp(duration)}</Text>
                            </View>
                        </View>
                    )}

                    {/* Controls */}
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
                            onPress={toggleShuffle}
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
                            onPress={() => {
                                if (position > SKIP_PREVIOUS_THRESHOLD) {
                                    TrackPlayer.seekTo(0).catch(() => { });
                                } else {
                                    TrackPlayer.skipToPrevious().catch(() => { });
                                }
                            }}
                            style={styles.controlButton}
                            disabled={!hasPrevious && position <= SKIP_PREVIOUS_THRESHOLD}
                        >
                            <Ionicons name="play-back" size={38} color={(hasPrevious || position > SKIP_PREVIOUS_THRESHOLD) ? colors.text : colors.disabled} />
                        </TouchableOpacity>

                        <PlayPauseButton size={84} iconType="circle" style={styles.mainControlButton} />

                        {/* Forward */}
                        <TouchableOpacity
                            onPress={() => TrackPlayer.skipToNext().catch(() => { })}
                            style={styles.controlButton}
                            disabled={!hasNext}
                        >
                            <Ionicons name="play-forward" size={38} color={hasNext ? colors.text : colors.disabled} />
                        </TouchableOpacity>

                        {/* Repeat */}
                        <TouchableOpacity
                            onPress={cycleRepeatMode}
                            style={styles.secondaryControlButton}
                            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        >
                            <View>
                                <Ionicons
                                    name={repeatMode === RepeatMode.Off ? 'repeat-outline' : 'repeat'}
                                    size={24}
                                    color={
                                        repeatMode === RepeatMode.Off ? colors.disabled : colors.accentLight
                                    }
                                />
                                {repeatMode === RepeatMode.Track && (
                                    <Text style={styles.repeatOneBadge}>1</Text>
                                )}
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Footer */}
                    <View style={[styles.footer, { marginBottom: insets.bottom + 30 }]}>
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
                                    onPress={openSleepTimer}
                                    style={styles.footerButton}
                                    disabled={isServerRunning}
                                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                >
                                    <Ionicons
                                        name="timer-outline"
                                        size={24}
                                        color={isServerRunning ? colors.disabled : (isSleepTimerActive ? colors.accentLight : colors.textSecondary)}
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
                                    onPress={openSpeedPitch}
                                    style={styles.footerButton}
                                    disabled={isServerRunning}
                                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                >
                                    <Ionicons
                                        name="speedometer-outline"
                                        size={24}
                                        color={isServerRunning ? colors.disabled : (isSpeedPitchActive ? colors.accentLight : colors.textSecondary)}
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
                                    onPress={() => navigation.navigate('Lyrics')}
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
                                    onPress={openCastSheet}
                                    style={styles.footerButton}
                                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                >
                                    <Ionicons
                                        name={isChromecastConnected ? "tv" : isLocalCastActive ? "desktop" : "desktop-outline"}
                                        size={24}
                                        color={isCasting ? (isChromecastConnected ? "#60A5FA" : colors.accentLight) : colors.textSecondary}
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
                                    onPress={() => handleABButtonPress(position)}
                                    onLongPress={handleABLongPress}
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
                                    onPress={handleShare}
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
                                    onPress={openQueue}
                                    style={styles.footerButton}
                                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                >
                                    <Ionicons name="list" size={24} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Animated.View>
            </View>

            {/* Tutorial Contextual Spotlight de PlayerScreen */}
            <PlayerSpotlightTutorial
                visible={isTutorialVisible}
                onClose={handleCloseTutorial}
                rootRef={rootRef}
                moreButtonRef={moreButtonRef}
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

    if (!activeTrackModel) return null;

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

const getStyles = (colors: any, fonts: any, layout: any, spacing: any = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 }, radii: any = { sm: 4, md: 8, lg: 12, full: 9999 }, fontWeights: any = { regular: '400', semiBold: '600', bold: '700' }, shadows: any = { lg: {} }) => StyleSheet.create({
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
        width: width - 64,
        height: width - 64,
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