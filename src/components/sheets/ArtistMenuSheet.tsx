import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Q } from '@nozbe/watermelondb';
import { database } from '../../database';
import Track from '../../database/models/Track';
import { getActiveTabName, navigationRef } from '../../navigation/navigationRef';
import { useSheetProps } from '@/hooks/useSheetProps';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useToastStore } from '../../store/useToastStore';
import { openPlaylistSelector } from '@/store/useUIStore';
import { BaseMenuSheet, MenuOption } from '@/components/sheets/BaseMenuSheet';

export default function ArtistMenuSheet() {
  const { t } = useTranslation();
  const { props: { artist: selectedArtist, callbacks: navCallbacks }, close: closeMenu } = useSheetProps<{ artist: any; callbacks: any }>('artist-menu');
  const addMultipleToQueueNext = usePlayerStore(state => state.addMultipleToQueueNext);
  const addMultipleToQueueEnd = usePlayerStore(state => state.addMultipleToQueueEnd);
  const [tracks, setTracks] = useState<Track[]>([]);

  // Load artist tracks
  useEffect(() => {
    if (!selectedArtist) {
      setTracks([]);
      return;
    }

    const loadTracks = async () => {
      try {
        const tracksList = await database.collections.get<Track>('tracks')
          .query(Q.on('track_collaborators', 'artist_id', selectedArtist.id))
          .fetch();
        setTracks(tracksList);
      } catch (error) {
        console.error('Error al cargar tracks de ArtistMenuSheet:', error);
      }
    };
    loadTracks();
  }, [selectedArtist]);

  if (!selectedArtist) return null;

  return (
    <BaseMenuSheet
      title={selectedArtist.name}
      subtitle={t('library.artist_singular')}
      coverUrl={selectedArtist.imageUrl}
      placeholderIcon="person"
      circularImage={true}
    >
      {/* OPTION: Pin/Unpin */}
      <MenuOption
        icon={selectedArtist.isPinned ? "pin" : "pin-outline"}
        text={selectedArtist.isPinned ? t('actions.unpin_library') : t('actions.pin_library')}
        onPress={async () => {
          await database.write(async () => {
            await selectedArtist.update((a: any) => {
              a.isPinned = !a.isPinned;
            });
          });
          closeMenu();
        }}
      />

      {/* OPTION: Play Next */}
      <MenuOption
        icon="return-down-forward"
        text={t('actions.add_next')}
        onPress={() => {
          if (tracks.length > 0) {
            addMultipleToQueueNext(tracks);
            useToastStore.getState().showToast(t('toasts.artist_next'), 'return-down-forward');
            closeMenu();
          }
        }}
      />

      {/* OPTION: Add to Queue */}
      <MenuOption
        icon="list"
        text={t('actions.add_to_queue')}
        onPress={() => {
          if (tracks.length > 0) {
            addMultipleToQueueEnd(tracks);
            useToastStore.getState().showToast(t('toasts.artist_queued'), 'list');
            closeMenu();
          }
        }}
      />

      {/* OPTION: Add to Playlist */}
      <MenuOption
        icon="add-circle-outline"
        text={t('actions.add_to_playlist') || 'Añadir a playlist'}
        onPress={() => {
          if (tracks.length === 0) {
            useToastStore.getState().showToast('El artista no tiene canciones', 'close-circle', '#EF4444');
            closeMenu();
            return;
          }
          closeMenu();
          openPlaylistSelector(tracks);
        }}
      />

      {/* OPTION: Go to Artist Details */}
      <MenuOption
        icon="person-outline"
        text={t('actions.go_to_artist')}
        onPress={() => {
          closeMenu();
          const artistId = selectedArtist.id;
          if (navCallbacks.detail) {
            navCallbacks.detail(artistId);
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
    </BaseMenuSheet>
  );
}
