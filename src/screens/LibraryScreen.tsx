import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import withObservables from '@nozbe/with-observables';
import { useNavigation, useScrollToTop } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, FlatList, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LibraryCard from '../components/LibraryCard';
import PlaylistCover from '../components/PlaylistCover';
import TrackRow from '../components/TrackRow';
import { database } from '../database';
import Album from '../database/models/Album';
import Artist from '../database/models/Artist';
import Playlist from '../database/models/Playlist';
import Track from '../database/models/Track';
import { LibraryNavigationProp } from '../navigation/types';
import { ScannerService } from '../services/ScannerService';
import { useAlbumMenuStore } from '../store/useAlbumMenuStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { usePlaylistSelectorStore } from '../store/usePlaylistSelectorStore';
import { Layout } from '../theme/theme';


// ----- CONSTANTES COMPARTIDAS -----
const cardWidth = (Dimensions.get('window').width - 70) / 3;

// ----- TRACK ITEMS -----
const TrackCard = ({ track, album, artists }: { track: Track, album: Album, artists: any }) => {
    const artistNames = (artists as Artist[]).length > 0
        ? (artists as Artist[]).map(a => a.name).join(', ')
        : 'Artista Desconocido';

    // Movemos la lógica aquí para evitar pasar funciones anidadas desde la FlatList
    const handlePress = () => {
        usePlayerStore.getState().playSingleTrack(track, 'library-songs');
    };

    return (
        <TrackRow
            track={track}
            contextId="library-songs"
            coverUrl={album?.coverUrl}
            artistName={artistNames}
            onPress={handlePress}
        />
    );
};

// 1. CORRECCIÓN: Quitamos 'onPress' del array de dependencias. 
// Ahora solo escucha los cambios del modelo 'track'.
const EnhancedTrackCard = withObservables(['track'], ({ track }: { track: Track }) => ({
    track: track.observe(),
    album: track.album.observe(),
    artists: track.queryCollaborators.observe(),
}))(TrackCard);

const TrackList = ({ tracks, bottomOffset, topOffset, scrollRef }: { tracks: Track[], bottomOffset: number, topOffset: number, scrollRef: any }) => {

    // 2. CORRECCIÓN: Usamos useCallback para que la función de renderizado sea estable en memoria.
    const renderItem = React.useCallback((info: { item: Track }) => {
        const { item } = info;
        return <EnhancedTrackCard track={item} />;
    }, []);

    return (
        <FlatList
            ref={scrollRef}
            data={tracks}
            keyExtractor={t => t.id}
            renderItem={renderItem}
            contentContainerStyle={[styles.trackListContainer, { paddingBottom: bottomOffset, paddingTop: topOffset }]}
            ListEmptyComponent={
                <Text style={styles.emptyText}>No hay canciones en la biblioteca.</Text>
            }
            getItemLayout={(data, index) => ({
                length: 64,
                offset: 64 * index,
                index,
            })}
            initialNumToRender={20}
            maxToRenderPerBatch={10}
            windowSize={5}
        />
    );
};

const EnhancedTrackList = withObservables([], () => ({
    // Añadimos sortBy para que la lista sea predecible y no salte al actualizarse
    tracks: database.collections
        .get<Track>('tracks')
        .query(Q.sortBy('title', Q.asc))
        .observe(),
}))(TrackList);

// ----- ALBUM ITEMS -----
const AlbumCard = ({ album, artist, onPress }: { album: Album, artist: Artist, onPress?: () => void }) => {
    return (
        <LibraryCard
            title={album.title}
            subtitle={artist?.name || 'Artista desconocido'}
            imageUrl={album.coverUrl}
            placeholderIcon="albums"
            onPress={onPress}
            onLongPress={() => useAlbumMenuStore.getState().openMenu(album)}
        />
    );
};

const EnhancedAlbumCard = withObservables(['album'], ({ album }: { album: Album }) => ({
    album: album.observe(),
    artist: album.artist.observe(),
}))(AlbumCard);

const AlbumList = ({ albums, bottomOffset, topOffset, scrollRef }: { albums: Album[], bottomOffset: number, topOffset: number, scrollRef: any }) => {
    const navigation = useNavigation<LibraryNavigationProp>();
    return (
        <FlatList
            ref={scrollRef}
            data={albums}
            keyExtractor={a => a.id}
            renderItem={({ item }) => (
                <EnhancedAlbumCard
                    album={item}
                    onPress={() => navigation.navigate('AlbumDetail', { albumId: item.id })}
                />
            )}
            numColumns={3}
            contentContainerStyle={[styles.listContainer, { paddingBottom: bottomOffset, paddingTop: topOffset }]}
            columnWrapperStyle={styles.columnWrapper}
            ListEmptyComponent={
                <Text style={styles.emptyText}>No hay álbumes en la biblioteca.</Text>
            }
            getItemLayout={(data, index) => {
                const rowHeight = cardWidth + 45;
                return {
                    length: rowHeight,
                    offset: rowHeight * Math.floor(index / 3),
                    index,
                };
            }}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={10}
        />
    );
};

const EnhancedAlbumList = withObservables([], () => ({
    albums: database.collections.get<Album>('albums').query(Q.sortBy('title', Q.asc)).observe(),
}))(AlbumList);


// ----- ARTIST ITEMS -----
const ArtistCard = ({ artist, onPress }: { artist: Artist, onPress?: () => void }) => {
    return (
        <LibraryCard
            title={artist.name}
            imageUrl={artist.imageUrl}
            placeholderIcon="person"
            onPress={onPress}
        />
    );
};

const EnhancedArtistCard = withObservables(['artist'], ({ artist }: { artist: Artist }) => ({
    artist: artist.observe(),
}))(ArtistCard);

const ArtistList = ({ artists, bottomOffset, topOffset, scrollRef }: { artists: Artist[], bottomOffset: number, topOffset: number, scrollRef: any }) => {
    const navigation = useNavigation<LibraryNavigationProp>();
    return (
        <FlatList
            ref={scrollRef}
            data={artists}
            keyExtractor={a => a.id}
            renderItem={({ item }) => (
                <EnhancedArtistCard
                    artist={item}
                    onPress={() => navigation.navigate('ArtistDetail', { artistId: item.id })}
                />
            )}
            numColumns={3}
            contentContainerStyle={[styles.listContainer, { paddingBottom: bottomOffset, paddingTop: topOffset }]}
            columnWrapperStyle={styles.columnWrapper}
            ListEmptyComponent={
                <Text style={styles.emptyText}>No hay artistas en la biblioteca.</Text>
            }
            getItemLayout={(data, index) => {
                const rowHeight = cardWidth + 45;
                return {
                    length: rowHeight,
                    offset: rowHeight * Math.floor(index / 3),
                    index,
                };
            }}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={10}
        />
    );
};

const EnhancedArtistList = withObservables([], () => ({
    artists: database.collections.get<Artist>('artists').query(Q.sortBy('name', Q.asc)).observe(),
}))(ArtistList);


// ----- PLAYLIST ITEMS -----
interface PlaylistCardProps {
    playlistId: string;
    isFavorites?: boolean;
    title: string;
    subtitle?: string;
    customCoverUrl?: string | null;
    onPress?: () => void;
}

const PlaylistCard = memo(function PlaylistCard({
    playlistId,
    isFavorites = false,
    title,
    subtitle,
    customCoverUrl,
    onPress
}: PlaylistCardProps) {
    return (
        <TouchableOpacity style={styles.playlistCard} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.playlistImageContainer}>
                <PlaylistCover
                    playlistId={playlistId}
                    isFavorites={isFavorites}
                    customCoverUrl={customCoverUrl}
                    size={cardWidth}
                />
            </View>
            <Text style={styles.playlistTitle} numberOfLines={1}>{title}</Text>
            {subtitle && (
                <Text style={styles.playlistSubtitle} numberOfLines={1}>{subtitle}</Text>
            )}
        </TouchableOpacity>
    );
});

const EnhancedPlaylistCard = withObservables(['playlist'], ({ playlist }: { playlist: Playlist }) => ({
    playlist: playlist.observe(),
}))(({ playlist, onPress }: { playlist: Playlist, onPress?: () => void }) => {
    return (
        <PlaylistCard
            playlistId={playlist.id}
            title={playlist.name}
            subtitle={playlist.description || 'Playlist'}
            customCoverUrl={playlist.coverCustomUrl}
            onPress={onPress}
        />
    );
});

const PlaylistsList = ({ playlists, bottomOffset, topOffset, scrollRef }: { playlists: Playlist[], bottomOffset: number, topOffset: number, scrollRef: any }) => {
    const navigation = useNavigation<LibraryNavigationProp>();

    const data = React.useMemo(() => {
        return [
            { id: 'create_new', isCreateNew: true, name: 'Crear Playlist' },
            { id: 'favorites', name: 'Tus Favoritos', isFavorites: true, coverCustomUrl: null, description: 'Lista de favoritas' },
            ...playlists
        ];
    }, [playlists]);

    return (
        <FlatList
            ref={scrollRef}
            data={data}
            keyExtractor={p => p.id}
            renderItem={({ item }) => {
                if ('isCreateNew' in item) {
                    return (
                        <TouchableOpacity
                            style={styles.playlistCard}
                            onPress={() => usePlaylistSelectorStore.getState().openCreate()}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.playlistImageContainer, { justifyContent: 'center', alignItems: 'center' }]}>
                                <Ionicons name="add" size={48} color="#7d7d7dff" />
                            </View>
                            <Text style={styles.playlistTitle} numberOfLines={1}>{item.name}</Text>
                        </TouchableOpacity>
                    );
                }

                const isFav = 'isFavorites' in item && !!(item as any).isFavorites;
                if (isFav) {
                    return (
                        <PlaylistCard
                            playlistId="favorites"
                            isFavorites={true}
                            title={item.name}
                            subtitle="Especial"
                            onPress={() => navigation.navigate('FavoritesDetail')}
                        />
                    );
                } else {
                    return (
                        <EnhancedPlaylistCard
                            playlist={item as Playlist}
                            onPress={() => navigation.navigate('PlaylistDetail', { playlistId: item.id })}
                        />
                    );
                }
            }}
            numColumns={3}
            contentContainerStyle={[styles.listContainer, { paddingBottom: bottomOffset, paddingTop: topOffset }]}
            columnWrapperStyle={styles.columnWrapper}
            ListEmptyComponent={
                <Text style={styles.emptyText}>No hay listas de reproducción.</Text>
            }
            getItemLayout={(data, index) => {
                const rowHeight = cardWidth + 45;
                return {
                    length: rowHeight,
                    offset: rowHeight * Math.floor(index / 3),
                    index,
                };
            }}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={10}
        />
    );
};

const EnhancedPlaylistsList = withObservables([], () => ({
    playlists: database.collections.get<Playlist>('playlists').query(Q.sortBy('created_at', Q.desc)).observe(),
}))(PlaylistsList);


type TabType = 'albums' | 'artists' | 'tracks' | 'playlists';

export default function LibraryScreen() {
    const insets = useSafeAreaInsets();
    const [activeTab, setActiveTab] = useState<TabType>('albums');
    const [scanning, setScanning] = useState(false);
    const scanningRef = useRef(false);

    // Estado para guardar la altura dinámica del Título + Selectores
    const [headerHeight, setHeaderHeight] = useState(130);

    // bottomOffset reajustado para subir la última fila sobre el mini reproductor y la tab bar
    // TabBar + MiniPlayer + Margen
    const bottomOffset = Layout.MINI_PLAYER_HEIGHT + Layout.TAB_BAR_HEIGHT + Layout.PLAYER_MARGIN + insets.bottom;

    const flatListRef = useRef<FlatList>(null);
    useScrollToTop(flatListRef);

    const navigation = useNavigation<LibraryNavigationProp>();

    useEffect(() => {
        const tabNavigator: any = navigation.getParent();
        if (!tabNavigator) return;

        const unsubscribe = tabNavigator.addListener('tabPress', (e: any) => {
            const state = tabNavigator.getState();
            const currentRoute = state.routes[state.index];

            if (currentRoute.key === e.target) {
                setActiveTab('albums');
            }
        });

        return unsubscribe;
    }, [navigation]);

    const syncLibrary = useCallback(async () => {
        if (Platform.OS !== 'android' || scanningRef.current) return;

        scanningRef.current = true;
        setScanning(true);
        try {
            await ScannerService.cleanDeletedFiles();
            await ScannerService.autoScanAndroid();
        } catch (error) {
            console.error('Scan error:', error);
        } finally {
            setScanning(false);
            scanningRef.current = false;
        }
    }, []);

    useEffect(() => {
        syncLibrary();
    }, [syncLibrary]);

    return (
        <LinearGradient
            colors={['#000000', '#22222221', '#000000']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.container} // Quitamos el padding de aquí para que el humo empiece exacto en top: 0
        >
            {/* 1. CAPA DE LISTAS (AL FONDO) */}
            <View style={StyleSheet.absoluteFill}>
                {activeTab === 'albums' && <EnhancedAlbumList bottomOffset={bottomOffset} topOffset={headerHeight + 20} scrollRef={flatListRef} />}
                {activeTab === 'artists' && <EnhancedArtistList bottomOffset={bottomOffset} topOffset={headerHeight + 20} scrollRef={flatListRef} />}
                {activeTab === 'tracks' && <EnhancedTrackList bottomOffset={bottomOffset} topOffset={headerHeight + 20} scrollRef={flatListRef} />}
                {activeTab === 'playlists' && <EnhancedPlaylistsList bottomOffset={bottomOffset} topOffset={headerHeight + 20} scrollRef={flatListRef} />}
            </View>

            {/* 2. CAPA DEL HUMO (INTERMEDIO) */}
            <LinearGradient
                colors={[
                    '#000000',               // 0%: Funde perfecto con la parte superior negra del fondo
                    'rgba(0, 0, 0, 0.95)',   // 45%: Muy oscuro detrás del título
                    'rgba(0, 0, 0, 0.8)',    // 80%: Sombra sólida detrás de los selectores
                    'transparent'            // 100%: Se desvanece suavemente sobre la primera fila de álbumes
                ]}
                locations={[0, 0.45, 0.8, 1]}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    // Altura dinámica: Envuelve los selectores y baja 30px extra para crear el humo
                    height: headerHeight + 30,
                }}
                pointerEvents="none"
            />

            {/* 3. CAPA DE LA INTERFAZ (FRENTE) */}
            <View
                onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
                style={{ paddingTop: insets.top + 10 }}
            >
                <View style={styles.header}>
                    <Text style={styles.title}>Tu Biblioteca</Text>
                    <TouchableOpacity
                        onPress={syncLibrary}
                        disabled={scanning}
                        style={[styles.refreshButton, scanning && { opacity: 0.5 }]}
                    >
                        <Ionicons
                            name="refresh-outline"
                            size={28}
                            color="#8B5CF6"
                        />
                    </TouchableOpacity>
                </View>


                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabsContainer}
                >
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'albums' && styles.activeTab]}
                        onPress={() => setActiveTab('albums')}
                    >
                        <Text style={[styles.tabText, activeTab === 'albums' && styles.activeTabText]}>Álbumes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'playlists' && styles.activeTab]}
                        onPress={() => setActiveTab('playlists')}
                    >
                        <Text style={[styles.tabText, activeTab === 'playlists' && styles.activeTabText]}>Playlists</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'artists' && styles.activeTab]}
                        onPress={() => setActiveTab('artists')}
                    >
                        <Text style={[styles.tabText, activeTab === 'artists' && styles.activeTabText]}>Artistas</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'tracks' && styles.activeTab]}
                        onPress={() => setActiveTab('tracks')}
                    >
                        <Text style={[styles.tabText, activeTab === 'tracks' && styles.activeTabText]}>Canciones</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 10,
    },
    refreshButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 22,
    },
    title: {
        fontSize: 28,
        fontFamily: 'Montserrat',
        fontWeight: '900',
        color: '#FFFFFF',
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginBottom: 10,
        gap: 10,
    },
    tabButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#282828',
    },
    activeTab: {
        backgroundColor: '#8B5CF6',
    },
    tabText: {
        color: '#B3B3B3',
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    activeTabText: {
        color: '#FFFFFF',
    },
    listContainer: {
        paddingHorizontal: 20,
    },
    trackListContainer: {
    },
    columnWrapper: {
        justifyContent: 'flex-start',
        gap: 15,
    },
    emptyText: {
        color: 'gray',
        fontSize: 16,
        fontFamily: 'Montserrat',
        fontWeight: '400',
        textAlign: 'center',
        marginTop: 40,
        width: '100%',
    },
    playlistCard: {
        width: cardWidth,
        marginBottom: 20,
    },
    playlistImageContainer: {
        width: cardWidth,
        height: cardWidth,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#282828',
        marginBottom: 8,
    },
    playlistTitle: {
        color: '#FFFFFF',
        fontSize: 13,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        textAlign: 'center',
    },
    playlistSubtitle: {
        color: '#CCCCCC',
        fontSize: 11,
        fontFamily: 'Montserrat',
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 2,
    },
});