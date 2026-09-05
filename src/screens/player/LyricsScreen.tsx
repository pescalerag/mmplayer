import { openQueueSheet, openSpeedPitch, openSleepTimer, openLyricsMenu, openArtistsList, openPlaylistSelector } from '@/store/useUIStore';


import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TrackPlayer, { RepeatMode, useProgress } from 'react-native-track-player';
import BlurredBackground from '@/components/layouts/BlurredBackground';




import { usePlayerStore } from '../../store/usePlayerStore';


import { useSleepTimerStore } from '../../store/useSleepTimerStore';
import { useToastStore } from '../../store/useToastStore';
import { useCastStore } from '../../store/useCastStore';

import { useAppTheme } from "@/hooks/useAppTheme";
import withObservables from '@nozbe/with-observables';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import { useTranslation } from 'react-i18next';
import { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import MarqueeText from '@/components/common/MarqueeText';
import PlayPauseButton from '@/components/common/PlayPauseButton';
import Album from '../../database/models/Album';
import Artist from '../../database/models/Artist';
import Track from '../../database/models/Track';
import { useSyncedLyrics } from '../../hooks/useSyncedLyrics';
import { LyricsService } from '../../services/LyricsService';
import { formatTrackTime } from '../../utils/time';
import { useABRepeatStore } from '../../store/useABRepeatStore';
import { ABSliderMarkers } from '@/components/common/ABSliderMarkers';
import { useKeepAwake } from 'expo-keep-awake';
import { useSettingsStore } from '../../store/useSettingsStore';
import { extractColorFromImage } from '../../../modules/native-equalizer';

const { height: screenHeight } = Dimensions.get('window');
const SKIP_PREVIOUS_THRESHOLD = 3;
const LYRIC_ITEM_HEIGHT = 80; // Height of each lyric line item including its vertical margins

const performToggleShuffle = async () => {
    await usePlayerStore.getState().toggleShuffle();
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

const hexToRgba = (hex: string, alpha: number): string => {
    hex = hex.replace(/^#/, '');
    let r = 0, g = 0, b = 0;
    if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const generateDarkGradients = (extractedHex: string, defaultBg: string) => {
    try {
        const hsl = hexToHsl(extractedHex);
        // Base dark color: Saturation 30%, Lightness 10%
        const baseColor = hslToHex(hsl.h, 30, 10);
        // Lighter top color: Saturation 35%, Lightness 20%
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

interface LyricLineProps {
    item: { time: number; text: string };
    isActive: boolean;
    onPress: () => void;
    styles: any;
}

const LyricLine = React.memo(({ item, isActive, onPress, styles }: LyricLineProps) => {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            style={styles.lineContainer}
        >
            <Text style={[styles.lineText, isActive ? styles.lineActive : styles.lineInactive]}>
                {item.text}
            </Text>
        </TouchableOpacity>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.item.text === nextProps.item.text &&
        prevProps.item.time === nextProps.item.time &&
        prevProps.isActive === nextProps.isActive &&
        prevProps.styles === nextProps.styles
    );
});
LyricLine.displayName = 'LyricLine';

interface LyricsScreenUIProps {
    track: Track;
    album: Album | null;
    artist: Artist | null;
    artists: Artist[];
}

const LyricsScreenUI = ({ track, album, artist, artists }: LyricsScreenUIProps) => {
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const { colors, fonts, layout, spacing, radii, fontWeights, shadows } = useAppTheme();

    const [extractedColor, setExtractedColor] = React.useState<string | null>(null);

    React.useEffect(() => {
        let isMounted = true;
        if (!album?.coverUrl) {
            setExtractedColor(null);
            return;
        }

        extractColorFromImage(album.coverUrl)
            .then(color => {
                if (isMounted) {
                    setExtractedColor(color);
                }
            })
            .catch(err => {
                console.error("Error extracting cover color in LyricsScreen:", err);
                if (isMounted) {
                    setExtractedColor(null);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [album?.coverUrl]);

    const { finalBgColor, topGradientColor, bottomGradientColor } = React.useMemo(() => {
        if (extractedColor) {
            const grads = generateDarkGradients(extractedColor, colors.background);
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
    }, [extractedColor, colors.background]);
    const styles = React.useMemo(() => getStyles(colors, fonts, layout, spacing, radii, fontWeights, shadows), [colors, fonts, layout, spacing, radii, fontWeights, shadows]);

    // Calculate layout metrics for perfect lyrics centering in the gap
    const { paddingTop, paddingBottom } = React.useMemo(() => {
        const yStart = insets.top + 200;
        const yEnd = screenHeight - (insets.bottom + 320);
        const yCenterVal = (yStart + yEnd) / 2;
        const itemHeightVal = LYRIC_ITEM_HEIGHT;

        const padTop = yCenterVal - itemHeightVal / 2;
        const padBottom = screenHeight - yCenterVal - itemHeightVal / 2;

        return {
            paddingTop: padTop,
            paddingBottom: padBottom,
        };
    }, [insets.top, insets.bottom]);

    const openQueue = openQueueSheet;
    const isSleepTimerActive = useSleepTimerStore(state => state.isActive);
    
    const playbackSpeed = usePlayerStore(state => state.playbackSpeed);
    const playbackPitch = usePlayerStore(state => state.playbackPitch);
    const isSpeedPitchActive = playbackSpeed !== 1 || playbackPitch !== 1;

    const { position, duration } = useProgress(250);
    const hasNext = usePlayerStore(state => state.hasNext);
    const hasPrevious = usePlayerStore(state => state.hasPrevious);

    const pointA = useABRepeatStore(state => state.pointA);
    const pointB = useABRepeatStore(state => state.pointB);
    const handleABButtonPress = useABRepeatStore(state => state.handleButtonPress);
    const isServerRunning = useCastStore(state => state.isServerRunning);

    const isShuffleEnabled = usePlayerStore(state => state.isShuffleEnabled);
    const shuffleOriginalQueue = usePlayerStore(state => state.shuffleOriginalQueue);
    const setShuffleState = usePlayerStore(state => state.setShuffleState);

    const [isSeeking, setIsSeeking] = useState(false);
    const [seekValue, setSeekValue] = useState(0);
    const displayPosition = isSeeking ? seekValue : position;

    const [repeatMode, setRepeatMode] = useState<RepeatMode>(RepeatMode.Off);
    const heartScale = useSharedValue(1);
    const isLocalCastActive = useCastStore(state => state.isLocalCastActive);
    const isChromecastConnected = useCastStore(state => state.isChromecastConnected);
    const isCasting = isLocalCastActive || isChromecastConnected;

    const flatListRef = useRef<FlatList>(null);
    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        TrackPlayer.getRepeatMode().then(setRepeatMode).catch(() => { });
    }, []);

    useEffect(() => {
        if (isLocalCastActive && navigation.canGoBack()) {
            navigation.goBack();
        }
    }, [isLocalCastActive, navigation]);

    const { parsedLyrics, activeIndex, isLoading, isSynced, lyricsText } = useSyncedLyrics(track);

    const isInitialScrollRef = useRef(true);

    useEffect(() => {
        isInitialScrollRef.current = true;
        // Reset scroll position to top on track changes
        if (flatListRef.current) {
            flatListRef.current.scrollToOffset({ offset: 0, animated: false });
        }
        if (scrollViewRef.current) {
            scrollViewRef.current.scrollTo({ y: 0, animated: false });
        }
    }, [track.id]);

    useEffect(() => {
        if (isSynced && activeIndex !== -1 && flatListRef.current) {
            const isInitial = isInitialScrollRef.current;
            flatListRef.current.scrollToOffset({
                offset: activeIndex * LYRIC_ITEM_HEIGHT,
                animated: !isInitial,
            });
            if (isInitial) {
                isInitialScrollRef.current = false;
            }
        }
    }, [activeIndex, isSynced]);

    const handleImportLRC = async () => {
        try {
            const imported = await LyricsService.importCustomLyrics(track);
            if (imported) {
                Alert.alert(t('actions.success') || 'Éxito', t('lyrics.import_success') || 'Letras importadas correctamente.');
            }
        } catch {
            Alert.alert(t('actions.error') || 'Error', t('lyrics.read_error') || 'No se pudo leer el archivo de letras.');
        }
    };

    // UI actions (from PlayerScreen)
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

    const toggleShuffle = () => usePlayerStore.getState().toggleShuffle();

    const cycleRepeatMode = async () => {
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
    };

    const handleAlbumPress = () => {
        if (album?.id) {
            navigation.navigate('AlbumDetail', { albumId: album.id });
        }
    };
    const handleArtistPress = () => {
        if (artists && artists.length > 1) {
            openArtistsList(artists);
        } else {
            const targetArtistId = artists && artists.length > 0 ? artists[0].id : artist?.id;
            if (!targetArtistId) return;
            navigation.navigate('ArtistDetail', { artistId: targetArtistId });
        }
    };
    const handleOpenPlaylistSelector = React.useCallback(() => {
        openPlaylistSelector(track);
    }, [track]);

    const artistName = React.useMemo(() => {
        if (artists && artists.length > 0) {
            return artists.map(a => a.name).join(', ');
        }
        return artist?.name || '';
    }, [artist, artists]);

    const handleShare = React.useCallback(() => {
        const hasParsed = parsedLyrics && parsedLyrics.length > 0;
        const hasPlain = !!lyricsText && lyricsText.trim().length > 0;

        if (hasParsed || hasPlain) {
            const lines = hasParsed
                ? parsedLyrics.map(p => ({ time: p.time, text: p.text }))
                : lyricsText!
                      .split(/\r?\n/)
                      .map(l => ({ text: l.trim() }))
                      .filter(l => l.text.length > 0);

            navigation.navigate('ShareLyrics', {
                trackId: track.id,
                title: track.title,
                artist: artistName,
                album: album?.title || '',
                coverUrl: album?.coverUrl || null,
                lyricsLines: lines,
                initialIndex: activeIndex >= 0 ? activeIndex : 0,
            });
            return;
        }

        if (!track?.fileUrl) return;
        navigation.navigate('ShareSong', {
            trackId: track.id,
            title: track.title,
            artist: artistName,
            album: album?.title || '',
            coverUrl: album?.coverUrl || null,
            fileUrl: track.fileUrl,
            duration: track.duration,
        });
    }, [track, artistName, album, navigation, parsedLyrics, lyricsText, activeIndex]);

    const heartAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: heartScale.value }] }));

    const renderContent = () => {
        if (isLoading) {
            return (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={styles.stateText}>{t('audio_effects.lyrics_searching') || 'Buscando letras...'}</Text>
                </View>
            );
        }

        if (!lyricsText) {
            return (
                <View style={styles.centered}>
                    <Ionicons name="mic-off-outline" size={72} color={colors.textSecondary} style={{ marginBottom: 20 }} />
                    <Text style={styles.stateText}>{t('audio_effects.lyrics_not_found') || 'No se encontraron letras'}</Text>
                    <TouchableOpacity onPress={handleImportLRC} style={styles.importButton}>
                        <Ionicons name="cloud-upload-outline" size={18} color="#FFF" style={{ marginRight: 8 }} />
                        <Text style={styles.importButtonText}>{t('audio_effects.lyrics_import') || 'Importar archivo .LRC'}</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (isSynced) {
            return (
                <FlatList
                    ref={flatListRef}
                    data={parsedLyrics}
                    keyExtractor={(_, i) => i.toString()}
                    renderItem={({ item, index }) => (
                        <LyricLine
                            item={item}
                            isActive={index === activeIndex}
                            onPress={() => TrackPlayer.seekTo(item.time)}
                            styles={styles}
                        />
                    )}
                    contentContainerStyle={[styles.listContent, { paddingTop, paddingBottom }]}
                    getItemLayout={(_, index) => ({ length: LYRIC_ITEM_HEIGHT, offset: LYRIC_ITEM_HEIGHT * index, index })}
                    onScrollToIndexFailed={info => {
                        flatListRef.current?.scrollToOffset({
                            offset: info.highestMeasuredFrameIndex * LYRIC_ITEM_HEIGHT,
                            animated: false,
                        });
                    }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                />
            );
        }

        return (
            <ScrollView
                ref={scrollViewRef}
                contentContainerStyle={[styles.plainContainer, { paddingTop: insets.top + 200, paddingBottom: insets.bottom + 320 }]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={styles.plainText}>{lyricsText}</Text>
            </ScrollView>
        );
    };

    return (
        <View style={[styles.root, { backgroundColor: finalBgColor }]}>
            {/* Blurred Background */}
            <BlurredBackground
                key={`blur-${track.id}`}
                imageUrl={album?.coverUrl || undefined}
                blurIntensity={100}
                gradientColors={
                    extractedColor
                        ? [
                            topGradientColor,
                            bottomGradientColor,
                            bottomGradientColor
                          ]
                        : ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)', colors.background]
                }
            />

            {/* Lyrics Content (Absolute Full to scroll behind) */}
            <View style={StyleSheet.absoluteFill}>
                {renderContent()}
            </View>

            {/* Gradient Masks */}
            <LinearGradient
                colors={
                    extractedColor
                        ? [topGradientColor, topGradientColor, 'transparent']
                        : [colors.background, colors.background, 'transparent']
                }
                locations={[0, 0.45, 1]}
                style={[styles.gradientMaskTop, { height: insets.top + 200 }]}
                pointerEvents="none"
            />
            <LinearGradient
                colors={
                    extractedColor
                        ? ['transparent', bottomGradientColor, bottomGradientColor]
                        : ['transparent', colors.background, colors.background]
                }
                locations={[0, 0.3, 1]}
                style={[styles.gradientMaskBottom, { height: insets.bottom + 320 }]}
                pointerEvents="none"
            />


            {/* Absolute Header */}
            <View style={[styles.header, { top: insets.top }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.dismissButton}>
                    <Ionicons name="chevron-down" size={32} color={colors.text} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.headerTextContainer} onPress={handleAlbumPress}>
                    <MarqueeText
                        text={track.title}
                        style={styles.headerTitle}
                        speed={35}
                        pauseDuration={2000}
                    />
                </TouchableOpacity>

                <TouchableOpacity style={styles.moreButton} onPress={() => openLyricsMenu(track, () => { })} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
                </TouchableOpacity>
            </View>
            {/* Absolute Bottom Controls */}
            <View style={[styles.bottomContainer, { bottom: 0, paddingTop: 16, paddingBottom: insets.bottom + 20 }]}>

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
                                onSlidingStart={(val) => { setIsSeeking(true); setSeekValue(val); }}
                                onValueChange={(val) => setSeekValue(val)}
                                onSlidingComplete={(val) => { setIsSeeking(false); TrackPlayer.seekTo(val).catch(() => { }); }}
                            />
                        </View>
                        <View style={styles.timeContainer}>
                            <Text style={styles.timeText}>{formatTrackTime(displayPosition)}</Text>
                            <Text style={styles.timeText}>{formatTrackTime(duration)}</Text>
                        </View>
                    </View>
                )}

                {/* Main Controls */}
                <View style={styles.controlsContainer}>
                    <TouchableOpacity onPress={toggleShuffle} style={styles.secondaryControlButton} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                        <Ionicons name={isShuffleEnabled ? 'shuffle' : 'shuffle-outline'} size={24} color={isShuffleEnabled ? colors.accentLight : colors.disabled} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => {
                            if (position > SKIP_PREVIOUS_THRESHOLD) { TrackPlayer.seekTo(0).catch(() => { }); }
                            else { TrackPlayer.skipToPrevious().catch(() => { }); }
                        }}
                        style={styles.controlButton}
                        disabled={!hasPrevious && position <= SKIP_PREVIOUS_THRESHOLD}
                    >
                        <Ionicons name="play-back" size={38} color={(hasPrevious || position > SKIP_PREVIOUS_THRESHOLD) ? colors.text : colors.disabled} />
                    </TouchableOpacity>

                    <PlayPauseButton size={84} iconType="circle" style={styles.mainControlButton} />

                    <TouchableOpacity onPress={() => TrackPlayer.skipToNext().catch(() => { })} style={styles.controlButton} disabled={!hasNext}>
                        <Ionicons name="play-forward" size={38} color={hasNext ? colors.text : colors.disabled} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={cycleRepeatMode} style={styles.secondaryControlButton} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                        <View>
                            <Ionicons name={repeatMode === RepeatMode.Off ? 'repeat-outline' : 'repeat'} size={24} color={repeatMode === RepeatMode.Off ? colors.disabled : colors.accentLight} />
                            {repeatMode === RepeatMode.Track && <Text style={styles.repeatOneBadge}>1</Text>}
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Footer / Secondary Actions */}
                <View style={styles.footer}>
                    {/* Left group: Sleep Timer + Speedometer + Microphone */}
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
                            onPress={() => navigation.goBack()}
                            style={styles.footerButton}
                            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        >
                            <Ionicons
                                name="mic"
                                size={24}
                                color="#A855F7"
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

                    {/* Right group: Share + Queue */}
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
            </View>

        </View>
    );
};

const ObservableLyricsScreenUI = withObservables(['trackModel'], ({ trackModel }) => ({
    track: trackModel.observe(),
    album: trackModel.album.observe().pipe(catchError(() => of(null))),
    artist: trackModel.artist.observe().pipe(catchError(() => of(null))),
    artists: trackModel.queryCollaborators.observe(),
}))(LyricsScreenUI);

function KeepAwakeController() {
    useKeepAwake();
    return null;
}

export default function LyricsScreen() {
    const activeTrackModel = usePlayerStore(state => state.activeTrack);
    const isFocused = useIsFocused();
    const isKeepAwakeEnabled = useSettingsStore(state => state.isKeepAwakeEnabled);

    if (!activeTrackModel) return null;

    return (
        <>
            {isKeepAwakeEnabled && isFocused && <KeepAwakeController />}
            <ObservableLyricsScreenUI trackModel={activeTrackModel} />
        </>
    );
}

const DEFAULT_SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
const DEFAULT_RADII = { sm: 4, md: 8, lg: 12, full: 9999 };
const DEFAULT_FONT_WEIGHTS = { regular: '400', semiBold: '600', bold: '700' };
const DEFAULT_SHADOWS = { lg: {} };

const getStyles = (colors: any, fonts: any, layout: any, spacing: any = DEFAULT_SPACING, radii: any = DEFAULT_RADII, fontWeights: any = DEFAULT_FONT_WEIGHTS, shadows: any = DEFAULT_SHADOWS) => StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
    gradientMaskTop: { position: 'absolute', top: 0, left: 0, right: 0 },
    gradientMaskBottom: { position: 'absolute', bottom: 0, left: 0, right: 0 },
    header: {
        position: 'absolute', left: 0, right: 0, zIndex: 10,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: spacing.md || 16, height: 60,
    },
    dismissButton: { padding: spacing.xs || 4 },
    headerTitle: { color: colors.text, fontSize: 13, fontWeight: fontWeights.bold, textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: fonts.regular, textAlign: 'center' },
    headerTextContainer: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.sm || 10 },
    moreButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },

    bottomContainer: { position: 'absolute', left: 0, right: 0, zIndex: 10 },
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
    repeatOneBadge: {
        position: 'absolute',
        bottom: -4,
        right: -6,
        color: colors.accentLight,
        fontSize: 9,
        fontFamily: fonts.regular,
        fontWeight: fontWeights.bold,
    },

    stateText: { color: colors.textSecondary, fontSize: 16, fontFamily: fonts.regular, textAlign: 'center', marginBottom: 28 },
    importButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent, paddingVertical: 13, paddingHorizontal: 24, borderRadius: 30 },
    importButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', fontFamily: fonts.regular },
    listContent: { paddingHorizontal: 28 },
    lineContainer: { minHeight: LYRIC_ITEM_HEIGHT - 16, justifyContent: 'center', marginVertical: 8 },
    lineText: { fontFamily: fonts.regular, textAlign: 'left' },
    lineActive: { color: colors.text, fontSize: 26, fontWeight: '800', lineHeight: 36 },
    lineInactive: { color: colors.textSecondary, fontSize: 20, fontWeight: '700', lineHeight: 28 },
    plainContainer: { paddingHorizontal: 28 },
    plainText: { color: colors.text, fontSize: 18, lineHeight: 30, fontFamily: fonts.regular, textAlign: 'center' },

});
