import { openPlaylistSelector } from '@/store/useUIStore';
import { useAppTheme } from "@/hooks/useAppTheme";
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { database } from '../database';
import Track from '../database/models/Track';
import { ScannerService } from '../services/ScannerService';
import { useSheetProps } from '@/hooks/useSheetProps';
import { usePlayerStore } from '../store/usePlayerStore';

import { useMultiSelectStore } from '../store/useMultiSelectStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useToastStore } from '../store/useToastStore';

export default function FolderMenuSheet() {
  const { colors, fonts, layout } = useAppTheme();
  const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
  const { t } = useTranslation();
  const { props: { folderPath: selectedFolderPath, folderName: selectedFolderName, callbacks: navCallbacks }, close: closeMenu } = useSheetProps<{ folderPath: string; folderName?: string; callbacks?: any }>('folder-menu');
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
  };

  return (
    <>
      {/* Menu Header */}
      <View style={styles.header}>
        <View style={[styles.thumbnail, styles.placeholder]}>
          <Ionicons name="folder" size={24} color={colors.accent} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>{selectedFolderName}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{t('library.folder_singular')}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {/* OPTION: Play Next */}
        <TouchableOpacity
          style={styles.optionRow}
          onPress={() => {
            if (tracks.length > 0) {
              usePlayerStore.getState().addMultipleToQueueNext(tracks);
              useToastStore.getState().showToast(t('toasts.folder_next'), 'return-down-forward');
              closeMenu();
            }
          }}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="return-down-forward" size={24} color={colors.text} />
          </View>
          <Text style={styles.optionText}>{t('actions.add_next')}</Text>
        </TouchableOpacity>

        {/* OPTION: Add to Queue */}
        <TouchableOpacity
          style={styles.optionRow}
          onPress={() => {
            if (tracks.length > 0) {
              usePlayerStore.getState().addMultipleToQueueEnd(tracks);
              useToastStore.getState().showToast(t('toasts.folder_queued'), 'list');
              closeMenu();
            }
          }}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="list" size={24} color={colors.text} />
          </View>
          <Text style={styles.optionText}>{t('actions.add_to_queue')}</Text>
        </TouchableOpacity>

        {/* OPTION: Add to Playlist */}
        <TouchableOpacity
          style={styles.optionRow}
          onPress={() => {
            if (tracks.length > 0) {
              closeMenu();
              openPlaylistSelector(tracks);
            }
          }}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="add-circle-outline" size={24} color={colors.text} />
          </View>
          <Text style={styles.optionText}>{t('actions.add_to_playlist')}</Text>
        </TouchableOpacity>

        {/* OPTION: Select songs */}
        <TouchableOpacity
          style={styles.optionRow}
          onPress={() => {
            if (tracks.length > 0) {
              closeMenu();
              useMultiSelectStore.getState().selectMultipleTracks(tracks);
            }
          }}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="checkmark-circle-outline" size={24} color={colors.text} />
          </View>
          <Text style={styles.optionText}>{t('actions.select_all')}</Text>
        </TouchableOpacity>

        {/* Separator */}
        <View style={styles.separator} />

        {/* OPTION: Exclude */}
        <TouchableOpacity
          style={styles.optionRow}
          onPress={handleExclude}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="eye-off-outline" size={24} color={colors.heartIcon} />
          </View>
          <Text style={[styles.optionText, { color: colors.heartIcon }]}>{t('actions.exclude_scan')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const getStyles = (colors: any, fonts: any, layout: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBackground,
    paddingBottom: 20,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 16,
  },
  placeholder: {
    backgroundColor: colors.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontFamily: fonts.regular,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.regular,
    fontWeight: '700',
    marginTop: 4,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  iconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionText: {
    color: colors.text,
    fontSize: 16,
    fontFamily: fonts.regular,
    fontWeight: '700',
  },
  separator: {
    height: 1,
    backgroundColor: colors.cardBackground,
    marginVertical: 8,
  },
});
