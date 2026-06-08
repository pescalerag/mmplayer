import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import {
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TrackPlayer, {
    RepeatMode,
    useProgress
} from 'react-native-track-player';
import BlurredBackground from '../components/BlurredBackground';

import Album from '../database/models/Album';
import Artist from '../database/models/Artist';
import Tag from '../database/models/Tag';
import { usePlayerStore } from '../store/usePlayerStore';
import { usePlaylistSelectorStore } from '../store/usePlaylistSelectorStore';
import { useQueueSheetStore } from '../store/useQueueSheetStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useTagManagerStore } from '../store/useTagManagerStore';

import withObservables from '@nozbe/with-observables';
import MarqueeText from '../components/MarqueeText';
import PlayPauseButton from '../components/PlayPauseButton';
import Track from '../database/models/Track';
import { useTrackMenuStore } from '../store/useTrackMenuStore';
import { formatTrackTime } from '../utils/time';
import { getDynamicTagTextColor } from '../utils/color';
import { useToastStore } from '../store/useToastStore';
import { useTranslation } from 'react-i18next';


const { width } = Dimensions.get('window');


// --- UI DEL REPRODUCTOR (SINCRONIZADA) ---
interface PlayerScreenUIProps {
    track: Track;
    album: Album;
    artist: Artist;
    artists: Artist[];
    tags: Tag[];
    navigation: any;
    formatTimestamp: (s: number) => string;
    hasNext: boolean;
    hasPrevious: boolean;
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

const PlayerScreenUI = ({
    track, album, artist, artists, tags, navigation, formatTimestamp, hasNext, hasPrevious
}: PlayerScreenUIProps) => {
    const insets = useSafeAreaInsets();
    const openQueue = useQueueSheetStore(state => state.openQueue);
    const { position, duration } = useProgress();
    const showTagColors = useSettingsStore(state => state.showTagColors);

    const artworkSource = React.useMemo(() => 
        album.coverUrl ? { uri: album.coverUrl } : null
    , [album.coverUrl]);

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

    const { t } = useTranslation();
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
        navigation.navigate('AlbumDetail', { albumId: album.id });
    };

    const handleMorePress = () => {
        useTrackMenuStore.getState().openMenu(track, {
            album: (albumId) => {
                navigation.navigate('AlbumDetail', { albumId });
            },
            artist: (artistId) => {
                navigation.navigate('ArtistDetail', { artistId });
            },
        });
    };

    const handleArtistPress = () => {
        const targetArtistId = artists && artists.length > 0 ? artists[0].id : artist?.id;
        if (!targetArtistId) return;
        navigation.navigate('ArtistDetail', { artistId: targetArtistId });
    };

    const handleOpenTagManager = React.useCallback(() => {
        useTagManagerStore.getState().openForTrack(track);
    }, [track]);

    const handleOpenPlaylistSelector = React.useCallback(() => {
        usePlaylistSelectorStore.getState().openSelector(track);
    }, [track]);

    const [imageError, setImageError] = React.useState(false);

    React.useEffect(() => {
        setImageError(false);
    }, [track.id]);

    return (
        <View style={styles.container}>
            {/* Background Image with Blur */}
            <BlurredBackground
                key={`blur-${track.id}`}
                imageUrl={album.coverUrl}
                blurIntensity={10}
                gradientColors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.7)', '#000000']}
            />

            <View style={styles.safeArea}>
                {/* Header */}
                <View style={[styles.header, { marginTop: insets.top }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.dismissButton}>
                        <Ionicons name="chevron-down" size={32} color="#FFFFFF" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.headerTextContainer}
                        onPress={handleAlbumPress}
                    >
                        <MarqueeText
                            text={album.title}
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
                        <Ionicons name="ellipsis-horizontal" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>

                {/* Artwork */}
                <View style={styles.artworkContainer}>
                    {artworkSource && !imageError ? (
                        <Image
                            key={track.id}
                            source={artworkSource}
                            style={styles.artwork}
                            contentFit="cover"
                            transition={300}
                            cachePolicy="memory-disk"
                            onError={() => setImageError(true)}
                        />
                    ) : (
                        <View style={[styles.artwork, styles.artworkPlaceholder]}>
                            <Ionicons name="musical-notes" size={80} color="#666" />
                        </View>
                    )}
                </View>

                {/* Info */}
                <View style={styles.infoContainer}>
                    <View style={styles.infoTextContainer}>
                        {/* Tags row */}
                        <View style={styles.tagsRow}>
                            {tags && tags.length > 0 ? (
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.tagsScroll}
                                >
                                    {tags.map(t => (
                                        <TouchableOpacity
                                            key={t.id}
                                            style={[styles.tagBadge, { backgroundColor: showTagColors ? t.color : 'rgba(255, 255, 255, 0.08)' }]}
                                            onPress={handleOpenTagManager}
                                        >
                                            <Text style={[styles.tagText, { color: showTagColors ? getDynamicTagTextColor(t.color) : '#FFFFFF' }]}>{t.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            ) : (
                                <TouchableOpacity
                                    style={styles.addTagButton}
                                    onPress={handleOpenTagManager}
                                >
                                    <Ionicons name="add-circle-outline" size={14} color="#B3B3B3" />
                                    <Text style={styles.addTagText}>{t('actions.add_tag')}</Text>
                                </TouchableOpacity>
                            )}
                        </View>
 
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
                                    color={track.isFavorite ? "#EF4444" : "#FFFFFF"}
                                />
                            </TouchableOpacity>
                        </Animated.View>

                        <TouchableOpacity
                            onPress={handleOpenPlaylistSelector}
                            style={styles.actionButton}
                            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        >
                            <Ionicons name="add" size={28} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Progress Slider */}
                <View style={styles.progressSection}>
                    <Slider
                        style={styles.slider}
                        minimumValue={0}
                        maximumValue={duration > 0 ? duration : 1}
                        value={isSeeking ? seekValue : position}
                        minimumTrackTintColor="#FFFFFF"
                        maximumTrackTintColor="rgba(255,255,255,0.2)"
                        thumbTintColor="#FFFFFF"
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
                    <View style={styles.timeContainer}>
                        <Text style={styles.timeText}>{formatTimestamp(displayPosition)}</Text>
                        <Text style={styles.timeText}>{formatTimestamp(duration)}</Text>
                    </View>
                </View>

                {/* Controls */}
                <View style={styles.controlsContainer}>

                    {/* ── SHUFFLE ── */}
                    <TouchableOpacity
                        onPress={toggleShuffle}
                        style={styles.secondaryControlButton}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        <Ionicons
                            name={isShuffleEnabled ? 'shuffle' : 'shuffle-outline'}
                            size={24}
                            color={isShuffleEnabled ? '#A78BFA' : '#535353'}
                        />
                    </TouchableOpacity>

                    {/* ── ANTERIOR ── */}
                    <TouchableOpacity
                        onPress={() => {
                            if (position > 3) {
                                TrackPlayer.seekTo(0).catch(() => { });
                            } else {
                                TrackPlayer.skipToPrevious().catch(() => { });
                            }
                        }}
                        style={styles.controlButton}
                        disabled={!hasPrevious && position <= 3}
                    >
                        <Ionicons name="play-back" size={38} color={(hasPrevious || position > 3) ? '#FFFFFF' : '#535353'} />
                    </TouchableOpacity>

                    <PlayPauseButton size={84} iconType="circle" style={styles.mainControlButton} />

                    {/* ── SIGUIENTE ── */}
                    <TouchableOpacity
                        onPress={() => TrackPlayer.skipToNext().catch(() => { })}
                        style={styles.controlButton}
                        disabled={!hasNext}
                    >
                        <Ionicons name="play-forward" size={38} color={hasNext ? '#FFFFFF' : '#535353'} />
                    </TouchableOpacity>

                    {/* ── REPEAT ── */}
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
                                    repeatMode === RepeatMode.Off ? '#535353' : '#A78BFA'
                                }
                            />
                            {repeatMode === RepeatMode.Track && (
                                <Text style={styles.repeatOneBadge}>1</Text>
                            )}
                        </View>
                    </TouchableOpacity>

                </View>

                {/* Footer / Secondary Actions */}
                <View style={[styles.footer, { marginBottom: insets.bottom + 10 }]}>
                    <TouchableOpacity
                        onPress={openQueue}
                        style={styles.footerButton}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        <Ionicons name="list" size={24} color="#B3B3B3" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const ObservablePlayerScreenUI = withObservables(['trackModel'], ({ trackModel }) => ({
    track: trackModel.observe(),
    album: trackModel.album.observe(),
    artist: trackModel.artist.observe(),
    artists: trackModel.queryCollaborators.observe() as any,
    tags: trackModel.queryTags.observe(),
}))(PlayerScreenUI);

const PlayerScreen = () => {
    const activeTrackModel = usePlayerStore(state => state.activeTrack);
    const hasNext = usePlayerStore(state => state.hasNext);
    const hasPrevious = usePlayerStore(state => state.hasPrevious);
    const navigation = useNavigation();



    if (!activeTrackModel) return null;


    return (
        <ObservablePlayerScreenUI
            trackModel={activeTrackModel}
            navigation={navigation}
            formatTimestamp={formatTrackTime}
            hasNext={hasNext}
            hasPrevious={hasPrevious}
        />
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        height: 60,
    },
    dismissButton: {
        padding: 4,
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        fontFamily: 'Montserrat',
        textAlign: 'center',
    },
    headerTextContainer: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 10,
    },
    artworkContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
        paddingTop: 16,
        paddingBottom: 8,
    },
    artwork: {
        width: width - 64,
        height: width - 64,
        borderRadius: 10,
        backgroundColor: '#282828',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.5,
        shadowRadius: 30,
        elevation: 10,
    },
    artworkPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#282828',
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
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tagText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontFamily: 'Montserrat',
        fontWeight: '800',
    },
    addTagButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 3,
    },
    addTagText: {
        color: '#B3B3B3',
        fontSize: 12,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    title: {
        color: '#FFFFFF',
        fontSize: 26,
        fontWeight: 'bold',
        fontFamily: 'Montserrat',
        marginBottom: 4,
    },
    artist: {
        color: '#B3B3B3',
        fontSize: 16,
        fontFamily: 'Montserrat', fontWeight: '700',
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
        color: '#B3B3B3',
        fontSize: 12,
        fontFamily: 'Montserrat', fontWeight: '700',
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
        justifyContent: 'flex-end',
        paddingHorizontal: 10,
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
        color: '#A78BFA',
        fontSize: 9,
        fontFamily: 'Montserrat',
        fontWeight: '800',
    },
});

export default PlayerScreen;