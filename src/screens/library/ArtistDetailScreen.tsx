import { openAlbumMenu, openArtistMenu } from '@/store/useUIStore';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import withObservables from '@nozbe/with-observables';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppTheme } from '@/hooks/useAppTheme';

import { FlashList } from '@shopify/flash-list';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { MediaAssetService } from '../../services/MediaAssetService';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Platform,
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
import { ArtistDetailRouteProp } from '../../navigation/types';
import { HistoryService } from '../../services/HistoryService';


import { usePlayerStore } from '../../store/usePlayerStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { Colors, Layout } from '../../theme/theme';

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
    track: track.observe(),
    album: track.album.observe().pipe(catchError(() => of(null))),
    artists: track.queryCollaborators.observe() as any,
}))(function ArtistTrackRow({ track, album, artists, index, contextId, onPress }: { track: Track; album: Album | null; artists: Artist[]; index?: number; contextId: string; onPress?: (trackId: string) => void }) {
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
const ArtistHeader = memo(function ArtistHeader({
    artist,
    imageUrl,
    albums,
    tracks,
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
    setShowAllTracks,
    onMore,
}: any) {
    const { colors } = useAppTheme();
    const handleBack = () => {
        navigation.goBack();
    };

    const { t } = useTranslation();
    const playbackState = usePlaybackState();
    const isPlaying = playbackState.state === State.Playing || playbackState.state === State.Buffering;
    const playbackContext = usePlayerStore(state => state.playbackContext);

    const contextId = `artist-${artist.id}`;
    const isCurrentContext = playbackContext === contextId;
    const isCurrentContextPlaying = isCurrentContext && isPlaying;

    const handlePlayPress = async () => {
        if (!tracks || tracks.length === 0) return;
        HistoryService.updateUIRecents({
            id: artist.id,
            type: 'artist',
            context: 'manual',
            title: artist.name,
            subtitle: t('actions.artist'),
            imageUrl: artist.imageUrl || null,
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
                id: artist.id,
                type: 'artist',
                context: 'manual',
                title: artist.name,
                subtitle: t('actions.artist'),
                imageUrl: artist.imageUrl || null,
            });
            usePlayerStore.getState().startShuffled(tracks, contextId);
        }
    };

    const handleAlbumPress = useCallback((album: Album) => {
        const routes = navigation.getState()?.routes;
        const previousRoute = routes && routes.length > 1 ? routes[routes.length - 2] : null;
        const params = previousRoute?.params as { albumId?: string } | undefined;

        if (previousRoute?.name === 'AlbumDetail' && params?.albumId === album.id) {
            navigation.goBack();
        } else {
            navigation.navigate('AlbumDetail', { albumId: album.id });
        }
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
                title={artist.name}
                imageUrl={showHeaderImage ? artist.imageUrl : null}
                placeholderIcon="person"
                metaInfo={metaInfo}
                onBack={handleBack}
                onMore={onMore}
                onPickPhoto={handlePickPhoto}
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

const cleanupOldImage = async (oldPath: string | null | undefined, newPath: string) => {
    if (!oldPath || oldPath === newPath || !oldPath.startsWith('file://')) return;

    try {
        await FileSystem.deleteAsync(oldPath, { idempotent: true });
    } catch (e) {
        console.warn('Silently ignored error deleting old image:', e);
    }
};

const saveImageToLocalFile = async (assetUri: string, artistId: string) => {
    return await MediaAssetService.saveArtistImage(artistId, assetUri);
};

interface Props {
    artist: Artist;
    albums: Album[];
    tracks: Track[];
    isLoadingContent: boolean;
}

function ArtistDetailContentBase({ artist, albums, tracks: rawTracks, isLoadingContent }: Readonly<Props>) {
    const { colors } = useAppTheme();
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const [showAllAlbums, setShowAllAlbums] = useState(false);
    const [showAllTracks, setShowAllTracks] = useState(false);
    const [imageError, setImageError] = useState(false);
    const excludedSongs = useSettingsStore(state => state.excludedSongs);

    const tracks = useMemo(() => {
        const excluded = excludedSongs || [];
        return rawTracks.filter(t => !excluded.includes(t.fileUrl));
    }, [rawTracks, excludedSongs]);

    useEffect(() => {
        setImageError(false);
    }, [artist.imageUrl]);

    useEffect(() => {
        setImageError(false);
    }, [artist.imageUrl]);

    const visibleTracks = useMemo(() => {
        if (isLoadingContent) return [];
        return showAllTracks ? tracks : tracks.slice(0, TRACKS_PREVIEW);
    }, [isLoadingContent, showAllTracks, tracks]);

    const showHeaderImage = useMemo(() => !!artist.imageUrl && !imageError, [artist.imageUrl, imageError]);

    const performPickPhoto = useCallback(async () => {
        let result;

        // Step A: Pick the document
        try {
            result = await DocumentPicker.getDocumentAsync({
                type: 'image/*',
                copyToCacheDirectory: true,
            });
        } catch (error) {
            console.error('PickPhoto: Error al lanzar explorador:', error);
            Alert.alert(t('actions.error'), t('actions.pick_photo_error'));
            return;
        }

        // Early return if no asset was selected, flattening the rest of the function
        const asset = result.assets?.[0];
        if (!asset) return;

        // Step B: Process the file and update the database
        try {
            const permanentUri = await MediaAssetService.saveArtistImage(artist.id, asset.uri);

            setImageError(false);
            await database.write(async () => {
                await artist.update(a => { a.imageUrl = permanentUri; });
            });

            usePlayerStore.getState().updateMediaImageInRecents(artist.id, 'artist', permanentUri);

            Alert.alert(t('actions.success'), t('actions.artist_photo_updated'));
        } catch (e) {
            console.error('Error guardando foto:', e);
            Alert.alert(t('actions.error'), t('actions.save_photo_error'));
        }
    }, [artist, t]);

    const handleDeletePhoto = useCallback(async () => {
        try {
            await MediaAssetService.removeArtistImage(artist.id);

            await database.write(async () => {
                await artist.update(a => { a.imageUrl = null; });
            });

            setImageError(false);
            usePlayerStore.getState().updateMediaImageInRecents(artist.id, 'artist', null);

            Alert.alert(t('actions.success'), t('actions.artist_photo_deleted') || 'Imagen del artista eliminada correctamente.');
        } catch (e) {
            console.error('Error deleting photo:', e);
            Alert.alert(t('actions.error'), t('delete_photo_error') || 'Error al eliminar la imagen.');
        }
    }, [artist, t]);

    const handlePickPhoto = useCallback(() => {
        if (!artist.imageUrl) {
            performPickPhoto();
            return;
        }

        Alert.alert(
            artist.name,
            t('actions.artist_photo_options') || '¿Qué deseas hacer con la imagen del artista?',
            [
                { text: t('actions.cancel') || 'Cancelar', style: 'cancel' },
                {
                    text: t('actions.artist_photo_delete') || 'Eliminar imagen',
                    style: 'destructive',
                    onPress: handleDeletePhoto,
                },
                {
                    text: t('actions.artist_photo_set') || 'Establecer imagen',
                    style: 'default',
                    onPress: performPickPhoto,
                },
            ]
        );
    }, [artist.imageUrl, artist.name, performPickPhoto, handleDeletePhoto, t]);

    const handleOpenArtistMenu = useCallback(() => {
        openArtistMenu(artist);
    }, [artist]);

    const handleTrackPress = useCallback((trackId: string) => {
        const trackIndex = tracks.findIndex(t => t.id === trackId);
        if (trackIndex !== -1) {
            usePlayerStore.getState().loadQueue(tracks, trackIndex, `artist-${artist.id}`);
        }
    }, [tracks, artist.id]);

    const renderItem = useCallback((info: { item: Track; index: number }) => {
        const { item, index } = info;
        return (
            <View style={{ minHeight: 64, width: '100%' }}>
                <ArtistTrackRow
                    track={item}
                    contextId={`artist-${artist.id}`}
                    index={index + 1}
                    onPress={handleTrackPress}
                />
            </View>
        );
    }, [handleTrackPress, artist.id]);

    // Usamos el componente Header estable
    const listHeader = useMemo(() => (
        <ArtistHeader
            artist={artist}
            imageUrl={artist.imageUrl}
            albums={albums}
            tracks={tracks}
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
            onMore={handleOpenArtistMenu}
        />
    ), [artist, artist.imageUrl, albums, tracks, isLoadingContent, showAllAlbums, showAllTracks, handlePickPhoto, navigation, showHeaderImage, handleOpenArtistMenu]);

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
                // Importante para evitar saltos
                maintainVisibleContentPosition={{
                    autoscrollToTopThreshold: 0,
                }}
            />
        </View>
    );
}

const EnhancedArtistDetailContent = withObservables(['artist'], ({ artist }: { artist: Artist }) => ({
    artist: artist.observe(),
    albums: database.collections.get<Album>('albums')
        .query(Q.where('artist_id', artist.id))
        .observe(),
    tracks: database.collections.get<Track>('tracks')
        .query(Q.on('track_collaborators', 'artist_id', artist.id))
        .observe(),
}))(ArtistDetailContentBase);

function ArtistDetailErrorFallback() {
    const { colors } = useAppTheme();
    const navigation = useNavigation();
    const { t } = useTranslation();
    return (
        <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <Ionicons name="alert-circle-outline" size={64} color={colors.textSecondary} style={{ marginBottom: 16 }} />
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>
                Este artista ya no existe en tu biblioteca
            </Text>
            <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={{ backgroundColor: colors.accent, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, marginTop: 16 }}
            >
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>{t('actions.back') || 'Volver'}</Text>
            </TouchableOpacity>
        </View>
    );
}

const ObservableArtistDetailMiddle = withObservables(['artistId'], ({ artistId }: { artistId: string }) => ({
    artist: database.collections.get<Artist>('artists').findAndObserve(artistId).pipe(catchError(() => of(null))),
}))(function ObservableArtistDetailMiddle({ artist }: { artist: Artist | null }) {
    if (!artist) {
        return <ArtistDetailErrorFallback />;
    }
    return <EnhancedArtistDetailContent artist={artist} isLoadingContent={false} />;
});

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────
export default function ArtistDetailScreen() {
    const route = useRoute<ArtistDetailRouteProp>();
    const { artistId } = route.params;

    return <ObservableArtistDetailMiddle artistId={artistId} />;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
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
        fontWeight: '700',
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