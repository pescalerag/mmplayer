import { openAlbumMenu, openFolderMenu } from '@/store/useUIStore';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import withObservables from '@nozbe/with-observables';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppTheme } from '@/hooks/useAppTheme';
import { FlashList } from '@shopify/flash-list';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DetailHeaderLayout from '@/components/layouts/DetailHeaderLayout';
import { useTranslation } from 'react-i18next';
import TrackPlayer, { State } from 'react-native-track-player';
import { usePlaybackState } from '../../hooks/usePlaybackState';
import LibraryCard from '@/components/cards/LibraryCard';
import SectionHeader from '@/components/common/SectionHeader';
import TrackRow from '@/components/player/TrackRow';
import { database } from '../../database';
import Album from '../../database/models/Album';
import Artist from '../../database/models/Artist';
import Track from '../../database/models/Track';
import { FolderDetailRouteProp } from '../../navigation/types';
import { HistoryService } from '../../services/HistoryService';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { Colors, Layout } from '../../theme/theme';
import { getSafeFileName, safeDecodeURIComponent } from '../../utils/safeDecode';

const { width } = Dimensions.get('window');
const HEADER_HEIGHT = 380;
const ALBUMS_PREVIEW = 6;
const TRACKS_PREVIEW = 10;

// ----- COMPONENTES AUXILIARES MEMOIZADOS -----

const FolderTrackRow = withObservables(['track', 'onPress'], ({ track, onPress }: { track: Track; onPress?: (trackId: string) => void }) => ({
    track: track.observe(),
    album: track.album.observe().pipe(catchError(() => of(null))),
    artists: track.queryCollaborators.observe() as any,
}))(function FolderTrackRow({
    track,
    album,
    artists,
    index,
    contextId,
    onPress,
}: {
    track: Track;
    album: Album | null;
    artists: Artist[];
    index?: number;
    contextId: string;
    onPress?: (trackId: string) => void;
}) {
    const { t } = useTranslation();
    const artistNames = artists.length > 0
        ? artists.map(a => a.name).join(', ')
        : t('actions.unknown');
    return (
        <TrackRow
            track={track}
            contextId={contextId}
            index={index}
            coverUrl={album?.coverUrl}
            artistName={artistNames}
            onPress={onPress}
        />
    );
});

const AlbumCardWithNav = memo(function AlbumCardWithNav({
    album,
    onPress,
    onLongPress,
}: {
    album: Album;
    onPress: (album: Album) => void;
    onLongPress: (album: Album) => void;
}) {
    const handlePress = useCallback(() => onPress(album), [album, onPress]);
    const handleLongPress = useCallback(() => onLongPress(album), [album, onLongPress]);

    return (
        <View style={styles.albumCardWrapper}>
            <LibraryCard
                title={album.title}
                imageUrl={album.coverUrl}
                placeholderIcon="albums"
                onPress={handlePress}
                onLongPress={handleLongPress}
            />
        </View>
    );
});

// Componente para la cabecera separado para evitar re-renders de toda la FlatList
const FolderHeader = memo(function FolderHeader({
    folderPath,
    folderName,
    albums,
    tracks,
    tracksCount,
    isLoadingContent,
    showAllAlbums,
    setShowAllAlbums,
    navigation,
    showAllTracks,
    setShowAllTracks,
    onMore,
}: {
    folderPath: string;
    folderName: string;
    albums: Album[];
    tracks: Track[];
    tracksCount: number;
    isLoadingContent: boolean;
    showAllAlbums: boolean;
    setShowAllAlbums: (v: boolean) => void;
    navigation: any;
    showAllTracks: boolean;
    setShowAllTracks: (v: boolean) => void;
    onMore: () => void;
}) {
    const { colors } = useAppTheme();
    const handleBack = () => {
        navigation.goBack();
    };

    const { t } = useTranslation();
    const playbackState = usePlaybackState();
    const isPlaying = playbackState.state === State.Playing || playbackState.state === State.Buffering;
    const playbackContext = usePlayerStore(state => state.playbackContext);

    const contextId = `folder-${folderPath}`;
    const isCurrentContext = playbackContext === contextId;
    const isCurrentContextPlaying = isCurrentContext && isPlaying;

    const handlePlayPress = async () => {
        if (!tracks || tracks.length === 0) return;
        HistoryService.updateUIRecents({
            id: folderPath,
            type: 'folder',
            context: 'manual',
            title: folderName,
            subtitle: t('library.folder_singular'),
            imageUrl: null,
        });
        if (isCurrentContext) {
            if (isPlaying) {
                await TrackPlayer.pause();
            } else {
                await TrackPlayer.play();
            }
        } else {
            usePlayerStore.getState().loadQueue(tracks, 0, contextId);
        }
    };

    const handleShufflePress = () => {
        if (tracks && tracks.length > 0) {
            HistoryService.updateUIRecents({
                id: folderPath,
                type: 'folder',
                context: 'manual',
                title: folderName,
                subtitle: t('library.folder_singular'),
                imageUrl: null,
            });
            usePlayerStore.getState().startShuffled(tracks, contextId);
        }
    };

    const handleAlbumPress = useCallback((album: Album) => {
        navigation.navigate('AlbumDetail', { albumId: album.id });
    }, [navigation]);

    const handleAlbumLongPress = useCallback((album: Album) => {
        openAlbumMenu(album);
    }, []);

    const albumLabel = albums.length === 1 ? t('library.album_singular') : t('library.album_plural');
    const trackLabel = tracksCount === 1 ? t('library.song_singular') : t('library.song_plural');
    const metaInfo = isLoadingContent
        ? t('actions.loading_content')
        : `${albums.length} ${albumLabel} · ${tracksCount} ${trackLabel}`;

    return (
        <>
            <DetailHeaderLayout
                title={folderName}
                placeholderIcon="folder"
                metaInfo={metaInfo}
                onBack={handleBack}
                onMore={onMore}
                renderExtra={() => (
                    <>
                        {tracks && tracks.length > 0 && (
                            <>
                                <TouchableOpacity style={styles.shuffleFab} onPress={handleShufflePress}>
                                    <Ionicons name="shuffle" size={22} color="#FFFFFF" />
                                </TouchableOpacity>

                                <TouchableOpacity style={[styles.playFab, { backgroundColor: colors.accent }]} onPress={handlePlayPress}>
                                    <Ionicons
                                        name={isCurrentContextPlaying ? "pause" : "play"}
                                        size={28}
                                        color={colors.onAccent}
                                        style={isCurrentContextPlaying ? {} : { marginLeft: 4 }}
                                    />
                                </TouchableOpacity>
                            </>
                        )}
                    </>
                )}
            />

            {(albums.length > 0 || isLoadingContent) && (
                <View style={{ marginBottom: 16 }}>
                    <SectionHeader
                        title={t('library.albums')}
                        showSeeAll={albums.length > ALBUMS_PREVIEW && !showAllAlbums}
                        onSeeAll={() => setShowAllAlbums(true)}
                    />
                    {isLoadingContent ? (
                        <View style={{ height: 160, justifyContent: 'center' }}>
                            <ActivityIndicator color={colors.accent} />
                        </View>
                    ) : (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.albumsScroll}
                            keyboardShouldPersistTaps="handled"
                        >
                            {(showAllAlbums ? albums : albums.slice(0, ALBUMS_PREVIEW)).map((album: Album) => (
                                <AlbumCardWithNav
                                    key={album.id}
                                    album={album}
                                    onPress={handleAlbumPress}
                                    onLongPress={handleAlbumLongPress}
                                />
                            ))}
                        </ScrollView>
                    )}
                </View>
            )}

            {(tracksCount > 0 || isLoadingContent) && (
                <View style={{ marginBottom: 8 }}>
                    <SectionHeader
                        title={t('library.songs')}
                        showSeeAll={tracksCount > TRACKS_PREVIEW && !showAllTracks}
                        onSeeAll={() => setShowAllTracks(true)}
                    />
                    <View style={styles.tracksDivider} />
                </View>
            )}
        </>
    );
});

interface Props {
    folderPath: string;
    folderName?: string;
    rawTracks: Track[];
    isLoadingContent: boolean;
}

function FolderDetailContentBase({ folderPath, folderName: passedFolderName, rawTracks, isLoadingContent }: Readonly<Props>) {
    const { colors } = useAppTheme();
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const [showAllAlbums, setShowAllAlbums] = useState(false);
    const [showAllTracks, setShowAllTracks] = useState(false);
    const [albums, setAlbums] = useState<Album[]>([]);
    const [isLoadingAlbums, setIsLoadingAlbums] = useState(true);

    const excludedSongs = useSettingsStore(state => state.excludedSongs) || [];

    const folderName = useMemo(() => {
        if (passedFolderName) return passedFolderName;
        return getSafeFileName(folderPath) || safeDecodeURIComponent(folderPath.substring(folderPath.lastIndexOf('/') + 1)) || t('library.folder_singular');
    }, [passedFolderName, folderPath, t]);

    // Filtrar pistas directas de esta carpeta
    const tracks = useMemo(() => {
        const filtered = rawTracks.filter(t => {
            if (excludedSongs.includes(t.fileUrl)) return false;
            const lastSlash = t.fileUrl.lastIndexOf('/');
            return lastSlash !== -1 && t.fileUrl.substring(0, lastSlash) === folderPath;
        });

        return filtered.sort((a, b) => {
            const titleA = a.title || '';
            const titleB = b.title || '';
            return titleA.localeCompare(titleB, undefined, { sensitivity: 'base', numeric: true });
        });
    }, [rawTracks, excludedSongs, folderPath]);

    // Cargar álbumes reactivamente a partir de los albumIds de las canciones de la carpeta
    const albumIds = useMemo(() => {
        const ids = new Set<string>();
        for (const trk of tracks) {
            const aId = (trk as any).albumId || (trk._raw as any).album_id;
            if (aId) ids.add(aId);
        }
        return Array.from(ids);
    }, [tracks]);

    const albumIdsKey = useMemo(() => albumIds.sort().join(','), [albumIds]);

    useEffect(() => {
        if (albumIds.length === 0) {
            setAlbums([]);
            setIsLoadingAlbums(false);
            return;
        }

        setIsLoadingAlbums(true);
        const subscription = database.collections
            .get<Album>('albums')
            .query(Q.where('id', Q.oneOf(albumIds)))
            .observe()
            .subscribe({
                next: (result) => {
                    setAlbums(result.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true })));
                    setIsLoadingAlbums(false);
                },
                error: (err) => {
                    console.error('[FolderDetailScreen] Error observing albums:', err);
                    setIsLoadingAlbums(false);
                },
            });

        return () => subscription.unsubscribe();
    }, [albumIdsKey]);

    const visibleTracks = useMemo(() => {
        if (isLoadingContent) return [];
        return showAllTracks ? tracks : tracks.slice(0, TRACKS_PREVIEW);
    }, [isLoadingContent, showAllTracks, tracks]);

    const handleOpenFolderMenu = useCallback(() => {
        openFolderMenu(folderPath, folderName);
    }, [folderPath, folderName]);

    const handleTrackPress = useCallback((trackId: string) => {
        const trackIndex = tracks.findIndex(t => t.id === trackId);
        if (trackIndex !== -1) {
            usePlayerStore.getState().loadQueue(tracks, trackIndex, `folder-${folderPath}`);
        }
    }, [tracks, folderPath]);

    const renderItem = useCallback((info: { item: Track; index: number }) => {
        const { item, index } = info;
        return (
            <View style={{ minHeight: 64, width: '100%' }}>
                <FolderTrackRow
                    track={item}
                    contextId={`folder-${folderPath}`}
                    index={index + 1}
                    onPress={handleTrackPress}
                />
            </View>
        );
    }, [handleTrackPress, folderPath]);

    const listHeader = useMemo(() => (
        <FolderHeader
            folderPath={folderPath}
            folderName={folderName}
            albums={albums}
            tracks={tracks}
            tracksCount={tracks.length}
            isLoadingContent={isLoadingContent || isLoadingAlbums}
            showAllAlbums={showAllAlbums}
            setShowAllAlbums={setShowAllAlbums}
            showAllTracks={showAllTracks}
            setShowAllTracks={setShowAllTracks}
            navigation={navigation}
            onMore={handleOpenFolderMenu}
        />
    ), [folderPath, folderName, albums, tracks, isLoadingContent, isLoadingAlbums, showAllAlbums, showAllTracks, navigation, handleOpenFolderMenu]);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <FlashList
                data={visibleTracks}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                ListHeaderComponent={listHeader}
                ListEmptyComponent={
                    isLoadingContent ? (
                        <ActivityIndicator color={colors.accent} size="large" style={{ marginTop: 40 }} />
                    ) : (
                        <Text style={styles.emptyText}>{t('actions.no_songs_scanned')}</Text>
                    )
                }
                contentContainerStyle={{ paddingBottom: Layout.MINI_PLAYER_HEIGHT + Layout.TAB_BAR_HEIGHT + Layout.PLAYER_MARGIN + insets.bottom }}
                showsVerticalScrollIndicator={false}
                maintainVisibleContentPosition={{
                    autoscrollToTopThreshold: 0,
                }}
            />
        </View>
    );
}

const EnhancedFolderDetailContent = withObservables(['folderPath'], ({ folderPath }: { folderPath: string }) => ({
    rawTracks: database.collections.get<Track>('tracks')
        .query(Q.where('file_url', Q.like(`${folderPath}%`)))
        .observe(),
}))(FolderDetailContentBase);

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────
export default function FolderDetailScreen() {
    const route = useRoute<FolderDetailRouteProp>();
    const { folderPath, folderName } = route.params;

    return (
        <EnhancedFolderDetailContent
            folderPath={folderPath}
            folderName={folderName}
            isLoadingContent={false}
        />
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    playFab: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
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
