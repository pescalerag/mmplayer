import { navigationRef } from '../../navigation/navigationRef';
import { openArtist } from '../../navigation/destinations';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Q } from '@nozbe/watermelondb';
import { database } from '../../database';
import Track from '../../database/models/Track';
import { useSheetProps } from '@/hooks/useSheetProps';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useToastStore } from '../../store/useToastStore';
import { openQueueDestination, openPlaylistSelector } from '@/store/useUIStore';
import { BaseMenuSheet, MenuOption } from '@/components/sheets/BaseMenuSheet';

export default function ArtistMenuSheet() {
  const { t } = useTranslation();
  const { props: { artist: selectedArtist, callbacks: navCallbacks }, close: closeMenu, closeThen } = useSheetProps<{ artist: any; callbacks: any }>('artist-menu');
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

  const currentRoute = navigationRef.isReady() ? navigationRef.getCurrentRoute() : null;
  const isAlreadyOnArtistScreen = currentRoute?.name === 'ArtistDetail' && (currentRoute.params as any)?.artistId === selectedArtist?.id;

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
      <MenuOption icon="duplicate-outline" disabled={tracks.length === 0} text={t('queue.add_to_other')} onPress={() => openQueueDestination(tracks)} />


      {/* OPTION: Add to Playlist */}
      <MenuOption
        icon="add-circle-outline"
        text={t('actions.add_to_playlist') || 'Añadir a playlist'}
        onPress={() => {
          if (tracks.length === 0) {
            useToastStore.getState().showToast(t('toasts.artist_no_songs'), 'close-circle', '#EF4444');
            closeMenu();
            return;
          }
          closeMenu();
          openPlaylistSelector(tracks);
        }}
      />

      {/* OPTION: Go to Artist Details */}
      {!isAlreadyOnArtistScreen && (
        <MenuOption
          icon="person-outline"
          text={t('actions.go_to_artist')}
          onPress={() => {
            const destinationArtistId = selectedArtist.id;
            closeThen(() => openArtist(destinationArtistId));
          }}
        />
      )}
    </BaseMenuSheet>
  );
}
