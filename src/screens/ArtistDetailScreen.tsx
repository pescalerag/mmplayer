import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import withObservables from '@nozbe/with-observables';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    Dimensions,
    FlatList,
    InteractionManager,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DetailHeaderLayout from '../components/DetailHeaderLayout';

import LibraryCard from '../components/LibraryCard';
import SectionHeader from '../components/SectionHeader';
import TrackRow from '../components/TrackRow';
import { database } from '../database';
import Album from '../database/models/Album';
import Artist from '../database/models/Artist';
import Track from '../database/models/Track';
import { ArtistDetailRouteProp } from '../navigation/types';
import { usePlayerStore } from '../store/usePlayerStore';
import { Layout } from '../theme/theme';

const { width } = Dimensions.get('window');
const HEADER_HEIGHT = 380;

const sanitizeArtistName = (name: string) => {
    return name
        .toLowerCase()
        .normalize("NFD")
        .replaceAll(/[\u0300-\u036f]/g, "")
        .replaceAll(/[^a-z0-9]/g, "_")
        .replaceAll(/_+/g, "_")
        .trim();
};
const ALBUMS_PREVIEW = 6;
const TRACKS_PREVIEW = 10;

// ----- COMPONENTES AUXILIARES MEMOIZADOS -----

const ArtistTrackRow = withObservables(['track', 'onPress'], ({ track, onPress }: { track: Track; onPress?: (trackId: string) => void }) => ({
    track,
    album: track.album.observe(),
}))(function ArtistTrackRow({ track, album, index, contextId, onPress }: { track: Track; album: Album; index?: number; contextId: string; onPress?: (trackId: string) => void }) {
    return (
        <TrackRow
            track={track}
            contextId={contextId}
            index={index}
            coverUrl={album?.coverUrl}
            onPress={onPress}
        />
    );
});

const AlbumCardWithNav = memo(function AlbumCardWithNav({ album, onPress }: { album: Album; onPress: () => void }) {
    return (
        <View style={styles.albumCardWrapper}>
            <LibraryCard
                title={album.title}
                imageUrl={album.coverUrl}
                placeholderIcon="albums"
                onPress={onPress}
            />
        </View>
    );
});

// Componente para la cabecera separado para evitar re-renders de toda la FlatList
const ArtistHeader = memo(function ArtistHeader({
    artist,
    albums,
    tracksCount,
    isLoadingContent,
    showAllAlbums,
    setShowAllAlbums,
    handlePickPhoto,
    navigation,
    showHeaderImage,
    setImageError,
    fromPlayer,
    showAllTracks,
    setShowAllTracks
}: any) {
    const handleBack = () => {
        if (fromPlayer) {
            navigation.setParams({ fromPlayer: false });
            navigation.navigate('Player');
        } else {
            navigation.goBack();
        }
    };

    const albumLabel = albums.length === 1 ? 'álbum' : 'álbumes';
    const trackLabel = tracksCount === 1 ? 'canción' : 'canciones';
    const metaInfo = isLoadingContent
        ? 'Cargando contenido...'
        : `${albums.length} ${albumLabel} · ${tracksCount} ${trackLabel}`;

    return (
        <>
            <DetailHeaderLayout
                title={artist.name}
                imageUrl={showHeaderImage ? artist.imageUrl : null}
                placeholderIcon="person"
                metaInfo={metaInfo}
                onBack={handleBack}
                onHome={() => navigation.popToTop()}
                renderExtra={() => (
                    <TouchableOpacity style={styles.photoButton} onPress={handlePickPhoto}>
                        <Ionicons name="camera" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                )}
            />

            {(albums.length > 0 || isLoadingContent) && (
                <View style={{ marginBottom: 16 }}>
                    <SectionHeader
                        title="Álbumes"
                        showSeeAll={albums.length > ALBUMS_PREVIEW && !showAllAlbums}
                        onSeeAll={() => setShowAllAlbums(true)}
                    />
                    {isLoadingContent ? (
                        <View style={{ height: 160, justifyContent: 'center' }}>
                            <ActivityIndicator color="#8B5CF6" />
                        </View>
                    ) : (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.albumsScroll}
                        >
                            {(showAllAlbums ? albums : albums.slice(0, ALBUMS_PREVIEW)).map((album: Album) => (
                                <AlbumCardWithNav
                                    key={album.id}
                                    album={album}
                                    onPress={() => {
                                        const state = navigation.getState();
                                        const previousRoute = state.routes[state.routes.length - 2];
                                        const params = previousRoute?.params as { albumId?: string } | undefined;

                                        if (previousRoute?.name === 'AlbumDetail' && params?.albumId === album.id) {
                                            navigation.goBack();
                                        } else {
                                            navigation.navigate('AlbumDetail', { albumId: album.id });
                                        }
                                    }}
                                />
                            ))}
                        </ScrollView>
                    )}
                </View>
            )}

            {(tracksCount > 0 || isLoadingContent) && (
                <View style={{ marginBottom: 8 }}>
                    <SectionHeader
                        title="Canciones"
                        showSeeAll={tracksCount > TRACKS_PREVIEW && !showAllTracks}
                        onSeeAll={() => setShowAllTracks(true)}
                    />
                    <View style={styles.tracksDivider} />
                </View>
            )}
        </>
    );
});

const cleanupOldImage = async (oldPath: string | null | undefined, newPath: string) => {
    if (!oldPath || oldPath === newPath || !oldPath.startsWith('file://')) return;

    try {
        await FileSystem.deleteAsync(oldPath, { idempotent: true });
    } catch (e) {
        console.warn('Silently ignored error deleting old image:', e);
    }
};

const saveImageToLocalFile = async (assetUri: string, artistName: string, oldPath: string | null | undefined) => {
    if (Platform.OS === 'web') return assetUri;

    const baseDir = FileSystem.documentDirectory;
    if (!baseDir) throw new Error('No se pudo acceder al directorio');

    const sanitized = sanitizeArtistName(artistName);
    const fileName = `artist_${sanitized}.jpg`;
    const newPath = baseDir.endsWith('/') ? `${baseDir}${fileName}` : `${baseDir}/${fileName}`;

    await cleanupOldImage(oldPath, newPath);
    await FileSystem.copyAsync({ from: assetUri, to: newPath });

    return newPath;
};

interface Props {
    artist: Artist;
    albums: Album[];
    tracks: Track[];
    isLoadingContent: boolean;
}

function ArtistDetailContentBase({ artist, albums, tracks, isLoadingContent, fromPlayer }: Props & { fromPlayer?: boolean }) {
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const [showAllAlbums, setShowAllAlbums] = useState(false);
    const [showAllTracks, setShowAllTracks] = useState(false);
    const [imageError, setImageError] = useState(false);

    useEffect(() => {
        setImageError(false);
    }, [artist.imageUrl]);

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

    const visibleTracks = useMemo(() => {
        if (isLoadingContent) return [];
        return showAllTracks ? tracks : tracks.slice(0, TRACKS_PREVIEW);
    }, [isLoadingContent, showAllTracks, tracks]);

    const showHeaderImage = useMemo(() => !!artist.imageUrl && !imageError, [artist.imageUrl, imageError]);

    // 3. The newly simplified main callback
    const handlePickPhoto = useCallback(async () => {
        let result;

        // Step A: Pick the document
        try {
            result = await DocumentPicker.getDocumentAsync({
                type: 'image/*',
                copyToCacheDirectory: true,
            });
        } catch (error) {
            console.error('PickPhoto: Error al lanzar explorador:', error);
            Alert.alert('Error', 'Hubo un problema al abrir el explorador.');
            return;
        }

        // Early return if no asset was selected, flattening the rest of the function
        const asset = result.assets?.[0];
        if (!asset) return;

        // Step B: Process the file and update the database
        try {
            const permanentUri = await saveImageToLocalFile(asset.uri, artist.name, artist.imageUrl);

            setImageError(false);
            await database.write(async () => {
                await artist.update(a => { a.imageUrl = permanentUri; });
            });

            Alert.alert('¡Éxito!', 'La foto del artista se ha actualizado.');
        } catch (e) {
            console.error('Error guardando foto:', e);
            Alert.alert('Error', 'No se pudo guardar la foto.');
        }
    }, [artist]);

    const handleTrackPress = useCallback((trackId: string) => {
        const trackIndex = tracks.findIndex(t => t.id === trackId);
        if (trackIndex !== -1) {
            usePlayerStore.getState().loadQueue(tracks, trackIndex, `artist-${artist.id}`);
        }
    }, [tracks]);

    const renderItem = useCallback((info: { item: Track; index: number }) => {
        const { item, index } = info;
        return (
            <ArtistTrackRow
                track={item}
                contextId={`artist-${artist.id}`}
                index={index + 1}
                onPress={handleTrackPress}
            />
        );
    }, [handleTrackPress]);

    // Usamos el componente Header estable
    const listHeader = useMemo(() => (
        <ArtistHeader
            artist={artist}
            albums={albums}
            tracksCount={tracks.length}
            isLoadingContent={isLoadingContent}
            showAllAlbums={showAllAlbums}
            setShowAllAlbums={setShowAllAlbums}
            showAllTracks={showAllTracks}
            setShowAllTracks={setShowAllTracks}
            handlePickPhoto={handlePickPhoto}
            navigation={navigation}
            showHeaderImage={showHeaderImage}
            setImageError={setImageError}
            fromPlayer={fromPlayer}
        />
    ), [artist, albums, tracks.length, isLoadingContent, showAllAlbums, showAllTracks, handlePickPhoto, navigation, showHeaderImage, fromPlayer]);

    return (
        <View style={styles.container}>
            <FlatList
                data={visibleTracks}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                ListHeaderComponent={listHeader}
                ListEmptyComponent={
                    isLoadingContent ? (
                        <ActivityIndicator color="#8B5CF6" size="large" style={{ marginTop: 40 }} />
                    ) : (
                        <Text style={styles.emptyText}>Este artista no tiene canciones escaneadas.</Text>
                    )
                }
                initialNumToRender={12}
                maxToRenderPerBatch={10}
                windowSize={10}
                contentContainerStyle={{ paddingBottom: Layout.MINI_PLAYER_HEIGHT + Layout.TAB_BAR_HEIGHT + Layout.PLAYER_MARGIN + insets.bottom }}
                showsVerticalScrollIndicator={false}
                // Importante para evitar saltos
                maintainVisibleContentPosition={{
                    autoscrollToTopThreshold: 0,
                    minIndexForVisible: 0,
                }}
            />
        </View>
    );
}

const ArtistDetailContent = withObservables(['artist'], ({ artist }: { artist: Artist }) => ({
    artist: artist.observe(),
}))(ArtistDetailContentBase);

export default function ArtistDetailScreen() {
    const route = useRoute<ArtistDetailRouteProp>();
    const { artistId } = route.params;

    const [artist, setArtist] = useState<Artist | null>(null);
    const [albums, setAlbums] = useState<Album[]>([]);
    const [tracks, setTracks] = useState<Track[]>([]);
    const [areAlbumsReady, setAreAlbumsReady] = useState(false);

    useEffect(() => {
        const loadArtistData = async () => {
            try {
                const artistDoc = await database.collections.get<Artist>('artists').find(artistId);
                setArtist(artistDoc);
            } catch (error) {
                console.error('Error cargando ArtistDetail Artist:', error);
                Alert.alert('Error', 'No se pudo cargar la información del artista.');
            }
        };

        const loadContent = async () => {
            try {
                const albumsDocs = await database.collections.get<Album>('albums')
                    .query(Q.where('artist_id', artistId))
                    .fetch();
                setAlbums(albumsDocs);

                const tracksDocs = await database.collections.get<Track>('tracks')
                    .query(Q.on('track_collaborators', 'artist_id', artistId))
                    .fetch();
                setTracks(tracksDocs);
                setAreAlbumsReady(true);
            } catch (error) {
                console.error('Error cargando ArtistDetail Content:', error);
            }
        };

        loadArtistData();
        const task = InteractionManager.runAfterInteractions(() => {
            loadContent();
        });
        return () => task.cancel();
    }, [artistId]);

    if (!artist) {
        return <View style={[styles.container, { backgroundColor: '#121212' }]} />;
    }

    return (
        <ArtistDetailContent
            artist={artist}
            albums={albums}
            tracks={tracks}
            isLoadingContent={!areAlbumsReady}
            fromPlayer={route.params.fromPlayer}
        />
    );
}

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
        height: HEADER_HEIGHT * 0.7,
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
    photoButton: {
        position: 'absolute',
        top: 50,
        right: 16,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerInfo: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
    },
    artistName: {
        color: '#FFFFFF',
        fontSize: 32,
        fontFamily: 'Montserrat',
        fontWeight: 'bold',
        marginBottom: 4,
    },
    artistStats: {
        color: '#CCCCCC',
        fontSize: 15,
        fontFamily: 'Montserrat',
        fontWeight: '600',
    },
    albumsScroll: {
        paddingLeft: 20,
        paddingRight: 8,
    },
    albumCardWrapper: {
        marginRight: 12,
    },
    tracksDivider: {
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
});