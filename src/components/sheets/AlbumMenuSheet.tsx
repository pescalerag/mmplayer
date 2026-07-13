import { BaseMenuSheet, MenuOption, MenuSeparator } from '@/components/sheets/BaseMenuSheet';
import { useSheetProps } from '@/hooks/useSheetProps';
import { openPlaylistSelector, openTagManager } from '@/store/useUIStore';
import { Q } from '@nozbe/watermelondb';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { database } from '../../database';
import Artist from '../../database/models/Artist';
import Track from '../../database/models/Track';
import { getActiveTabName, navigationRef } from '../../navigation/navigationRef';
import { useMultiSelectStore } from '../../store/useMultiSelectStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useToastStore } from '../../store/useToastStore';

export default function AlbumMenuSheet() {
  const { t } = useTranslation();
  const { props: { album: selectedAlbum, callbacks: navCallbacks }, close: closeMenu } = useSheetProps<{ album: any; callbacks: any }>('album-menu');
  const addMultipleToQueueNext = usePlayerStore(state => state.addMultipleToQueueNext);
  const addMultipleToQueueEnd = usePlayerStore(state => state.addMultipleToQueueEnd);

  const [artistName, setArtistName] = useState(t('actions.unknown'));
  const [artistId, setArtistId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);

  const handleChangeCDImage = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const sourceUri = asset.uri;
      const baseDir = FileSystem.documentDirectory;
      if (!baseDir) throw new Error('No se pudo acceder al directorio de documentos');

      const fileName = `cd_custom_${selectedAlbum.id}_${Date.now()}.jpg`;
      const destUri = baseDir.endsWith('/') ? `${baseDir}${fileName}` : `${baseDir}/${fileName}`;

      if (selectedAlbum.cdArtUrl && selectedAlbum.cdArtUrl.startsWith('file://')) {
        try {
          await FileSystem.deleteAsync(selectedAlbum.cdArtUrl, { idempotent: true });
        } catch (e) {
          console.warn('Silenciosamente ignorado el error al borrar el CD anterior:', e);
        }
      }
      await FileSystem.copyAsync({ from: sourceUri, to: destUri });
      try {
        await FileSystem.deleteAsync(sourceUri, { idempotent: true });
      } catch (e) {
        console.warn("Error borrando imagen temporal de la caché:", e);
      }
      await database.write(async () => {
        await selectedAlbum.update((a: any) => {
          a.cdArtUrl = destUri;
        });
      });

      useToastStore.getState().showToast(t('actions.success') || 'Diseño del CD actualizado', 'disc');
      closeMenu();

    } catch (error) {
      console.error('Error al cambiar la imagen del CD:', error);
    }
  };
  // Load metadata and tracks
  useEffect(() => {
    if (!selectedAlbum) return;

    const loadTracksAndMetadata = async () => {
      try {
        const [artistDoc, tracksList] = await Promise.all([
          selectedAlbum.artist.fetch() as Promise<Artist | null>,
          database.collections.get<Track>('tracks').query(
            Q.where('album_id', selectedAlbum.id),
            Q.sortBy('disc_number', Q.asc),
            Q.sortBy('track_number', Q.asc)
          ).fetch()
        ]);
        setArtistName(artistDoc?.name || t('actions.unknown'));
        setArtistId(artistDoc?.id || null);
        setTracks(tracksList);
      } catch (error) {
        console.error('Error al cargar tracks de AlbumMenuSheet:', error);
      }
    };
    loadTracksAndMetadata();
  }, [selectedAlbum, t]);

  const currentRoute = navigationRef.isReady() ? navigationRef.getCurrentRoute() : null;
  const isAlreadyOnArtistScreen = currentRoute?.name === 'ArtistDetail' && (currentRoute.params as any)?.artistId === artistId;

  if (!selectedAlbum) return null;

  return (
    <BaseMenuSheet
      title={selectedAlbum.title}
      subtitle={artistName}
      coverUrl={selectedAlbum.coverUrl}
      placeholderIcon="albums"
    >
      {/* OPTION: Pin/Unpin */}
      <MenuOption
        icon={selectedAlbum.isPinned ? "pin" : "pin-outline"}
        text={selectedAlbum.isPinned ? t('actions.unpin') : t('actions.pin')}
        onPress={async () => {
          await database.write(async () => {
            await selectedAlbum.update((a: any) => {
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
            useToastStore.getState().showToast(t('toasts.album_next'), 'return-down-forward');
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
            useToastStore.getState().showToast(t('toasts.album_queued'), 'list');
            closeMenu();
          }
        }}
      />

      {/* OPTION: Manage Tags */}
      <MenuOption
        icon="pricetag-outline"
        text={t('tags.manage')}
        onPress={() => {
          closeMenu();
          openTagManager('album', selectedAlbum.id, selectedAlbum.title);
        }}
      />

      {/* OPTION: Add to Playlist */}
      <MenuOption
        icon="add-circle-outline"
        text={t('actions.add_to_playlist')}
        onPress={() => {
          if (tracks.length > 0) {
            closeMenu();
            openPlaylistSelector(tracks);
          }
        }}
      />

      {/* OPTION: Select songs */}
      <MenuOption
        icon="checkmark-circle-outline"
        text={t('actions.select_all')}
        onPress={() => {
          if (tracks.length > 0) {
            closeMenu();
            useMultiSelectStore.getState().selectMultipleTracks(tracks);
          }
        }}
      />
      <MenuOption
        icon="disc-outline"
        text={t('actions.customize_cd')}
        onPress={handleChangeCDImage}
      />
      {/* separator */}
      {artistId && artistName !== "Varios Artistas" && <MenuSeparator />}

      {/* OPTION: Go to Artist */}
      {artistId && artistName !== "Varios Artistas" && !isAlreadyOnArtistScreen && (
        <MenuOption
          icon="person-outline"
          text={t('actions.go_to_artist')}
          onPress={() => {
            closeMenu();
            if (navCallbacks.artist) {
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
    </BaseMenuSheet>
  );
}
