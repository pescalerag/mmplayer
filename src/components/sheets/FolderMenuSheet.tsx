import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { Q } from '@nozbe/watermelondb';
import { database } from '../../database';
import Track from '../../database/models/Track';
import { ScannerService } from '../../services/ScannerService';
import { useSheetProps } from '@/hooks/useSheetProps';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useMultiSelectStore } from '../../store/useMultiSelectStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useToastStore } from '../../store/useToastStore';
import { openPlaylistSelector } from '@/store/useUIStore';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BaseMenuSheet, MenuOption, MenuSeparator } from '@/components/sheets/BaseMenuSheet';

export default function FolderMenuSheet() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const { props: { folderPath: selectedFolderPath, folderName: selectedFolderName }, close: closeMenu } = useSheetProps<{ folderPath: string; folderName?: string; callbacks?: any }>('folder-menu');
  const excludeFolder = useSettingsStore(state => state.excludeFolder);
  const [tracks, setTracks] = useState<Track[]>([]);

  // Load tracks in this folder
  useEffect(() => {
    if (!selectedFolderPath) {
      setTracks([]);
      return;
    }

    const loadTracks = async () => {
      try {
        const tracksList = await database.collections.get<Track>('tracks').query(
          Q.where('file_url', Q.like(`${selectedFolderPath}%`))
        ).fetch();
        
        const directTracksList = tracksList.filter(t => {
          const lastSlash = t.fileUrl.lastIndexOf('/');
          if (lastSlash === -1) return false;
          const dirPath = t.fileUrl.substring(0, lastSlash);
          return dirPath === selectedFolderPath;
        });

        setTracks(directTracksList);
      } catch (error) {
        console.error("Error loading folder tracks in menu sheet:", error);
      }
    };

    loadTracks();
  }, [selectedFolderPath]);

  if (!selectedFolderPath) return null;

  const handleExclude = () => {
    setTimeout(() => {
      Alert.alert(
        t('actions.exclude_folder_title'),
        t('actions.exclude_folder_confirm'),
        [
          { text: t('actions.cancel'), style: "cancel" },
          {
            text: t('actions.exclude'),
            style: "destructive",
            onPress: async () => {
              closeMenu();
              excludeFolder(selectedFolderPath);
              await ScannerService.deleteFolderContents(selectedFolderPath);
            }
          }
        ]
      );
    }, 100);
  };

  return (
    <BaseMenuSheet
      title={selectedFolderName}
      subtitle={t('library.folder_singular')}
      placeholderIcon="folder"
      placeholderIconColor={colors.accent}
    >
      {/* OPTION: Play Next */}
      <MenuOption
        icon="return-down-forward"
        text={t('actions.add_next')}
        onPress={() => {
          if (tracks.length > 0) {
            usePlayerStore.getState().addMultipleToQueueNext(tracks);
            useToastStore.getState().showToast(t('toasts.folder_next'), 'return-down-forward');
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
            usePlayerStore.getState().addMultipleToQueueEnd(tracks);
            useToastStore.getState().showToast(t('toasts.folder_queued'), 'list');
            closeMenu();
          }
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

      {/* Separator */}
      <MenuSeparator />

      {/* OPTION: Exclude */}
      <MenuOption
        icon="eye-off-outline"
        text={t('actions.exclude_scan')}
        iconColor={colors.heartIcon}
        textStyle={{ color: colors.heartIcon }}
        onPress={handleExclude}
      />
    </BaseMenuSheet>
  );
}
