import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import withObservables from '@nozbe/with-observables';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback } from 'react';
import TrackPlayer, { usePlaybackState, State } from 'react-native-track-player';
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DetailHeaderLayout from '../components/DetailHeaderLayout';
import SectionHeader from '../components/SectionHeader';
import TrackRow from '../components/TrackRow';
import { database } from '../database';
import Album from '../database/models/Album';
import Artist from '../database/models/Artist';
import Track from '../database/models/Track';
import { HistoryService } from '../services/HistoryService';
import { usePlayerStore } from '../store/usePlayerStore';
import { Layout } from '../theme/theme';
import { formatAlbumDuration } from '../utils/time';


// ─── FAVORITES TRACK ROW COMPONENT ───
const FavoriteTrackRow = withObservables(['track'], ({ track }: { track: Track }) => ({
    track: track.observe(),
    album: track.album.observe(),
    artists: track.queryCollaborators.observe() as any,
}))(function FavoriteTrackRow({
    track,
    album,
    artists,
    index,
    onPress,
}: {
    track: Track;
    album: Album;
    artists: Artist[];
    index: number;
    onPress: (trackId: string) => void;
}) {
    const artistNames = artists.length > 0
        ? artists.map(a => a.name).join(', ')
        : 'Artista Desconocido';
    return (
        <TrackRow
            track={track}
            contextId="favorites"
            index={index}
            coverUrl={album?.coverUrl}
            artistName={artistNames}
            onPress={onPress}
        />
    );
});

// ─── MAIN FAVORITES SCREEN CONTENT ───
interface FavoritesDetailProps {
    tracks: Track[];
}

function FavoritesDetailContent({ tracks }: FavoritesDetailProps) {
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();

    // Player States
    const playbackState = usePlaybackState();
    const isPlaying = playbackState.state === State.Playing || playbackState.state === State.Buffering;
    const playbackContext = usePlayerStore(state => state.playbackContext);

    const isCurrentContext = playbackContext === 'favorites';
    const isCurrentContextPlaying = isCurrentContext && isPlaying;

    const totalDuration = tracks.reduce((sum: number, t: Track) => sum + (t.duration || 0), 0);

    const handleBack = () => {
        navigation.goBack();
    };

    const handleTrackPress = useCallback((trackId: string) => {
        const trackIndex = tracks.findIndex(t => t.id === trackId);
        if (trackIndex !== -1) {
            HistoryService.updateUIRecents({
                id: 'favorites',
                type: 'playlist',
                context: 'manual',
                title: 'Tus Favoritos',
                subtitle: 'Lista de reproducción especial',
                imageUrl: null,
            });
            usePlayerStore.getState().loadQueue(tracks, trackIndex, 'favorites');
        }
    }, [tracks]);

    const handleFabPress = async () => {
        if (isCurrentContext) {
            if (isPlaying) {
                await TrackPlayer.pause();
            } else {
                await TrackPlayer.play();
            }
        } else if (tracks.length > 0) {
            HistoryService.updateUIRecents({
                id: 'favorites',
                type: 'playlist',
                context: 'manual',
                title: 'Tus Favoritos',
                subtitle: 'Lista de reproducción especial',
                imageUrl: null,
            });
            usePlayerStore.getState().loadQueue(tracks, 0, 'favorites');
        }
    };

    const handleShuffleFabPress = () => {
        if (tracks.length > 0) {
            HistoryService.updateUIRecents({
                id: 'favorites',
                type: 'playlist',
                context: 'manual',
                title: 'Tus Favoritos',
                subtitle: 'Lista de reproducción especial',
                imageUrl: null,
            });
            usePlayerStore.getState().startShuffled(tracks, 'favorites');
        }
    };

    const renderHeader = () => (
        <>
            <DetailHeaderLayout
                title="Tus Favoritos"
                isFavorites={true}
                placeholderIcon="heart"
                subtitle="Lista de reproducción especial"
                metaInfo={`${tracks.length} ${tracks.length === 1 ? 'canción' : 'canciones'} · ${formatAlbumDuration(totalDuration)}`}
                onBack={handleBack}
                onHome={() => navigation.navigate('Biblioteca' as never)}
                renderExtra={() => (
                    tracks.length > 0 && (
                        <>
                            {/* Shuffle Button */}
                            <TouchableOpacity
                                style={styles.shuffleFab}
                                onPress={handleShuffleFabPress}
                            >
                                <Ionicons name="shuffle" size={22} color="#FFFFFF" />
                            </TouchableOpacity>

                            {/* Play/Pause Button */}
                            <TouchableOpacity
                                style={styles.playFab}
                                onPress={handleFabPress}
                            >
                                <Ionicons 
                                    name={isCurrentContextPlaying ? "pause" : "play"} 
                                    size={28} 
                                    color="#FFFFFF"
                                    style={!isCurrentContextPlaying ? { marginLeft: 4 } : {}}
                                />
                            </TouchableOpacity>
                        </>
                    )
                )}
            />

            <View style={{ marginTop: 0, marginBottom: 4 }}>
                <SectionHeader title="Canciones favoritas" />
                <View style={styles.divider} />
            </View>
        </>
    );

    const renderItem = useCallback((info: { item: Track; index: number }) => {
        const { item, index } = info;
        return (
            <FavoriteTrackRow
                track={item}
                index={index + 1}
                onPress={handleTrackPress}
            />
        );
    }, [handleTrackPress]);

    return (
        <View style={styles.container}>
            <FlatList
                data={tracks}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="heart-dislike-outline" size={60} color="#555" />
                        <Text style={styles.emptyText}>Aún no tienes canciones favoritas.</Text>
                        <Text style={styles.emptySubtitle}>Pulsa el icono del corazón en el reproductor para añadir canciones aquí.</Text>
                    </View>
                }
                getItemLayout={(data, index) => ({
                    length: 64,
                    offset: 64 * index,
                    index,
                })}
                initialNumToRender={15}
                maxToRenderPerBatch={10}
                windowSize={10}
                contentContainerStyle={{ paddingBottom: Layout.MINI_PLAYER_HEIGHT + Layout.TAB_BAR_HEIGHT + Layout.PLAYER_MARGIN + insets.bottom }}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}

// ─── ENHANCED COMPONENT WITH WATERMELONDB OBSERVABLE ───
const ObservableFavoritesDetail = withObservables([], () => ({
    tracks: database.collections.get<Track>('tracks').query(
        Q.where('is_favorite', true)
    ).observe()
}))(FavoritesDetailContent);

export default function FavoritesDetailScreen() {
    return <ObservableFavoritesDetail />;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    divider: {
        height: 1,
        backgroundColor: '#282828',
        marginHorizontal: 20,
        marginBottom: 4,
    },
    playFab: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#8B5CF6',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
    },
    shuffleFab: {
        position: 'absolute',
        bottom: 20,
        right: 86,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 60,
        paddingHorizontal: 40,
    },
    emptyText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        textAlign: 'center',
        marginTop: 16,
    },
    emptySubtitle: {
        color: '#888',
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '500',
        textAlign: 'center',
        marginTop: 8,
    },
});
