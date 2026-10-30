import { navigationRef } from '../../navigation/navigationRef';
import { openArtist } from '../../navigation/destinations';
import { isVariousArtists } from '../../utils/libraryMetadata';
import { BaseMenuSheet, MenuOption, MenuSeparator } from '@/components/sheets/BaseMenuSheet';
import { useSheetProps } from '@/hooks/useSheetProps';
import { openQueueDestination, openPlaylistSelector, openTagManager } from '@/store/useUIStore';
import { useAppTheme } from '@/hooks/useAppTheme';
import { Q } from '@nozbe/watermelondb';
import { pickDocumentForCopy } from '../../services/DocumentPickerService';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { database } from '../../database';
import Artist from '../../database/models/Artist';
import Track from '../../database/models/Track';
import { useMultiSelectStore } from '../../store/useMultiSelectStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useToastStore } from '../../store/useToastStore';
import { MediaAssetService } from '../../services/MediaAssetService';
import { ScannerService } from '../../services/ScannerService';
import { ShuffleService } from '../../services/ShuffleService';

export default function AlbumMenuSheet() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const { props: { album: selectedAlbum, callbacks: navCallbacks }, close: closeMenu, closeThen } = useSheetProps<{ album: any; callbacks: any }>('album-menu');
  const addMultipleToQueueNext = usePlayerStore(state => state.addMultipleToQueueNext);
  const addMultipleToQueueEnd = usePlayerStore(state => state.addMultipleToQueueEnd);

  const [artistName, setArtistName] = useState(t('actions.unknown'));
  const [artistId, setArtistId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);

  const handleChangeCDImage = async () => {
    try {
      const result = await pickDocumentForCopy('image/*');
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const destUri = await MediaAssetService.saveAlbumCDCover(selectedAlbum.id, asset.uri, asset.name);

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

  const handleExcludeAlbum = () => {
    if (tracks.length === 0) return;
    setTimeout(() => {
      Alert.alert(
        t('actions.exclude_song_title'),
        t('actions.exclude_songs_confirm', { count: tracks.length }),
        [
          { text: t('actions.cancel'), style: 'cancel' },
          {
            text: t('actions.exclude'),
            style: 'destructive',
            onPress: async () => {
              closeMenu();
              const songPaths = tracks.map(tr => tr.fileUrl);
              const { excludeSong, excludeFolder } = useSettingsStore.getState();
              const folders = new Set<string>();
              for (const path of songPaths) {
                excludeSong(path);
                const lastSlash = path.lastIndexOf('/');
                if (lastSlash !== -1) folders.add(path.substring(0, lastSlash));
              }
              for (const folderPath of folders) {
                const folderTracks = await database.collections.get<Track>('tracks').query(
                  Q.where('file_url', Q.like(`${folderPath}%`))
                ).fetch();
                const directInFolder = folderTracks.filter(ft => {
                  const idx = ft.fileUrl.lastIndexOf('/');
                  return idx !== -1 && ft.fileUrl.substring(0, idx) === folderPath;
                });
                if (directInFolder.length > 0 && directInFolder.every(ft => (ft._raw as any).album_id === selectedAlbum.id)) {
                  excludeFolder(folderPath);
                }
              }
              await ScannerService.deleteMultipleSongsContents(songPaths);
            },
          },
        ]
      );
    }, 100);
  };

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
      <MenuOption icon="duplicate-outline" disabled={tracks.length === 0} text={t('queue.add_to_other')} onPress={() => openQueueDestination(tracks)} />


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
      {/* OPTION: Exclude / Include from shuffle */}
      <MenuOption
        icon="shuffle-outline"
        text={selectedAlbum.isExcludedFromShuffle ? t('actions.include_album_in_shuffle') : t('actions.exclude_album_from_shuffle')}
        onPress={async () => {
          const wasExcluded = !!selectedAlbum.isExcludedFromShuffle;
          closeMenu();
          await ShuffleService.toggleAlbumExclusion(selectedAlbum);
          useToastStore.getState().showToast(
            wasExcluded ? t('toasts.album_included_in_shuffle') : t('toasts.album_excluded_from_shuffle'),
            'shuffle'
          );
        }}
      />
      <MenuOption
        icon="disc-outline"
        text={t('actions.customize_cd')}
        onPress={handleChangeCDImage}
      />
      {/* separator */}
      {artistId && !isVariousArtists(artistName) && <MenuSeparator />}

      {/* OPTION: Go to Artist */}
      {artistId && !isVariousArtists(artistName) && !isAlreadyOnArtistScreen && (
        <MenuOption
          icon="person-outline"
          text={t('actions.go_to_artist')}
          onPress={() => {
            const destinationArtistId = artistId;
            closeThen(() => openArtist(destinationArtistId));
          }}
        />
      )}

      <MenuSeparator />

      {/* OPTION: Exclude from scan */}
      <MenuOption
        icon="eye-off-outline"
        text={t('actions.exclude_scan')}
        iconColor={colors.heartIcon}
        textStyle={{ color: colors.heartIcon }}
        disabled={tracks.length === 0}
        onPress={handleExcludeAlbum}
      />
    </BaseMenuSheet>
  );
}
