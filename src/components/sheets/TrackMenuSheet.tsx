import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import * as Sharing from 'expo-sharing';
import Album from '../../database/models/Album';
import Artist from '../../database/models/Artist';
import { getActiveTabName, navigationRef } from '../../navigation/navigationRef';
import { PlaylistService } from '../../services/PlaylistService';
import { ScannerService } from '../../services/ScannerService';
import { useMultiSelectStore } from '../../store/useMultiSelectStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useToastStore } from '../../store/useToastStore';
import { useSheetProps } from '@/hooks/useSheetProps';
import { openArtistsList, openMetadataEditor, openTagManager, openPlaylistSelector } from '@/store/useUIStore';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BaseMenuSheet, MenuOption, MenuSeparator } from '@/components/sheets/BaseMenuSheet';

export default function TrackMenuSheet() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const { props: { track: selectedTrack, callbacks: navCallbacks, playlistId }, close: closeMenu } = useSheetProps<{ track: any; callbacks?: any; playlistId?: string }>('track-menu');
  const addToQueueNext = usePlayerStore(state => state.addToQueueNext);
  const addToQueueEnd = usePlayerStore(state => state.addToQueueEnd);
  const excludeSong = useSettingsStore(state => state.excludeSong);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [artistName, setArtistName] = useState(t('actions.unknown'));
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [artistId, setArtistId] = useState<string | null>(null);
  const [artistsList, setArtistsList] = useState<Artist[]>([]);
  const [isFavorite, setIsFavorite] = useState(selectedTrack?.isFavorite ?? false);

  useEffect(() => {
    if (selectedTrack) {
      setIsFavorite(selectedTrack.isFavorite);
    }
  }, [selectedTrack]);

  // Load basic metadata for the menu header
  useEffect(() => {
    if (!selectedTrack) return;

    const loadMetadata = async () => {
      const [album, artists] = await Promise.all([
        selectedTrack.album.fetch() as Promise<Album | null>,
        selectedTrack.queryCollaborators.fetch() as Promise<Artist[]>
      ]);
      setImageUrl(album?.coverUrl || null);
      setArtistName(artists.length > 0 ? artists.map((a: Artist) => a.name).join(', ') : t('actions.unknown'));
      setAlbumId(album?.id || null);
      setArtistId(artists[0]?.id || null);
      setArtistsList(artists);
    };
    loadMetadata();
  }, [selectedTrack, t]);

  if (!selectedTrack) return null;

  const handleExclude = () => {
    Alert.alert(
      t('actions.exclude_song_title'),
      t('actions.exclude_song_confirm'),
      [
        { text: t('actions.cancel'), style: "cancel" },
        {
          text: t('actions.exclude'),
          style: "destructive",
          onPress: async () => {
            closeMenu();
            excludeSong(selectedTrack.fileUrl);
            await ScannerService.deleteSongContents(selectedTrack.fileUrl);
          }
        }
      ]
    );
  };

  const handleShare = async () => {
    if (!selectedTrack.fileUrl) return;
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        closeMenu();
        await Sharing.shareAsync(selectedTrack.fileUrl, {
          dialogTitle: `Compartir ${selectedTrack.title}`,
          mimeType: 'audio/*',
        });
      }
    } catch (error) {
      console.error('Error al compartir:', error);
    }
  };

  const handleToggleFavorite = async () => {
    if (!selectedTrack) return;
    try {
      const wasFavorite = isFavorite;
      await selectedTrack.toggleLike();
      closeMenu();
      useToastStore.getState().showToast(
        wasFavorite ? t('toasts.removed_from_favourites') : t('toasts.added_to_favourites'),
        wasFavorite ? 'heart-dislike' : 'heart'
      );
    } catch (error) {
      console.error('Error al cambiar favorito:', error);
    }
  };

  return (
    <BaseMenuSheet
      title={selectedTrack.title}
      subtitle={artistName}
      coverUrl={imageUrl}
      placeholderIcon="musical-notes"
    >
      {/* OPTION: Play Next */}
      <MenuOption
        icon="return-down-forward"
        text={t('actions.add_next')}
        onPress={() => {
          addToQueueNext(selectedTrack);
          useToastStore.getState().showToast(t('toasts.playing_next'), 'return-down-forward');
          closeMenu();
        }}
      />

      {/* OPTION: Add to Queue */}
      <MenuOption
        icon="list"
        text={t('actions.add_to_queue')}
        onPress={() => {
          addToQueueEnd(selectedTrack);
          useToastStore.getState().showToast(t('toasts.added_to_queue'), 'list');
          closeMenu();
        }}
      />

      {/* OPTION: Select */}
      <MenuOption
        icon="checkmark-circle-outline"
        text={t('actions.select') || 'Seleccionar'}
        onPress={() => {
          closeMenu();
          useMultiSelectStore.getState().enterSelectionMode(selectedTrack);
        }}
      />

      {/* OPTION: Edit Metadata */}
      <MenuOption
        icon="pencil"
        text={t('metadata_editor.title_single') || 'Editar metadatos'}
        onPress={() => {
          closeMenu();
          openMetadataEditor([selectedTrack]);
        }}
      />

      {/* OPTION: Manage Tags */}
      <MenuOption
        icon="pricetag-outline"
        text={t('tags.manage')}
        onPress={() => {
          closeMenu();
          openTagManager('track', selectedTrack.id, selectedTrack.title);
        }}
      />

      {/* OPTION: Add to Playlist */}
      <MenuOption
        icon="add-circle-outline"
        text={t('actions.add_to_playlist')}
        onPress={() => {
          closeMenu();
          openPlaylistSelector(selectedTrack);
        }}
      />

      {/* OPTION: Remove from Playlist */}
      {playlistId && (
        <MenuOption
          icon="trash-outline"
          text={t('actions.remove_from_playlist')}
          iconColor={colors.heartIcon}
          textStyle={{ color: colors.heartIcon }}
          onPress={async () => {
            const pId = playlistId!;
            closeMenu();
            await PlaylistService.removeTrackFromPlaylist(pId, selectedTrack.id);
          }}
        />
      )}

      {/* OPTION: Favorite */}
      <MenuOption
        icon={isFavorite ? "heart" : "heart-outline"}
        text={isFavorite ? t('actions.remove_from_favorites') : t('actions.add_to_favorites')}
        iconColor={isFavorite ? colors.heartIcon : colors.text}
        textStyle={isFavorite ? { color: colors.heartIcon } : undefined}
        onPress={handleToggleFavorite}
      />

      {/* OPTION: Share */}
      <MenuOption
        icon="share-social-outline"
        text={t('actions.share')}
        onPress={handleShare}
      />

      {/* separator */}
      {(albumId || artistId) && <MenuSeparator />}

      {/* OPTION: Go to Album */}
      {albumId && (
        <MenuOption
          icon="disc-outline"
          text={t('actions.go_to_album')}
          onPress={() => {
            closeMenu();
            if (navCallbacks.album) {
              navCallbacks.album(albumId);
            } else if (navigationRef.isReady()) {
              const rootState = navigationRef.getRootState();
              const activeRoute = rootState.routes[rootState.index];
              const isPlayerActive = activeRoute?.name === 'Player';

              let tabName = getActiveTabName();
              if (tabName !== 'Inicio' && tabName !== 'Biblioteca' && tabName !== 'Buscar') {
                tabName = 'Biblioteca';
              }

              const currentTab = getActiveTabName();
              if (isPlayerActive || tabName === currentTab) {
                navigationRef.navigate('AlbumDetail', { albumId });
              } else {
                navigationRef.navigate('Main', {
                  screen: tabName,
                  params: { screen: 'AlbumDetail', params: { albumId } }
                });
              }
            }
          }}
        />
      )}

      {/* OPTION: Go to Artist */}
      {artistId && (
        <MenuOption
          icon="person-outline"
          text={t('actions.go_to_artist')}
          onPress={() => {
            closeMenu();
            if (artistsList.length > 1) {
              openArtistsList(artistsList);
            } else if (navCallbacks.artist) {
              navCallbacks.artist(artistId);
            } else if (navigationRef.isReady()) {
              const rootState = navigationRef.getRootState();
              const activeRoute = rootState.routes[rootState.index];
              const isPlayerActive = activeRoute?.name === 'Player';

              let tabName = getActiveTabName();
              if (tabName !== 'Inicio' && tabName !== 'Biblioteca' && tabName !== 'Buscar') {
                tabName = 'Biblioteca';
              }

              const currentTab = getActiveTabName();
              if (isPlayerActive || tabName === currentTab) {
                navigationRef.navigate('ArtistDetail', { artistId });
              } else {
                navigationRef.navigate('Main', {
                  screen: tabName,
                  params: { screen: 'ArtistDetail', params: { artistId } }
                });
              }
            }
          }}
        />
      )}

      {/* OPTION: Exclude song */}
      <MenuOption
        icon="eye-off-outline"
        text={t('actions.exclude_song')}
        iconColor={colors.heartIcon}
        textStyle={{ color: colors.heartIcon }}
        onPress={handleExclude}
      />
    </BaseMenuSheet>
  );
}
