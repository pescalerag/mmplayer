import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import React from 'react';
import {
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TrackPlayer, {
    useProgress
} from 'react-native-track-player';
import BlurredBackground from '../components/BlurredBackground';

import Album from '../database/models/Album';
import Artist from '../database/models/Artist';
import { usePlayerStore } from '../store/usePlayerStore';

import withObservables from '@nozbe/with-observables';
import PlayPauseButton from '../components/PlayPauseButton';
import Track from '../database/models/Track';
import { formatTrackTime } from '../utils/time';


const { width, height } = Dimensions.get('window');


// --- UI DEL REPRODUCTOR (SINCRONIZADA) ---
interface PlayerScreenUIProps {
    track: Track;
    album: Album;
    artist: Artist;
    navigation: any;
    formatTimestamp: (s: number) => string;
}

const PlayerScreenUI = ({
    track, album, artist, navigation, formatTimestamp
}: PlayerScreenUIProps) => {
    const insets = useSafeAreaInsets();
    const { position, duration } = useProgress();
    const progress = duration > 0 ? (position / duration) * 100 : 0;



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
                        <Text style={styles.headerTitle} numberOfLines={1}>{album.title}</Text>
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
                    <Text style={styles.title} numberOfLines={1}>{track.title}</Text>
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
                        <Text style={styles.artist} numberOfLines={1}>{artist.name}</Text>
                    </TouchableOpacity>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressSection}>
                    <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                    </View>
                    <View style={styles.timeContainer}>
                        <Text style={styles.timeText}>{formatTimestamp(position)}</Text>
                        <Text style={styles.timeText}>{formatTimestamp(duration)}</Text>
                    </View>
                </View>

                {/* Controls */}
                <View style={styles.controlsContainer}>
                    <TouchableOpacity onPress={() => {
                        TrackPlayer.skipToPrevious().catch(() => { });
                    }} style={styles.controlButton}>
                        <Ionicons name="play-back" size={40} color="#FFFFFF" />
                    </TouchableOpacity>

                    {/* USAMOS EL COMPONENTE UNIVERSAL AQUÍ */}
                    <PlayPauseButton size={84} iconType="circle" style={styles.mainControlButton} />

                    <TouchableOpacity onPress={() => {
                        TrackPlayer.skipToNext().catch(() => { });
                    }} style={styles.controlButton}>
                        <Ionicons name="play-forward" size={40} color="#FFFFFF" />
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
    const navigation = useNavigation();



    if (!activeTrackModel) return null;


    return (
        <ObservablePlayerScreenUI
            trackModel={activeTrackModel}
            navigation={navigation}
            formatTimestamp={formatTrackTime}
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
        padding: 32,
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
        paddingHorizontal: 32,
        marginBottom: 32,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 28,
        fontWeight: 'bold',
        fontFamily: 'Montserrat',
        marginBottom: 8,
    },
    artist: {
        color: '#B3B3B3',
        fontSize: 18,
        fontFamily: 'Montserrat',
    },
    progressSection: {
        paddingHorizontal: 32,
        marginBottom: 32,
    },
    progressBarBg: {
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#FFFFFF',
    },
    timeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 12,
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
        marginBottom: 64,
    },
    controlButton: {
        padding: 10,
    },
    mainControlButton: {
        padding: 0,
    },
});

export default PlayerScreen;