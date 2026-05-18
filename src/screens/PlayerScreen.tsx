import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import Slider from '@react-native-community/slider';
import {
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TrackPlayer, {
    useProgress,
    useTrackPlayerEvents,
    Event,
    RepeatMode,
} from 'react-native-track-player';
import BlurredBackground from '../components/BlurredBackground';

import Album from '../database/models/Album';
import Artist from '../database/models/Artist';
import { usePlayerStore } from '../store/usePlayerStore';
import { useQueueSheetStore } from '../store/useQueueSheetStore';

import withObservables from '@nozbe/with-observables';
import PlayPauseButton from '../components/PlayPauseButton';
import Track from '../database/models/Track';
import { formatTrackTime } from '../utils/time';
import MarqueeText from '../components/MarqueeText';


const { width } = Dimensions.get('window');


// --- UI DEL REPRODUCTOR (SINCRONIZADA) ---
interface PlayerScreenUIProps {
    track: Track;
    album: Album;
    artist: Artist;
    navigation: any;
    formatTimestamp: (s: number) => string;
    hasNext: boolean;
    hasPrevious: boolean;
}

const PlayerScreenUI = ({
    track, album, artist, navigation, formatTimestamp, hasNext, hasPrevious
}: PlayerScreenUIProps) => {
    const insets = useSafeAreaInsets();
    const openQueue = useQueueSheetStore(state => state.openQueue);
    const { position, duration } = useProgress();

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

    useEffect(() => {
        TrackPlayer.getRepeatMode().then(setRepeatModeState).catch(() => {});
    }, []);

    const toggleShuffle = async () => {
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
                // Buscar la canción actual en la cola original por ID
                const currentTrack = currentQueue[currentIndex];
                const originalIdx = shuffleOriginalQueue.findIndex(t => t.id === currentTrack?.id);
                const restoreFrom = originalIdx >= 0 ? originalIdx + 1 : currentIndex + 1;
                const tracksToRestore = shuffleOriginalQueue.slice(restoreFrom);
                await TrackPlayer.removeUpcomingTracks();
                if (tracksToRestore.length > 0) await TrackPlayer.add(tracksToRestore);
                // Limpiar el store global
                setShuffleState(false, []);
            }
        } catch (e) {
            console.error('Error toggling shuffle:', e);
        }
    };

    const cycleRepeatMode = async () => {
        try {
            const next =
                repeatMode === RepeatMode.Off   ? RepeatMode.Queue :
                repeatMode === RepeatMode.Queue  ? RepeatMode.Track :
                                                   RepeatMode.Off;
            await TrackPlayer.setRepeatMode(next);
            setRepeatModeState(next);
        } catch (e) {
            console.error('Error cycling repeat mode:', e);
        }
    };



    return (
        <View style={styles.container}>
            {/* Background Image with Blur */}
            <BlurredBackground
                imageUrl={album.coverUrl}
                blurIntensity={80}
                gradientColors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)', '#000000']}
            />

            <View style={styles.safeArea}>
                {/* Header */}
                <View style={[styles.header, { marginTop: insets.top }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.dismissButton}>
                        <Ionicons name="chevron-down" size={32} color="#FFFFFF" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.headerTextContainer}
                        onPress={() => {
                            navigation.goBack();
                            navigation.navigate('Main', {
                                screen: 'Biblioteca',
                                params: {
                                    screen: 'AlbumDetail',
                                    params: { albumId: album.id, fromPlayer: true }
                                }
                            });
                        }}
                    >
                        <MarqueeText
                            text={album.title}
                            style={styles.headerTitle}
                            speed={35}
                            pauseDuration={2000}
                        />
                    </TouchableOpacity>

                    <View style={{ width: 40 }} />
                </View>

                {/* Artwork */}
                <View style={styles.artworkContainer}>
                    {album.coverUrl ? (
                        <Image
                            source={{ uri: album.coverUrl }}
                            style={styles.artwork}
                            contentFit="cover"
                            transition={300}
                            cachePolicy="memory-disk"
                        />
                    ) : (
                        <View style={[styles.artwork, styles.artworkPlaceholder]}>
                            <Ionicons name="musical-note" size={120} color="#535353" />
                        </View>
                    )}
                </View>

                {/* Info */}
                <View style={styles.infoContainer}>
                    <MarqueeText
                        text={track.title}
                        style={styles.title}
                        speed={45}
                        pauseDuration={1800}
                    />
                    <TouchableOpacity
                        onPress={() => {
                            navigation.goBack();
                            navigation.navigate('Main', {
                                screen: 'Biblioteca',
                                params: {
                                    screen: 'ArtistDetail',
                                    params: { artistId: artist.id, fromPlayer: true }
                                }
                            });
                        }}
                    >
                        <MarqueeText
                            text={artist.name}
                            style={styles.artist}
                            speed={35}
                            pauseDuration={2000}
                        />
                    </TouchableOpacity>
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
                            TrackPlayer.seekTo(value).catch(() => {});
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
                        onPress={() => TrackPlayer.skipToPrevious().catch(() => {})}
                        style={styles.controlButton}
                        disabled={!hasPrevious}
                    >
                        <Ionicons name="play-back" size={38} color={hasPrevious ? '#FFFFFF' : '#535353'} />
                    </TouchableOpacity>

                    <PlayPauseButton size={84} iconType="circle" style={styles.mainControlButton} />

                    {/* ── SIGUIENTE ── */}
                    <TouchableOpacity
                        onPress={() => TrackPlayer.skipToNext().catch(() => {})}
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
        borderRadius: 20,
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
    },
    infoContainer: {
        paddingHorizontal: 20,
        marginBottom: 8,
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
        fontFamily: 'Montserrat',
    },
    progressSection: {
        paddingHorizontal: 16,
        marginBottom: 20,
    },
    slider: {
        width: '100%',
        height: 40,
        marginVertical: -8,
    },
    timeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 4,
        marginTop: 4,
    },
    timeText: {
        color: '#B3B3B3',
        fontSize: 12,
        fontFamily: 'Montserrat',
    },
    controlsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: 32,
        marginBottom: 16,
    },
    controlButton: {
        padding: 10,
    },
    mainControlButton: {
        padding: 0,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: 32,
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
        color: '#A78BFA',
        fontSize: 9,
        fontFamily: 'Montserrat',
        fontWeight: '800',
    },
});

export default PlayerScreen;