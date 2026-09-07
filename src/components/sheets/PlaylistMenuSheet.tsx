import React from 'react';
import { useTranslation } from 'react-i18next';
import { database } from '../../database';
import { useSheetProps } from '@/hooks/useSheetProps';
import { useToastStore } from '../../store/useToastStore';
import { useMultiSelectStore } from '../../store/useMultiSelectStore';
import { Q } from '@nozbe/watermelondb';
import { navigationRef, getActiveTabName } from '../../navigation/navigationRef';
import PlaylistCover from '@/components/player/PlaylistCover';
import { openPlaylistSelector } from '@/store/useUIStore';
import { BaseMenuSheet, MenuOption } from '@/components/sheets/BaseMenuSheet';
import Track from '../../database/models/Track';
import PlaylistTrack from '../../database/models/PlaylistTrack';

export default function PlaylistMenuSheet() {
  const { t } = useTranslation();
  const { props: { playlist: selectedPlaylist, callbacks: navCallbacks }, close: closeMenu } = useSheetProps<{ playlist: any; callbacks?: any }>('playlist-menu');

  const getPlaylistTracks = async (): Promise<Track[]> => {
    if (!selectedPlaylist) return [];
    if (selectedPlaylist.id === 'favorites') {
      return await database.collections.get<Track>('tracks')
        .query(Q.where('is_favorite', true))
        .fetch();
    } else {
      const playlistTracks = await database.collections.get<PlaylistTrack>('playlist_tracks')
        .query(
          Q.where('playlist_id', selectedPlaylist.id),
          Q.sortBy('position', Q.asc)
        )
        .fetch();
      const tracksList = await Promise.all(
        playlistTracks.map(pt => pt.track.fetch().catch(() => null))
      );
      return tracksList.filter((t): t is Track => t !== null);
    }
  };

  const handleViewPlaylist = () => {
    if (!selectedPlaylist) return;
    closeMenu();
    const playlistId = selectedPlaylist.id;
    if (navCallbacks.detail) {
      navCallbacks.detail(playlistId);
      return;
    }

    if (!navigationRef.isReady()) return;

    const rootState = navigationRef.getRootState();
    const activeRoute = rootState.routes[rootState.index];
    const isPlayerActive = activeRoute?.name === 'Player';

    let tabName = getActiveTabName();
    if (tabName !== 'Inicio' && tabName !== 'Biblioteca' && tabName !== 'Buscar') {
      tabName = 'Biblioteca';
    }

    const currentTab = getActiveTabName();
    const isTargetTabActive = isPlayerActive || tabName === currentTab;

    if (playlistId === 'favorites' && isTargetTabActive) {
      navigationRef.navigate('FavoritesDetail');
    } else if (playlistId === 'favorites') {
      navigationRef.navigate('Main', {
        screen: tabName,
        params: { screen: 'FavoritesDetail' }
      });
    } else if (isTargetTabActive) {
      navigationRef.navigate('PlaylistDetail', { playlistId });
    } else {
      navigationRef.navigate('Main', {
        screen: tabName,
        params: { screen: 'PlaylistDetail', params: { playlistId } }
      });
    }
  };

  const currentRoute = navigationRef.isReady() ? navigationRef.getCurrentRoute() : null;
  const isAlreadyOnPlaylistScreen =
    (currentRoute?.name === 'PlaylistDetail' && (currentRoute.params as any)?.playlistId === selectedPlaylist?.id) ||
    (currentRoute?.name === 'FavoritesDetail' && selectedPlaylist?.id === 'favorites');

  if (!selectedPlaylist) return null;

  return (
    <BaseMenuSheet
      title={selectedPlaylist.name}
      subtitle={t('library.playlist_singular')}
      headerLeft={
        <PlaylistCover
          playlistId={selectedPlaylist.id}
          isFavorites={selectedPlaylist.id === 'favorites'}
          customCoverUrl={selectedPlaylist.coverCustomUrl}
          size={56}
          borderRadius={8}
        />
      }
    >
      {/* OPTION: Pin/Unpin */}
      {selectedPlaylist.id !== 'favorites' && (
        <MenuOption
          icon={selectedPlaylist.isPinned ? "pin" : "pin-outline"}
          text={selectedPlaylist.isPinned ? t('actions.unpin_library') : t('actions.pin_library')}
          onPress={async () => {
            await database.write(async () => {
              await selectedPlaylist.update((p: any) => {
                p.isPinned = !p.isPinned;
              });
            });
            closeMenu();
          }}
        />
      )}

      {/* OPTION: Add to Playlist */}
      <MenuOption
        icon="add-circle-outline"
        text={t('actions.add_to_playlist') || 'Añadir a playlist'}
        onPress={async () => {
          try {
            const tracks = await getPlaylistTracks();
            if (tracks.length === 0) {
              useToastStore.getState().showToast(t('toasts.playlist_no_songs'), 'close-circle', '#EF4444');
              closeMenu();
              return;
            }

            closeMenu();
            openPlaylistSelector(tracks);
          } catch (e) {
            console.error('Error fetching playlist tracks', e);
          }
        }}
      />

      {/* OPTION: Select songs */}
      <MenuOption
        icon="checkmark-circle-outline"
        text={t('actions.select_all')}
        onPress={async () => {
          try {
            const tracks = await getPlaylistTracks();
            if (tracks.length === 0) {
              useToastStore.getState().showToast(t('toasts.playlist_no_songs'), 'close-circle', '#EF4444');
              closeMenu();
              return;
            }

            closeMenu();
            useMultiSelectStore.getState().selectMultipleTracks(tracks);
          } catch (e) {
            console.error('Error selecting playlist tracks', e);
          }
        }}
      />

      {/* OPTION: View Playlist */}
      {!isAlreadyOnPlaylistScreen && (
        <MenuOption
          icon="list-outline"
          text={t('playlist.view')}
          onPress={handleViewPlaylist}
        />
      )}
    </BaseMenuSheet>
  );
}
