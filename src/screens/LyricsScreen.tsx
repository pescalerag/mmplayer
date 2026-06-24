import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
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
import BlurredBackground from '../components/BlurredBackground';

import { usePlayerStore } from '../store/usePlayerStore';
import { useQueueSheetStore } from '../store/useQueueSheetStore';
import { usePlaylistSelectorStore } from '../store/usePlaylistSelectorStore';
import { useToastStore } from '../store/useToastStore';
import { useArtistsListSheetStore } from '../store/useArtistsListSheetStore';
import { useLyricsMenuStore } from '../store/useLyricsMenuStore';
import { useSleepTimerStore } from '../store/useSleepTimerStore';
import { useAudioSpeedPitchSheetStore } from '../store/useAudioSpeedPitchSheetStore';

import { useAppTheme } from "@/hooks/useAppTheme";
import * as Sharing from 'expo-sharing';
import { useTranslation } from 'react-i18next';
import MarqueeText from '../components/MarqueeText';
import PlayPauseButton from '../components/PlayPauseButton';
import { formatTrackTime } from '../utils/time';
import { LyricsService } from '../services/LyricsService';
import { useSyncedLyrics } from '../hooks/useSyncedLyrics';
import { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import withObservables from '@nozbe/with-observables';
import Track from '../database/models/Track';
import Album from '../database/models/Album';
import Artist from '../database/models/Artist';

const { height: screenHeight } = Dimensions.get('window');
const SKIP_PREVIOUS_THRESHOLD = 3;
const LYRIC_ITEM_HEIGHT = 80; // Height of each lyric line item including its vertical margins

const performToggleShuffle = async (
    isShuffleEnabled: boolean,
    shuffleOriginalQueue: any[],
    setShuffleState: (enabled: boolean, queue: any[]) => void
) => {
    try {
        const currentQueue = await TrackPlayer.getQueue();
        const currentIndex = (await TrackPlayer.getActiveTrackIndex()) ?? 0;

        if (!isShuffleEnabled) {
            setShuffleState(true, currentQueue);
            const upcoming = currentQueue.slice(currentIndex + 1);
            const shuffled = [...upcoming].sort(() => Math.random() - 0.5);
            await TrackPlayer.removeUpcomingTracks();
            if (shuffled.length > 0) await TrackPlayer.add(shuffled);
        } else {
            if (shuffleOriginalQueue.length > 0) {
                const currentTrack = currentQueue[currentIndex];
                const originalIdx = shuffleOriginalQueue.findIndex(t => t.id === currentTrack?.id);
                const restoreFrom = originalIdx >= 0 ? originalIdx + 1 : currentIndex + 1;
                const tracksToRestore = shuffleOriginalQueue.slice(restoreFrom);
                await TrackPlayer.removeUpcomingTracks();
                if (tracksToRestore.length > 0) await TrackPlayer.add(tracksToRestore);
            }
            setShuffleState(false, []);
        }
        await usePlayerStore.getState().savePlaybackState();
        await usePlayerStore.getState().updateQueueStatus(currentIndex);
    } catch (e) {
        console.error('Error toggling shuffle:', e);
    }
};

interface LyricsScreenUIProps {
    track: Track;
    album: Album;
    artist: Artist;
    artists: Artist[];
}

const LyricsScreenUI = ({ track, album, artist, artists }: LyricsScreenUIProps) => {
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const { colors, fonts, layout, spacing, radii, fontWeights, shadows } = useAppTheme();
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

    const openQueue = useQueueSheetStore(state => state.openQueue);
    const openSleepTimer = useSleepTimerStore(state => state.openSheet);
    const isSleepTimerActive = useSleepTimerStore(state => state.isActive);
    const openSpeedPitch = useAudioSpeedPitchSheetStore(state => state.openSheet);
    const playbackSpeed = usePlayerStore(state => state.playbackSpeed);
    const playbackPitch = usePlayerStore(state => state.playbackPitch);
    const isSpeedPitchActive = playbackSpeed !== 1.0 || playbackPitch !== 1.0;

    const { position, duration } = useProgress();
    const hasNext = usePlayerStore(state => state.hasNext);
    const hasPrevious = usePlayerStore(state => state.hasPrevious);

    const isShuffleEnabled = usePlayerStore(state => state.isShuffleEnabled);
    const shuffleOriginalQueue = usePlayerStore(state => state.shuffleOriginalQueue);
    const setShuffleState = usePlayerStore(state => state.setShuffleState);

    const [isSeeking, setIsSeeking] = useState(false);
    const [seekValue, setSeekValue] = useState(0);
    const displayPosition = isSeeking ? seekValue : position;

    const [repeatMode, setRepeatModeState] = useState<RepeatMode>(RepeatMode.Off);
    const heartScale = useSharedValue(1);

    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        TrackPlayer.getRepeatMode().then(setRepeatModeState).catch(() => { });
    }, []);

    const { parsedLyrics, activeIndex, isLoading, isSynced, lyricsText } = useSyncedLyrics(track, position);

    const isInitialScrollRef = useRef(true);

    useEffect(() => {
        isInitialScrollRef.current = true;
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
                Alert.alert(t('actions.success') || 'Éxito', 'Letras importadas correctamente.');
            }
        } catch {
            Alert.alert(t('actions.error') || 'Error', 'No se pudo leer el archivo de letras.');
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

    const toggleShuffle = () => performToggleShuffle(isShuffleEnabled, shuffleOriginalQueue, setShuffleState);

    const cycleRepeatMode = async () => {
        try {
            const next = repeatMode === RepeatMode.Off ? RepeatMode.Queue : repeatMode === RepeatMode.Queue ? RepeatMode.Track : RepeatMode.Off;
            await TrackPlayer.setRepeatMode(next);
            setRepeatModeState(next);
            await usePlayerStore.getState().updateQueueStatus();
        } catch (e) {
            console.error('Error cycling repeat mode:', e);
        }
    };

    const handleAlbumPress = () => navigation.navigate('AlbumDetail', { albumId: album.id });
    const handleArtistPress = () => {
        if (artists && artists.length > 1) {
            useArtistsListSheetStore.getState().openSheet(artists);
        } else {
            const targetArtistId = artists && artists.length > 0 ? artists[0].id : artist?.id;
            if (!targetArtistId) return;
            navigation.navigate('ArtistDetail', { artistId: targetArtistId });
        }
    };
    const handleOpenPlaylistSelector = React.useCallback(() => {
        usePlaylistSelectorStore.getState().openSelector(track);
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

    const heartAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: heartScale.value }] }));

    return (
        <View style={styles.root}>
            {/* Blurred Background */}
            <BlurredBackground
                key={`blur-${track.id}`}
                imageUrl={album.coverUrl || undefined}
                blurIntensity={100}
                gradientColors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)', colors.background]}
            />

            {/* Lyrics Content (Absolute Full to scroll behind) */}
            <View style={StyleSheet.absoluteFill}>
                {isLoading ? (
                    <View style={styles.centered}>
                        <ActivityIndicator size="large" color={colors.accent} />
                        <Text style={styles.stateText}>{t('audio_effects.lyrics_searching') || 'Buscando letras...'}</Text>
                    </View>
                ) : !lyricsText ? (
                    <View style={styles.centered}>
                        <Ionicons name="mic-off-outline" size={72} color={colors.textSecondary} style={{ marginBottom: 20 }} />
                        <Text style={styles.stateText}>{t('audio_effects.lyrics_not_found') || 'No se encontraron letras'}</Text>
                        <TouchableOpacity onPress={handleImportLRC} style={styles.importButton}>
                            <Ionicons name="cloud-upload-outline" size={18} color="#FFF" style={{ marginRight: 8 }} />
                            <Text style={styles.importButtonText}>{t('audio_effects.lyrics_import') || 'Importar archivo .LRC'}</Text>
                        </TouchableOpacity>
                    </View>
                ) : isSynced ? (
                    <FlatList
                        ref={flatListRef}
                        data={parsedLyrics}
                        keyExtractor={(_, i) => i.toString()}
                        renderItem={({ item, index }) => {
                            const isActive = index === activeIndex;
                            return (
                                <TouchableOpacity
                                    onPress={() => TrackPlayer.seekTo(item.time)}
                                    activeOpacity={0.7}
                                    style={styles.lineContainer}
                                >
                                    <Text style={[styles.lineText, isActive ? styles.lineActive : styles.lineInactive]}>
                                        {item.text}
                                    </Text>
                                </TouchableOpacity>
                            );
                        }}
                        contentContainerStyle={[styles.listContent, { paddingTop, paddingBottom }]}
                        getItemLayout={(_, index) => ({ length: LYRIC_ITEM_HEIGHT, offset: LYRIC_ITEM_HEIGHT * index, index })}
                        onScrollToIndexFailed={info => {
                            flatListRef.current?.scrollToOffset({
                                offset: info.highestMeasuredFrameIndex * LYRIC_ITEM_HEIGHT,
                                animated: false,
                            });
                        }}
                        showsVerticalScrollIndicator={false}
                    />
                ) : (
                    <ScrollView
                        contentContainerStyle={[styles.plainContainer, { paddingTop: insets.top + 200, paddingBottom: insets.bottom + 320 }]}
                        showsVerticalScrollIndicator={false}
                    >
                        <Text style={styles.plainText}>{lyricsText}</Text>
                    </ScrollView>
                )}
            </View>

            {/* Gradient Masks */}
            <LinearGradient
                colors={[colors.background, colors.background, 'transparent']}
                locations={[0, 0.45, 1]}
                style={[styles.gradientMaskTop, { height: insets.top + 200 }]}
                pointerEvents="none"
            />
            <LinearGradient
                colors={['transparent', colors.background, colors.background]}
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

                <TouchableOpacity style={styles.moreButton} onPress={() => useLyricsMenuStore.getState().openMenu(track, () => {})} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
                </TouchableOpacity>
            </View>
            {/* Absolute Bottom Controls */}
            <View style={[styles.bottomContainer, { bottom: 0, paddingTop: 16, paddingBottom: insets.bottom + 20 }]}>

                {/* Progress Slider */}
                <View style={styles.progressSection}>
                    <Slider
                        style={styles.slider}
                        minimumValue={0}
                        maximumValue={duration > 0 ? duration : 1}
                        value={isSeeking ? seekValue : position}
                        minimumTrackTintColor={colors.text}
                        maximumTrackTintColor={colors.overlayAlpha20}
                        thumbTintColor={colors.text}
                        onSlidingStart={(val) => { setIsSeeking(true); setSeekValue(val); }}
                        onValueChange={(val) => setSeekValue(val)}
                        onSlidingComplete={(val) => { setIsSeeking(false); TrackPlayer.seekTo(val).catch(() => {}); }}
                    />
                    <View style={styles.timeContainer}>
                        <Text style={styles.timeText}>{formatTrackTime(displayPosition)}</Text>
                        <Text style={styles.timeText}>{formatTrackTime(duration)}</Text>
                    </View>
                </View>

                {/* Main Controls */}
                <View style={styles.controlsContainer}>
                    <TouchableOpacity onPress={toggleShuffle} style={styles.secondaryControlButton} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                        <Ionicons name={isShuffleEnabled ? 'shuffle' : 'shuffle-outline'} size={24} color={isShuffleEnabled ? colors.accentLight : colors.disabled} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => {
                            if (position > SKIP_PREVIOUS_THRESHOLD) { TrackPlayer.seekTo(0).catch(() => {}); }
                            else { TrackPlayer.skipToPrevious().catch(() => {}); }
                        }}
                        style={styles.controlButton}
                        disabled={!hasPrevious && position <= SKIP_PREVIOUS_THRESHOLD}
                    >
                        <Ionicons name="play-back" size={38} color={(hasPrevious || position > SKIP_PREVIOUS_THRESHOLD) ? colors.text : colors.disabled} />
                    </TouchableOpacity>

                    <PlayPauseButton size={84} iconType="circle" style={styles.mainControlButton} />

                    <TouchableOpacity onPress={() => TrackPlayer.skipToNext().catch(() => {})} style={styles.controlButton} disabled={!hasNext}>
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
                            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        >
                            <Ionicons
                                name="timer-outline"
                                size={24}
                                color={isSleepTimerActive ? colors.accentLight : colors.textSecondary}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={openSpeedPitch}
                            style={styles.footerButton}
                            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        >
                            <Ionicons
                                name="speedometer-outline"
                                size={24}
                                color={isSpeedPitchActive ? colors.accentLight : colors.textSecondary}
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
    album: trackModel.album.observe(),
    artist: trackModel.artist.observe(),
    artists: trackModel.queryCollaborators.observe() as any,
}))(LyricsScreenUI);

export default function LyricsScreen() {
    const activeTrackModel = usePlayerStore(state => state.activeTrack);
    if (!activeTrackModel) return null;
    return <ObservableLyricsScreenUI trackModel={activeTrackModel} />;
}

const getStyles = (colors: any, fonts: any, layout: any, spacing: any = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 }, radii: any = { sm: 4, md: 8, lg: 12, full: 9999 }, fontWeights: any = { regular: '400', semiBold: '600', bold: '700' }, shadows: any = { lg: {} }) => StyleSheet.create({
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
