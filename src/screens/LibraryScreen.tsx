import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import withObservables from '@nozbe/with-observables';
import { useIsFocused, useNavigation, useScrollToTop } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabView } from 'react-native-tab-view';
import TrackPlayer, { State, usePlaybackState } from 'react-native-track-player';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
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
import { useArtistMenuStore } from '../store/useArtistMenuStore';
import { useFolderMenuStore } from '../store/useFolderMenuStore';
import { SortOption, useLibraryStore } from '../store/useLibraryStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { usePlaylistMenuStore } from '../store/usePlaylistMenuStore';
import { usePlaylistSelectorStore } from '../store/usePlaylistSelectorStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useSortModalStore } from '../store/useSortModalStore';
import { Colors, Layout } from '../theme/theme';

import { getSafeFileName, safeDecodeURIComponent } from '../utils/safeDecode';


// ----- CONSTANTES COMPARTIDAS -----
const { width } = Dimensions.get('window');
type GridAlignment = 'flex-start' | 'center' | 'flex-end';
const cardWidth = (width - 70) / 3;

// ----- SUB-COMPONENTES DE ESTADO VACÍO -----
const LibraryEmptyState = ({ icon, title, description }: { icon: string; title: string; description: string }) => (
    <View style={styles.emptyContainer}>
        <Ionicons name={icon as any} size={48} color="#444" style={styles.emptyIcon} />
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptySubtitle}>{description}</Text>
    </View>
);

// ----- TRACK ITEMS -----
const TrackCard = ({ track, album, artists }: { track: Track, album: Album | null, artists: any }) => {
    const { t } = useTranslation();
    const artistNames = (artists as Artist[]).length > 0
        ? (artists as Artist[]).map(a => a.name).join(', ')
        : t('actions.unknown');

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
    album: track.album.observe().pipe(catchError(() => of(null))),
    artists: track.queryCollaborators.observe(),
}))(TrackCard);

const TrackList = ({ tracks, bottomOffset, topOffset, scrollRef, sortOption }: { tracks: Track[], bottomOffset: number, topOffset: number, scrollRef: any, sortOption?: SortOption }) => {
    const { t } = useTranslation();
    const playbackState = usePlaybackState();
    const isPlaying = playbackState.state === State.Playing || playbackState.state === State.Buffering;
    const playbackContext = usePlayerStore(state => state.playbackContext);

    const contextId = 'library-all-tracks';
    const isCurrentContext = playbackContext === contextId;
    const isCurrentContextPlaying = isCurrentContext && isPlaying;

    const sortedTracks = React.useMemo(() => {
        if (sortOption === 'duration_asc' || sortOption === 'duration_desc') {
            return tracks;
        }
        const isDesc = sortOption === 'name_desc';
        return [...tracks].sort((a, b) => {
            const titleA = a.title || '';
            const titleB = b.title || '';
            const cmp = titleA.localeCompare(titleB, undefined, { sensitivity: 'base', numeric: true });
            return isDesc ? -cmp : cmp;
        });
    }, [tracks, sortOption]);

    const handlePlayPress = async () => {
        if (sortedTracks.length === 0) return;
        if (isCurrentContext) {
            if (isPlaying) {
                await TrackPlayer.pause();
            } else {
                await TrackPlayer.play();
            }
        } else {
            usePlayerStore.getState().loadQueue(sortedTracks, 0, contextId);
        }
    };

    const handleShufflePress = () => {
        if (sortedTracks.length === 0) return;
        usePlayerStore.getState().startShuffled(sortedTracks, contextId);
    };

    const renderHeader = () => {
        if (sortedTracks.length === 0) return null;
        return (
            <View style={styles.listHeaderButtons}>
                <TouchableOpacity style={styles.shuffleBtn} onPress={handleShufflePress}>
                    <Ionicons name="shuffle" size={20} color="#FFFFFF" />
                    <Text style={styles.shuffleBtnText}>{t('actions.shuffle')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.playBtn} onPress={handlePlayPress}>
                    <Ionicons name={isCurrentContextPlaying ? "pause" : "play"} size={22} color="#FFFFFF" style={isCurrentContextPlaying ? {} : { marginLeft: 4 }} />
                    <Text style={styles.playBtnText}>{isCurrentContextPlaying ? t('actions.pause') : t('actions.play')}</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderItem = React.useCallback((info: { item: Track }) => {
        const { item } = info;
        return (
            <View style={{ minHeight: 64, width: '100%' }}>
                <EnhancedTrackCard track={item} />
            </View>
        );
    }, []);

    return (
        <FlashList
            ref={scrollRef}
            data={sortedTracks}
            keyExtractor={t => t.id}
            renderItem={renderItem}
            contentContainerStyle={[styles.trackListContainer, { paddingBottom: bottomOffset, paddingTop: topOffset }]}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={
                <LibraryEmptyState
                    icon="musical-notes-outline"
                    title={t('library.empty_songs')}
                    description={t('library.empty_songs_desc')}
                />
            }
        />
    );
};

const EnhancedTrackList = withObservables(['sortOption'], ({ sortOption }: { sortOption: SortOption }) => {
    let orderCol = 'title';
    let orderDir = Q.asc;
    if (sortOption === 'name_desc') orderDir = Q.desc;
    else if (sortOption === 'duration_asc') { orderCol = 'duration'; orderDir = Q.asc; }
    else if (sortOption === 'duration_desc') { orderCol = 'duration'; orderDir = Q.desc; }

    return {
        tracks: database.collections
            .get<Track>('tracks')
            .query(Q.sortBy(orderCol, orderDir))
            .observe(),
    };
})(TrackList);

// ----- ALBUM ITEMS -----
const AlbumCard = ({ album, artist, onPress }: { album: Album, artist: Artist | null, onPress?: () => void }) => {
    const { t } = useTranslation();
    const navigation = useNavigation<LibraryNavigationProp>();

    const handlePress = React.useCallback(() => {
        if (onPress) onPress();
        else navigation.navigate('AlbumDetail', { albumId: album.id });
    }, [navigation, album.id, onPress]);

    return (
        <LibraryCard
            title={album.title}
            subtitle={artist?.name || t('actions.unknown')}
            imageUrl={album.coverUrl}
            placeholderIcon="albums"
            isPinned={album.isPinned}
            onPress={handlePress}
            onLongPress={() => useAlbumMenuStore.getState().openMenu(album)}
        />
    );
};

const EnhancedAlbumCard = withObservables(['album'], ({ album }: { album: Album }) => ({
    album: album.observe(),
    artist: album.artist.observe().pipe(catchError(() => of(null))),
}))(AlbumCard);

const AlbumList = ({ albums, bottomOffset, topOffset, scrollRef, sortOption }: { albums: Album[], bottomOffset: number, topOffset: number, scrollRef: any, sortOption?: SortOption }) => {
    const { t } = useTranslation();

    const sortedAlbums = React.useMemo(() => {
        if (sortOption === 'year_asc' || sortOption === 'year_desc') {
            return albums;
        }
        const isDesc = sortOption === 'name_desc';
        return [...albums].sort((a, b) => {
            if (a.isPinned !== b.isPinned) {
                return a.isPinned ? -1 : 1;
            }
            const titleA = a.title || '';
            const titleB = b.title || '';
            const cmp = titleA.localeCompare(titleB, undefined, { sensitivity: 'base', numeric: true });
            return isDesc ? -cmp : cmp;
        });
    }, [albums, sortOption]);

    return (
        <FlashList
            ref={scrollRef}
            data={sortedAlbums}
            keyExtractor={a => a.id}
            renderItem={({ item, index }) => {
                let alignItems: GridAlignment = 'flex-end';
                const rem = index % 3;
                if (rem === 0) {
                    alignItems = 'flex-start';
                } else if (rem === 1) {
                    alignItems = 'center';
                }
                return (
                    <View style={{ minHeight: cardWidth + 45, width: '100%', alignItems }}>
                        <EnhancedAlbumCard
                            album={item}
                        />
                    </View>
                );
            }}
            numColumns={3}
            contentContainerStyle={[styles.listContainer, { paddingBottom: bottomOffset, paddingTop: topOffset }]}
            ListEmptyComponent={
                <LibraryEmptyState
                    icon="albums-outline"
                    title={t('library.empty_albums')}
                    description={t('library.empty_albums_desc')}
                />
            }
        />
    );
};

const EnhancedAlbumList = withObservables(['sortOption'], ({ sortOption }: { sortOption: SortOption }) => {
    let orderCol = 'title';
    let orderDir = Q.asc;
    if (sortOption === 'name_desc') orderDir = Q.desc;
    else if (sortOption === 'year_asc') { orderCol = 'year'; orderDir = Q.asc; }
    else if (sortOption === 'year_desc') { orderCol = 'year'; orderDir = Q.desc; }

    return {
        albums: database.collections.get<Album>('albums').query(
            Q.sortBy('is_pinned', Q.desc),
            Q.sortBy(orderCol, orderDir)
        ).observe(),
    };
})(AlbumList);


// ----- ARTIST ITEMS -----
const ArtistCard = ({ artist, onPress }: { artist: Artist, onPress?: () => void }) => {
    const navigation = useNavigation<LibraryNavigationProp>();

    const handlePress = React.useCallback(() => {
        if (onPress) onPress();
        else navigation.navigate('ArtistDetail', { artistId: artist.id });
    }, [navigation, artist.id, onPress]);

    return (
        <LibraryCard
            title={artist.name}
            imageUrl={artist.imageUrl}
            placeholderIcon="person"
            isPinned={artist.isPinned}
            onPress={handlePress}
            onLongPress={() => {
                useArtistMenuStore.getState().openMenu(artist);
            }}
        />
    );
};

const EnhancedArtistCard = withObservables(['artist'], ({ artist }: { artist: Artist }) => ({
    artist: artist.observe(),
}))(ArtistCard);

const ArtistList = ({ artists, bottomOffset, topOffset, scrollRef, sortOption }: { artists: Artist[], bottomOffset: number, topOffset: number, scrollRef: any, sortOption?: SortOption }) => {
    const { t } = useTranslation();

    const sortedArtists = React.useMemo(() => {
        const isDesc = sortOption === 'name_desc';
        return [...artists].sort((a, b) => {
            if (a.isPinned !== b.isPinned) {
                return a.isPinned ? -1 : 1;
            }
            const nameA = a.name || '';
            const nameB = b.name || '';
            const cmp = nameA.localeCompare(nameB, undefined, { sensitivity: 'base', numeric: true });
            return isDesc ? -cmp : cmp;
        });
    }, [artists, sortOption]);

    return (
        <FlashList
            ref={scrollRef}
            data={sortedArtists}
            keyExtractor={a => a.id}
            renderItem={({ item, index }) => {
                let alignItems: GridAlignment = 'flex-end';
                const rem = index % 3;
                if (rem === 0) {
                    alignItems = 'flex-start';
                } else if (rem === 1) {
                    alignItems = 'center';
                }
                return (
                    <View style={{ minHeight: cardWidth + 45, width: '100%', alignItems }}>
                        <EnhancedArtistCard
                            artist={item}
                        />
                    </View>
                );
            }}
            numColumns={3}
            contentContainerStyle={[styles.listContainer, { paddingBottom: bottomOffset, paddingTop: topOffset }]}
            ListEmptyComponent={
                <LibraryEmptyState
                    icon="people-outline"
                    title={t('library.empty_artists')}
                    description={t('library.empty_artists_desc')}
                />
            }
        />
    );
};

const EnhancedArtistList = withObservables(['sortOption'], ({ sortOption }: { sortOption: SortOption }) => {
    let orderCol = 'name';
    let orderDir = Q.asc;
    if (sortOption === 'name_desc') orderDir = Q.desc;

    return {
        artists: database.collections.get<Artist>('artists').query(
            Q.sortBy('is_pinned', Q.desc),
            Q.sortBy(orderCol, orderDir)
        ).observe(),
    };
})(ArtistList);


// ----- PLAYLIST ITEMS -----
interface PlaylistCardProps {
    playlistId: string;
    isFavorites?: boolean;
    title: string;
    subtitle?: string;
    customCoverUrl?: string | null;
    isPinned?: boolean;
    onPress?: () => void;
    onLongPress?: () => void;
}

const PlaylistCard = memo(function PlaylistCard({
    playlistId,
    isFavorites = false,
    title,
    subtitle,
    customCoverUrl,
    isPinned,
    onPress,
    onLongPress
}: PlaylistCardProps) {
    return (
        <TouchableOpacity style={styles.playlistCard} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.7}>
            <View style={styles.playlistImageContainer}>
                <PlaylistCover
                    playlistId={playlistId}
                    isFavorites={isFavorites}
                    customCoverUrl={customCoverUrl}
                    size={cardWidth}
                />
            </View>
            <View style={styles.titleContainer}>
                {isPinned && (
                    <Ionicons name="pin" size={13} color="#8B5CF6" style={styles.pinIconInline} />
                )}
                <Text style={styles.playlistTitle} numberOfLines={1}>{title}</Text>
            </View>
            {subtitle && (
                <Text style={styles.playlistSubtitle} numberOfLines={1}>{subtitle}</Text>
            )}
        </TouchableOpacity>
    );
});

const EnhancedPlaylistCard = withObservables(['playlist'], ({ playlist }: { playlist: Playlist }) => ({
    playlist: playlist.observe(),
}))(({ playlist, onPress }: { playlist: Playlist, onPress?: () => void }) => {
    const { t } = useTranslation();
    const navigation = useNavigation<LibraryNavigationProp>();

    const handlePress = React.useCallback(() => {
        if (onPress) onPress();
        else navigation.navigate('PlaylistDetail', { playlistId: playlist.id });
    }, [navigation, playlist.id, onPress]);

    return (
        <PlaylistCard
            playlistId={playlist.id}
            title={playlist.name}
            subtitle={playlist.description || t('library.playlist_singular')}
            customCoverUrl={playlist.coverCustomUrl}
            isPinned={playlist.isPinned}
            onPress={handlePress}
            onLongPress={() => {
                usePlaylistMenuStore.getState().openMenu(playlist);
            }}
        />
    );
});

const PlaylistsList = ({ playlists, bottomOffset, topOffset, scrollRef, sortOption }: { playlists: Playlist[], bottomOffset: number, topOffset: number, scrollRef: any, sortOption?: SortOption }) => {
    const { t } = useTranslation();
    const navigation = useNavigation<LibraryNavigationProp>();

    const handleCreatePlaylist = React.useCallback(() => {
        usePlaylistSelectorStore.getState().openCreate();
    }, []);

    const handleNavFavorites = React.useCallback(() => {
        navigation.navigate('FavoritesDetail');
    }, [navigation]);

    const sortedPlaylists = React.useMemo(() => {
        if (sortOption !== 'name_asc' && sortOption !== 'name_desc') {
            return playlists;
        }
        const isDesc = sortOption === 'name_desc';
        return [...playlists].sort((a, b) => {
            if (a.isPinned !== b.isPinned) {
                return a.isPinned ? -1 : 1;
            }
            const nameA = a.name || '';
            const nameB = b.name || '';
            const cmp = nameA.localeCompare(nameB, undefined, { sensitivity: 'base', numeric: true });
            return isDesc ? -cmp : cmp;
        });
    }, [playlists, sortOption]);

    const data = React.useMemo(() => {
        return [
            { id: 'create_new', isCreateNew: true, name: t('library.create_playlist') },
            { id: 'favorites', name: t('home.your_favourites'), isFavorites: true, coverCustomUrl: null, description: t('home.most_liked_songs') },
            ...sortedPlaylists
        ];
    }, [sortedPlaylists, t]);

    return (
        <FlashList
            ref={scrollRef}
            data={data}
            keyExtractor={p => p.id}
            renderItem={({ item, index }) => {
                let content;
                if ('isCreateNew' in item) {
                    content = (
                        <TouchableOpacity
                            style={styles.playlistCard}
                            onPress={handleCreatePlaylist}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.playlistImageContainer, { justifyContent: 'center', alignItems: 'center' }]}>
                                <Ionicons name="add" size={48} color="#7d7d7dff" />
                            </View>
                            <Text style={styles.playlistTitle} numberOfLines={1}>{item.name}</Text>
                        </TouchableOpacity>
                    );
                } else {
                    const isFav = 'isFavorites' in item && !!(item as any).isFavorites;
                    if (isFav) {
                        content = (
                            <PlaylistCard
                                playlistId="favorites"
                                isFavorites={true}
                                title={item.name}
                                subtitle={t('actions.special')}
                                onPress={handleNavFavorites}
                                onLongPress={() => {
                                    usePlaylistMenuStore.getState().openMenu(item as any);
                                }}
                            />
                        );
                    } else {
                        content = (
                            <EnhancedPlaylistCard
                                playlist={item as Playlist}
                            />
                        );
                    }
                }

                let alignItems: GridAlignment = 'flex-end';
                const rem = index % 3;
                if (rem === 0) {
                    alignItems = 'flex-start';
                } else if (rem === 1) {
                    alignItems = 'center';
                }
                return (
                    <View style={{ minHeight: cardWidth + 45, width: '100%', alignItems }}>
                        {content}
                    </View>
                );
            }}
            numColumns={3}
            contentContainerStyle={[styles.listContainer, { paddingBottom: bottomOffset, paddingTop: topOffset }]}
            ListEmptyComponent={
                <LibraryEmptyState
                    icon="list-outline"
                    title={t('library.empty_playlists')}
                    description={t('library.empty_playlists_desc')}
                />
            }
        />
    );
};

const EnhancedPlaylistsList = withObservables(['sortOption'], ({ sortOption }: { sortOption: SortOption }) => {
    let orderCol = 'created_at';
    let orderDir = Q.desc;
    if (sortOption === 'name_asc') {
        orderCol = 'name';
        orderDir = Q.asc;
    } else if (sortOption === 'name_desc') {
        orderCol = 'name';
        orderDir = Q.desc;
    } else if (sortOption === 'recent_asc') {
        orderDir = Q.asc;
    }

    return {
        playlists: database.collections.get<Playlist>('playlists').query(
            Q.sortBy('is_pinned', Q.desc),
            Q.sortBy(orderCol, orderDir)
        ).observe(),
    };
})(PlaylistsList);


type Folder = { path: string; name: string; trackCount: number };

const FolderCard = React.memo(function FolderCard({ folder, onOpen, onMenu }: { folder: Folder, onOpen: (path: string) => void, onMenu: (path: string, name: string) => void }) {
    const { t } = useTranslation();
    const handlePress = React.useCallback(() => onOpen(folder.path), [folder.path, onOpen]);
    const handleLongPress = React.useCallback(() => onMenu(folder.path, folder.name), [folder.path, folder.name, onMenu]);

    return (
        <LibraryCard
            title={folder.name}
            subtitle={`${folder.trackCount} ${folder.trackCount === 1 ? t('library.song_singular') : t('library.song_plural')}`}
            placeholderIcon="folder"
            onPress={handlePress}
            onLongPress={handleLongPress}
        />
    );
});

const FolderList = ({ tracks, bottomOffset, topOffset, scrollRef }: { tracks: Track[], bottomOffset: number, topOffset: number, scrollRef: any }) => {
    const { t } = useTranslation();
    const [activeFolderPath, setActiveFolderPath] = useState<string | null>(null);
    const isFocused = useIsFocused();

    useEffect(() => {
        if (!activeFolderPath || !isFocused) return;

        const onBackPress = () => {
            setActiveFolderPath(null);
            return true;
        };

        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [activeFolderPath, isFocused]);

    // Get unique leaf folders that directly contain tracks
    const folders = React.useMemo(() => {
        const map = new Map<string, { path: string; name: string; trackCount: number }>();
        for (const track of tracks) {
            const lastSlash = track.fileUrl.lastIndexOf('/');
            if (lastSlash === -1) continue;
            const dirPath = track.fileUrl.substring(0, lastSlash);

            const existing = map.get(dirPath);
            if (existing) {
                existing.trackCount++;
            } else {
                const name = dirPath.substring(dirPath.lastIndexOf('/') + 1);
                map.set(dirPath, {
                    path: dirPath,
                    name: safeDecodeURIComponent(name),
                    trackCount: 1
                });
            }
        }
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
    }, [tracks]);

    // Automatically clear selection if the folder no longer exists or becomes empty
    useEffect(() => {
        if (activeFolderPath) {
            const exists = tracks.some(t => {
                const lastSlash = t.fileUrl.lastIndexOf('/');
                return lastSlash !== -1 && t.fileUrl.substring(0, lastSlash) === activeFolderPath;
            });
            if (!exists) {
                setActiveFolderPath(null);
            }
        }
    }, [tracks, activeFolderPath]);

    const activeFolderName = React.useMemo(() => {
        if (!activeFolderPath) return '';
        return getSafeFileName(activeFolderPath);
    }, [activeFolderPath]);

    const directTracks = React.useMemo(() => {
        if (!activeFolderPath) return [];

        const filteredTracks = tracks.filter(t => {
            const lastSlash = t.fileUrl.lastIndexOf('/');
            return lastSlash !== -1 && t.fileUrl.substring(0, lastSlash) === activeFolderPath;
        });

        return filteredTracks.sort((a, b) => {
            const titleA = a.title || '';
            const titleB = b.title || '';
            return titleA.localeCompare(titleB, undefined, { sensitivity: 'base', numeric: true });
        });
    }, [tracks, activeFolderPath]);

    const renderItemTrack = React.useCallback((info: { item: Track }) => {
        return (
            <View style={{ minHeight: 64, width: '100%' }}>
                <EnhancedTrackCard track={info.item} />
            </View>
        );
    }, []);

    if (activeFolderPath) {
        return (
            <FlashList
                key="folder-tracks"
                ref={scrollRef}
                data={directTracks}
                keyExtractor={t => t.id}
                renderItem={renderItemTrack}
                contentContainerStyle={[styles.trackListContainer, { paddingBottom: bottomOffset, paddingTop: topOffset }]}
                ListHeaderComponent={
                    <View style={styles.folderHeaderContainer}>
                        <View style={styles.folderTitleRow}>
                            <TouchableOpacity onPress={() => setActiveFolderPath(null)} style={styles.folderBackBtn} activeOpacity={0.7}>
                                <Ionicons name="chevron-back" size={20} color="#8B5CF6" />
                                <Text style={styles.folderBackBtnText}>{t('library.back')}</Text>
                            </TouchableOpacity>
                            <Text style={[styles.currentFolderTitle, { marginLeft: 8 }]} numberOfLines={1}>
                                📁 {activeFolderName}
                            </Text>
                        </View>
                    </View>
                }
            />
        );
    }


    return (
        <FlashList
            key="folders-grid"
            ref={scrollRef}
            data={folders}
            keyExtractor={f => f.path}
            renderItem={({ item, index }) => {
                let alignItems: GridAlignment = 'flex-end';
                const rem = index % 3;
                if (rem === 0) {
                    alignItems = 'flex-start';
                } else if (rem === 1) {
                    alignItems = 'center';
                }
                return (
                    <View style={{ minHeight: cardWidth + 45, width: '100%', alignItems }}>
                        <FolderCard
                            folder={item}
                            onOpen={setActiveFolderPath}
                            onMenu={(path, name) => useFolderMenuStore.getState().openMenu(path, name)}
                        />
                    </View>
                );
            }}
            numColumns={3}
            contentContainerStyle={[styles.listContainer, { paddingBottom: bottomOffset, paddingTop: topOffset }]}
            ListEmptyComponent={
                <LibraryEmptyState
                    icon="folder-open-outline"
                    title={t('library.empty_folders')}
                    description={t('library.empty_folders_desc')}
                />
            }
        />
    );
};

const EnhancedFolderList = withObservables([], () => ({
    tracks: database.collections.get<Track>('tracks').query().observe(),
}))(FolderList);


export default function LibraryScreen() {
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const libraryTabsOrder = useSettingsStore(state => state.libraryTabsOrder);

    // Convertir el order del store a rutas
    const [index, setIndex] = useState(0);
    const routes = React.useMemo(() => {
        return libraryTabsOrder.map(key => {
            let title = '';
            switch (key) {
                case 'albums': title = t('library.albums'); break;
                case 'playlists': title = t('library.playlists'); break;
                case 'artists': title = t('library.artists'); break;
                case 'folders': title = t('library.folders'); break;
                case 'tracks': title = t('library.songs'); break;
            }
            return { key, title };
        });
    }, [libraryTabsOrder, t]);

    const activeTab = routes[index]?.key || 'albums';

    // Estado para guardar la altura dinámica del Título + Selectores
    const [headerHeight, setHeaderHeight] = useState(130);

    const albumSort = useLibraryStore(state => state.albumSort);
    const artistSort = useLibraryStore(state => state.artistSort);
    const playlistSort = useLibraryStore(state => state.playlistSort);
    const trackSort = useLibraryStore(state => state.trackSort);

    const getActiveSortOption = (): SortOption => {
        if (activeTab === 'albums') return albumSort;
        if (activeTab === 'artists') return artistSort;
        if (activeTab === 'tracks') return trackSort;
        return playlistSort;
    };

    // bottomOffset reajustado para subir la última fila sobre el mini reproductor y la tab bar
    const bottomOffset = Layout.MINI_PLAYER_HEIGHT + Layout.TAB_BAR_HEIGHT + Layout.PLAYER_MARGIN + insets.bottom;

    const flatListRef = useRef<any>(null);
    useScrollToTop(flatListRef);

    const navigation = useNavigation<LibraryNavigationProp>();

    useEffect(() => {
        const tabNavigator: any = navigation.getParent();
        if (!tabNavigator) return;

        const unsubscribe = tabNavigator.addListener('tabPress', (e: any) => {
            const state = tabNavigator.getState();
            const currentRoute = state.routes[state.index];

            if (currentRoute.key === e.target) {
                // Ir al primer tab
                setIndex(0);
            }
        });

        return unsubscribe;
    }, [navigation]);

    const renderScene = ({ route }: { route: { key: string } }) => {
        switch (route.key) {
            case 'albums': return <EnhancedAlbumList sortOption={albumSort} bottomOffset={bottomOffset} topOffset={headerHeight + 20} scrollRef={flatListRef} />;
            case 'artists': return <EnhancedArtistList sortOption={artistSort} bottomOffset={bottomOffset} topOffset={headerHeight + 20} scrollRef={flatListRef} />;
            case 'folders': return <EnhancedFolderList bottomOffset={bottomOffset} topOffset={headerHeight + 20} scrollRef={flatListRef} />;
            case 'tracks': return <EnhancedTrackList sortOption={trackSort} bottomOffset={bottomOffset} topOffset={headerHeight + 20} scrollRef={flatListRef} />;
            case 'playlists': return <EnhancedPlaylistsList sortOption={playlistSort} bottomOffset={bottomOffset} topOffset={headerHeight + 20} scrollRef={flatListRef} />;
            default: return null;
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: Colors.background }]}>

            {/* 1. CAPA DE LISTAS (AL FONDO) */}
            <View style={StyleSheet.absoluteFill}>
                <TabView
                    navigationState={{ index, routes }}
                    renderScene={renderScene}
                    onIndexChange={setIndex}
                    initialLayout={{ width: Dimensions.get('window').width }}
                    renderTabBar={() => null}
                    swipeEnabled={true}
                    lazy={true}
                />
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

            {/* 2.5 CAPA DE ILUMINACIÓN MORADA (SOBRE EL HUMO) */}
            <LinearGradient
                colors={[Colors.accentAlpha20, "transparent"]}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200, zIndex: 2 }}
                pointerEvents="none"
            />

            {/* 3. CAPA DE LA INTERFAZ (FRENTE) */}
            <View
                onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
                style={{ paddingTop: insets.top + 10 }}
            >
                <View style={styles.header}>
                    <Text style={styles.title}>{t('library.title')}</Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity
                            onPress={() => ScannerService.syncLibrary()}
                            style={styles.filterButton}
                        >
                            <Ionicons name="refresh" size={22} color="#8B5CF6" />
                        </TouchableOpacity>
                        {activeTab !== 'folders' && (
                            <TouchableOpacity
                                onPress={() => useSortModalStore.getState().openModal(activeTab, getActiveSortOption())}
                                style={styles.filterButton}
                            >
                                <Ionicons name="filter" size={22} color="#8B5CF6" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>


                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabsContainer}
                    keyboardShouldPersistTaps="handled"
                >
                    {routes.map((route, i) => (
                        <TouchableOpacity
                            key={route.key}
                            style={[styles.tabButton, index === i && styles.activeTab]}
                            onPress={() => setIndex(i)}
                        >
                            <Text style={[styles.tabText, index === i && styles.activeTabText]}>{route.title}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        </View>
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
    filterButton: {
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
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80,
        paddingHorizontal: 32,
        width: '100%',
    },
    emptyIcon: {
        marginBottom: 16,
    },
    emptyTitle: {
        color: '#E0E0E0',
        fontSize: 16,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        textAlign: 'center',
    },
    emptySubtitle: {
        color: '#666',
        fontSize: 13,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 18,
    },
    listHeaderButtons: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginBottom: 16,
        gap: 12,
    },
    shuffleBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingVertical: 12,
        borderRadius: 24,
        gap: 8,
    },
    playBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#8B5CF6',
        paddingVertical: 12,
        borderRadius: 24,
        gap: 8,
    },
    shuffleBtnText: {
        color: '#FFFFFF',
        fontFamily: 'Montserrat',
        fontWeight: '700',
        fontSize: 14,
    },
    playBtnText: {
        color: '#FFFFFF',
        fontFamily: 'Montserrat',
        fontWeight: '800',
        fontSize: 14,
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
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        paddingHorizontal: 4,
    },
    pinIconInline: {
        marginRight: 2,
    },
    playlistTitle: {
        color: '#FFFFFF',
        fontSize: 13,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        textAlign: 'center',
        flexShrink: 1,
    },
    playlistSubtitle: {
        color: '#CCCCCC',
        fontSize: 11,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        textAlign: 'center',
        marginTop: 2,
    },
    folderHeaderContainer: {
        paddingHorizontal: 20,
        marginBottom: 10,
    },
    folderTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    folderBackBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 15,
    },
    folderBackBtnText: {
        color: '#8B5CF6',
        fontSize: 13,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    currentFolderTitle: {
        fontSize: 18,
        fontFamily: 'Montserrat',
        fontWeight: '800',
        color: '#FFFFFF',
        flex: 1,
    },
    folderGrid: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontFamily: 'Montserrat',
        fontWeight: '800',
        color: '#B3B3B3',
        marginTop: 10,
        marginBottom: 10,
    },
});