import BlurredBackground from '@/components/layouts/BlurredBackground';
import { openLocalCast, openPlayerMenu, openPlaylistSelector, openQueueSheet, openSleepTimer, openSpeedPitch, openTagManagerForTrack, openTrackMenu } from '@/store/useUIStore';
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
    usePlaybackState,
    useProgress,
} from 'react-native-track-player';
import { extractColorFromImage, NativeVisualizer } from '../../../modules/native-equalizer';

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
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as Sharing from 'expo-sharing';
import { useTranslation } from 'react-i18next';
import Track from '../../database/models/Track';
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


const performToggleShuffle = async (
    isShuffleEnabled: boolean,
    shuffleOriginalQueue: any[],
    setShuffleState: (enabled: boolean, queue: any[]) => void
) => {
    try {
        const currentQueue = await TrackPlayer.getQueue();
        const currentIndex = (await TrackPlayer.getActiveTrackIndex()) ?? 0;

        if (!isShuffleEnabled) {
            // Guardar la cola completa en el store global
            setShuffleState(true, currentQueue);
            const upcoming = currentQueue.slice(currentIndex + 1);
            const shuffled = [...upcoming].sort(() => Math.random() - 0.5);
            await TrackPlayer.removeUpcomingTracks();
            if (shuffled.length > 0) await TrackPlayer.add(shuffled);
        } else {
            if (shuffleOriginalQueue.length > 0) {
                // Buscar la canción actual en la cola original por ID
                const currentTrack = currentQueue[currentIndex];
                const originalIdx = shuffleOriginalQueue.findIndex(t => t.id === currentTrack?.id);
                const restoreFrom = originalIdx >= 0 ? originalIdx + 1 : currentIndex + 1;
                const tracksToRestore = shuffleOriginalQueue.slice(restoreFrom);
                await TrackPlayer.removeUpcomingTracks();
                if (tracksToRestore.length > 0) await TrackPlayer.add(tracksToRestore);
            }
            // Limpiar el store global
            setShuffleState(false, []);
        }
        // Guardar el nuevo orden de la cola en disco y actualizar status
        await usePlayerStore.getState().savePlaybackState();
        await usePlayerStore.getState().updateQueueStatus(currentIndex);
    } catch (e) {
        console.error('Error toggling shuffle:', e);
    }
};

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
    isPlaying,
    isImmersive,
    gradientColors
}: {
    sourceUri: string;
    isPlaying: boolean;
    isImmersive: boolean;
    gradientColors: string[];
}) => {
    const player = useVideoPlayer(sourceUri, (playerInstance) => {
        playerInstance.loop = true;
        playerInstance.muted = true;
        if (isPlaying) {
            playerInstance.play();
        } else {
            playerInstance.pause();
        }
    });

    useEffect(() => {
        if (isPlaying) {
            player.play();
        } else {
            player.pause();
        }
    }, [isPlaying, player]);

    // NUEVO EFECTO: Detecta cuando la app vuelve de segundo plano
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            // Si la app vuelve a estar activa y la canción se estaba reproduciendo, forzamos el play del vídeo
            if (nextAppState === 'active' && isPlaying) {
                player.play();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [isPlaying, player]);

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
        <View style={StyleSheet.absoluteFillObject}>
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

    const [isTransitioning, setIsTransitioning] = React.useState(false);

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

    // Is something replacing the big cover? (visualizer OR cd/vinyl spinning OR background canvas)
    const isAltDisplay = showPlayerVisualizer || playerCoverStyle === 'cd' || playerCoverStyle === 'vinyl' || (showCanvas && !!track.bgVideo);

    const pointA = useABRepeatStore(state => state.pointA);
    const pointB = useABRepeatStore(state => state.pointB);
    const handleABButtonPress = useABRepeatStore(state => state.handleButtonPress);

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

    // Shuffle — estado global (sobrevive a la navegación)
    const isShuffleEnabled = usePlayerStore(state => state.isShuffleEnabled);
    const shuffleOriginalQueue = usePlayerStore(state => state.shuffleOriginalQueue);
    const setShuffleState = usePlayerStore(state => state.setShuffleState);

    // Seeking state: while dragging we use the local value to avoid jumps
    const [isSeeking, setIsSeeking] = useState(false);
    const [seekValue, setSeekValue] = useState(0);

    const displayPosition = isSeeking ? seekValue : position;

    // ── Repeat mode ──
    const [repeatMode, setRepeatModeState] = useState<RepeatMode>(RepeatMode.Off);

    // ── Like Heart Animation ──
    const heartScale = useSharedValue(1);

    const heartAnimatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: heartScale.value }]
        };
    });

    // ── Swipe Gestures ──
    const translateX = useSharedValue(0);
    const hasTriggeredHaptic = useSharedValue(false);

    // ── CD / Vinyl spin animation ──
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
        if (isFocused && !isTransitioning && playerCoverStyle === 'cover') {
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
            // Animates to elegant position above the bottom safely (so it's not too low)
            marginBottom: 8 + immersiveProgress.value * (insets.bottom + 62),
        };
    });

    const triggerHaptic = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const skipNext = () => TrackPlayer.skipToNext().catch(() => { });
    const skipPrevious = () => TrackPlayer.skipToPrevious().catch(() => { });

    const panGesture = Gesture.Pan()
        .activeOffsetX([-20, 20])
        .onUpdate((event) => {
            translateX.value = event.translationX;
            if (Math.abs(translateX.value) > 100 && !hasTriggeredHaptic.value) {
                hasTriggeredHaptic.value = true;
                runOnJS(triggerHaptic)();
            } else if (Math.abs(translateX.value) <= 100) {
                hasTriggeredHaptic.value = false;
            }
        })
        .onEnd(() => {
            if (translateX.value < -100) {
                runOnJS(skipNext)();
            } else if (translateX.value > 100) {
                runOnJS(skipPrevious)();
            }
            translateX.value = withSpring(0, { damping: 25, stiffness: 60 });
            hasTriggeredHaptic.value = false;
        });

    const longPressGesture = Gesture.LongPress()
        .minDuration(450)
        .onStart(() => {
            runOnJS(triggerHaptic)();
            runOnJS(openPlayerMenu)();
        });

    const tapGesture = Gesture.Tap()
        .numberOfTaps(1)
        .onStart(() => {
            runOnJS(toggleImmersiveMode)();
        });

    const composedGesture = Gesture.Exclusive(
        panGesture,
        longPressGesture,
        tapGesture
    );

    const swipeAnimatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: translateX.value }]
        };
    });


    const isServerRunning = useCastStore(state => state.isServerRunning);
    const openCastSheet = openLocalCast;

    const handleLikePress = async () => {
        heartScale.value = withSequence(
            withSpring(1.2, { damping: 15, stiffness: 300 }),
            withSpring(1.0, { damping: 15, stiffness: 300 })
        );
        try {
            await track.toggleLike();
            if (track.isFavorite) { // Si AHORA es favorito, mostrar toast
                useToastStore.getState().showToast(t('toasts.added_to_favourites'), 'heart');
            }
        } catch (e) {
            console.error('Error al dar me gusta:', e);
        }
    };

    useEffect(() => {
        TrackPlayer.getRepeatMode().then(setRepeatModeState).catch(() => { });
    }, []);

    const toggleShuffle = () => performToggleShuffle(isShuffleEnabled, shuffleOriginalQueue, setShuffleState);

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

    const handleShare = React.useCallback(async () => {
        if (!track?.fileUrl) return;
        try {
            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable) {
                await Sharing.shareAsync(track.fileUrl, {
                    dialogTitle: `Compartir ${track.title}`,
                    mimeType: 'audio/*',
                });
            }
        } catch (error) {
            console.error('Error al compartir el archivo de audio:', error);
        }
    }, [track]);

    const [imageError, setImageError] = React.useState(false);

    React.useEffect(() => {
        setImageError(false);
    }, [track.id]);

    return (
        <View style={[styles.container, playerBackgroundStyle === 'gradient' && coverColor && { backgroundColor: finalBgColor }]}>
            {/* Background Image with Blur / Color Gradient */}
            <BlurredBackground
                key={`blur-${track.id}`}
                imageUrl={album?.coverUrl}
                blurIntensity={10}
                gradientColors={
                    playerBackgroundStyle === 'gradient' && coverColor
                        ? [topGradientColor, bottomGradientColor, bottomGradientColor]
                        : ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)', colors.background]
                }
            />

            {isFocused && !isTransitioning && showCanvas && !!track.bgVideo && (
                <CanvasVideo
                    key={track.bgVideo}
                    sourceUri={track.bgVideo}
                    isPlaying={isPlaying}
                    isImmersive={isImmersive}
                    gradientColors={['rgba(0,0,0,0.10)', 'rgba(0,0,0,0.72)', 'rgba(0,0,0,0.97)']}
                />
            )}

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

                    <TouchableOpacity
                        style={styles.moreButton}
                        onPress={handleMorePress}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {/* Artwork / Visualizer / CD / Vinyl Container */}
                <View style={[
                    styles.artworkContainer,
                    isAltDisplay && { paddingHorizontal: 0 },
                    isImmersive && { flex: 1, paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0, marginVertical: 0 }
                ]}>
                    <GestureDetector gesture={composedGesture}>
                        <Animated.View style={[swipeAnimatedStyle, { width: '100%', height: '100%', justifyContent: 'center' }]}>
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
                            ) : (showCanvas && !!track.bgVideo) ? (
                                <View style={{ width: width - 64, height: width - 64 }} />
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

                {/* Info */}
                <Animated.View style={[styles.infoContainer, infoContainerAnimatedStyle]}>
                    <View style={styles.infoTextContainer}>
                        {/* Tags row */}
                        <View style={styles.tagsRow}>
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
                    <View style={styles.infoActionsContainer}>
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
                    {/* Progress Slider */}
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

                    {/* Controls */}
                    <View style={styles.controlsContainer}>
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
                            <TouchableOpacity
                                onPress={() => navigation.navigate('Lyrics')}
                                style={styles.footerButton}
                                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                            >
                                <Ionicons
                                    name="mic-outline"
                                    size={24}
                                    color={colors.textSecondary}
                                />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={openCastSheet}
                                style={styles.footerButton}
                                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                            >
                                <Ionicons
                                    name={isServerRunning ? "desktop" : "desktop-outline"}
                                    size={24}
                                    color={isServerRunning ? colors.accentLight : colors.textSecondary}
                                />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => handleABButtonPress(position)}
                                style={styles.footerButton}
                                disabled={isServerRunning}
                                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                            >
                                <Ionicons
                                    name={pointA !== null ? "infinite" : "infinite-outline"}
                                    size={24}
                                    color={
                                        isServerRunning
                                            ? colors.disabled
                                            : pointB !== null
                                                ? colors.accentLight
                                                : pointA !== null
                                                    ? "rgba(167, 139, 250, 0.5)"
                                                    : colors.textSecondary
                                    }
                                />
                            </TouchableOpacity>
                        </View>

                        {/* Right group */}
                        <View style={styles.footerRightGroup}>
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
                            <TouchableOpacity
                                onPress={openQueue}
                                style={styles.footerButton}
                                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                            >
                                <Ionicons name="list" size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </Animated.View>
            </View>
        </View>
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
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.xl || 32,
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