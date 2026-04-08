import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    BackHandler,
    Dimensions,
    FlatList,
    InteractionManager,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DetailHeaderLayout from '../components/DetailHeaderLayout';
import { formatAlbumDuration } from '../utils/time';

import SectionHeader from '../components/SectionHeader';
import TrackRow from '../components/TrackRow';
import { database } from '../database';
import Album from '../database/models/Album';
import Artist from '../database/models/Artist';
import Track from '../database/models/Track';
import { AlbumDetailRouteProp } from '../navigation/types';
import { usePlayerStore } from '../store/usePlayerStore';
import { Layout } from '../theme/theme';

const { width } = Dimensions.get('window');
const HEADER_HEIGHT = 380;


// ─── CONTENIDO PRINCIPAL ─────────────────────────────────────────────────────
interface Props {
    album: Album;
    artist: Artist;
    tracks: Track[];
    fromPlayer?: boolean;
}

function AlbumDetailContent({ album, artist, tracks, isLoadingTracks, fromPlayer }: Props & { isLoadingTracks: boolean }) {
    const navigation = useNavigation<any>();


    const totalDuration = tracks.reduce((sum: number, t: Track) => sum + (t.duration || 0), 0);

    const handleBack = () => {
        if (fromPlayer) {
            navigation.setParams({ fromPlayer: false });
            navigation.navigate('Player');
        } else {
            navigation.goBack();
        }
    };

    const navigateToArtist = () => {
        const state = navigation.getState();
        const previousRoute = state.routes[state.routes.length - 2];
        const params = previousRoute?.params as { artistId?: string } | undefined;

        if (previousRoute?.name === 'ArtistDetail' && params?.artistId === artist.id) {
            navigation.goBack();
        } else {
            navigation.navigate('ArtistDetail', { artistId: artist.id });
        }
    };

    // CONTROL DEL BOTÓN ATRÁS FÍSICO (ANDROID)
    useFocusEffect(
        React.useCallback(() => {
            const onBackPress = () => {
                if (fromPlayer) {
                    // Limpiamos el flag para evitar bucles si vuelven a esta pantalla
                    navigation.setParams({ fromPlayer: false });
                    navigation.navigate('Player');
                    return true;
                }
                return false;
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [fromPlayer, navigation])
    );

    const handleTrackPress = React.useCallback((trackId: string) => {
        const trackIndex = tracks.findIndex(t => t.id === trackId);
        if (trackIndex !== -1) {
            usePlayerStore.getState().loadQueue(tracks, trackIndex);
        }
    }, [tracks]);

    const renderHeader = () => (
        <>
            <DetailHeaderLayout
                title={album.title}
                imageUrl={album.coverUrl}
                placeholderIcon="albums"
                subtitle={
                    artist && (
                        <TouchableOpacity onPress={navigateToArtist}>
                            <Text style={styles.artistNameLink}>{artist.name}</Text>
                        </TouchableOpacity>
                    )
                }
                metaInfo={`${album.year ? `${album.year} · ` : ''}${tracks.length} ${tracks.length === 1 ? 'canción' : 'canciones'}${!isLoadingTracks && totalDuration > 0 ? ` · ${formatAlbumDuration(totalDuration)}` : ''}`}
                onBack={handleBack}
                onHome={() => navigation.popToTop()}
                renderExtra={() => (
                    tracks.length > 0 && (
                        <TouchableOpacity
                            style={styles.playFab}
                            onPress={() => usePlayerStore.getState().loadQueue(tracks, 0)}
                        >
                            <Ionicons name="play" size={28} color="#FFFFFF" />
                        </TouchableOpacity>
                    )
                )}
            />

            {/* ── SECCIÓN DE CANCIONES (FUERA DEL HEADER FIJO) ── */}
            <View style={{ marginTop: 0, marginBottom: 4 }}>
                <SectionHeader title="Canciones" />
                <View style={styles.divider} />
            </View>
        </>
    );

    const renderItem = React.useCallback(({ item, index }: { item: Track; index: number }) => {
        const showDiscHeader = index === 0 || tracks[index - 1].discNumber !== item.discNumber;

        return (
            <View>
                {showDiscHeader && item.discNumber && item.discNumber > 1 && (
                    <View style={styles.discHeader}>
                        <Ionicons name="disc-outline" size={16} color="#8B5CF6" />
                        <Text style={styles.discText}>Disco {item.discNumber}</Text>
                    </View>
                )}
                <TrackRow
                    track={item}
                    index={item.trackNumber || (index + 1)}
                    artistName={artist?.name}
                    onPress={handleTrackPress}
                />
            </View>
        );
    }, [tracks, artist, handleTrackPress]);

    const insets = useSafeAreaInsets();

    return (
        <View style={styles.container}>
            <FlatList
                data={isLoadingTracks ? [] : tracks}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={
                    isLoadingTracks ? (
                        <ActivityIndicator color="#8B5CF6" size="large" style={{ marginTop: 40 }} />
                    ) : (
                        <Text style={styles.emptyText}>Este álbum no tiene canciones escaneadas.</Text>
                    )
                }
                getItemLayout={(data, index) => ({
                    length: 64,
                    offset: 64 * index,
                    index,
                })}
                removeClippedSubviews={Platform.OS === 'android'}
                initialNumToRender={12}
                maxToRenderPerBatch={10}
                windowSize={5}
                contentContainerStyle={{ paddingBottom: Layout.MINI_PLAYER_HEIGHT + Layout.TAB_BAR_HEIGHT + Layout.PLAYER_MARGIN + insets.bottom }}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────
export default function AlbumDetailScreen() {
    const route = useRoute<AlbumDetailRouteProp>();
    const { albumId } = route.params;

    const [album, setAlbum] = useState<Album | null>(null);
    const [artist, setArtist] = useState<Artist | null>(null);
    const [tracks, setTracks] = useState<Track[]>([]);
    const [areTracksReady, setAreTracksReady] = useState(false);

    useEffect(() => {
        const loadHeaderData = async () => {
            try {
                // 1. Cargar el álbum e inmediatamente su artista
                const albumDoc = await database.collections.get<Album>('albums').find(albumId);
                const artistDoc = await albumDoc.artist.fetch();
                setAlbum(albumDoc);
                setArtist(artistDoc);
            } catch (error) {
                console.error('Error cargando AlbumDetail Header:', error);
            }
        };

        const loadTracks = async () => {
            try {
                const tracksDocs = await database.collections.get<Track>('tracks')
                    .query(
                        Q.where('album_id', albumId),
                        Q.sortBy('disc_number', Q.asc),
                        Q.sortBy('track_number', Q.asc)
                    )
                    .fetch();
                setTracks(tracksDocs);
                setAreTracksReady(true);
            } catch (error) {
                console.error('Error cargando AlbumDetail Tracks:', error);
            }
        };

        // Cargar lo ligero de inmediato
        loadHeaderData();

        // Diferir lo pesado para después de la navegación
        const task = InteractionManager.runAfterInteractions(() => {
            loadTracks();
        });

        return () => task.cancel();
    }, [albumId]);

    if (!album) {
        return (
            <View style={[styles.container, { backgroundColor: '#121212' }]} />
        );
    }

    return (
        <AlbumDetailContent
            album={album}
            artist={artist!}
            tracks={tracks}
            isLoadingTracks={!areTracksReady}
            fromPlayer={route.params.fromPlayer}
        />
    );
}

// ─── ESTILOS ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    headerContainer: {
        width,
        height: HEADER_HEIGHT,
        position: 'relative',
    },
    headerImage: {
        width,
        height: HEADER_HEIGHT,
    },
    headerPlaceholder: {
        backgroundColor: '#282828',
        justifyContent: 'center',
        alignItems: 'center',
    },
    gradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: HEADER_HEIGHT * 0.75,
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 16,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerInfo: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
    },
    albumTitle: {
        color: '#FFFFFF',
        fontSize: 28,
        fontFamily: 'Montserrat',
        fontWeight: 'bold',
        marginBottom: 4,
    },
    artistName: {
        color: '#8B5CF6',
        fontSize: 16,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        marginBottom: 4,
    },
    artistNameLink: {
        color: '#8B5CF6',
        fontSize: 16,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        textDecorationLine: 'underline',
    },
    albumMeta: {
        color: '#CCCCCC',
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '600',
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
    divider: {
        height: 1,
        backgroundColor: '#282828',
        marginHorizontal: 20,
        marginBottom: 4,
    },
    emptyText: {
        color: '#B3B3B3',
        textAlign: 'center',
        marginTop: 40,
        fontSize: 15,
    },
    discHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 8,
    },
    discText: {
        color: '#8B5CF6',
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: 'bold',
        marginLeft: 8,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
});