import { useAppTheme } from "@/hooks/useAppTheme";
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
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
import Album from '../database/models/Album';
import Artist from '../database/models/Artist';
import { getActiveTabName, navigationRef } from '../navigation/navigationRef';
import { PlaylistService } from '../services/PlaylistService';
import { ScannerService } from '../services/ScannerService';
import { useArtistsListSheetStore } from '../store/useArtistsListSheetStore';
import { useMetadataEditorStore } from '../store/useMetadataEditorStore';
import { useMultiSelectStore } from '../store/useMultiSelectStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { usePlaylistSelectorStore } from '../store/usePlaylistSelectorStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useTagManagerStore } from '../store/useTagManagerStore';
import { useToastStore } from '../store/useToastStore';
import { useTrackMenuStore } from '../store/useTrackMenuStore';

export default function TrackMenuSheet() {
  const { colors, fonts, layout } = useAppTheme();
  const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
  const { t } = useTranslation();
  const { selectedTrack, closeMenu, navCallbacks } = useTrackMenuStore();
  const addToQueueNext = usePlayerStore(state => state.addToQueueNext);
  const addToQueueEnd = usePlayerStore(state => state.addToQueueEnd);
  const excludeSong = useSettingsStore(state => state.excludeSong);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [artistName, setArtistName] = useState(t('actions.unknown'));
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [artistId, setArtistId] = useState<string | null>(null);
  const [artistsList, setArtistsList] = useState<Artist[]>([]);

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

  return (
    <>
      {/* Menu Header */}
      <View style={styles.header}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.thumbnail}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.thumbnail, styles.placeholder]}>
            <Ionicons name="musical-notes" size={24} color={colors.textSecondary} />
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>{selectedTrack.title}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{artistName}</Text>
        </View>
      </View>

      {/* Options list */}
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
            addToQueueNext(selectedTrack);
            useToastStore.getState().showToast(t('toasts.playing_next'), 'return-down-forward');
            closeMenu();
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
            addToQueueEnd(selectedTrack);
            useToastStore.getState().showToast(t('toasts.added_to_queue'), 'list');
            closeMenu();
          }}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="list" size={24} color={colors.text} />
          </View>
          <Text style={styles.optionText}>{t('actions.add_to_queue')}</Text>
        </TouchableOpacity>

        {/* OPTION: Select */}
        <TouchableOpacity
          style={styles.optionRow}
          onPress={() => {
            closeMenu();
            useMultiSelectStore.getState().enterSelectionMode(selectedTrack);
          }}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="checkmark-circle-outline" size={24} color={colors.text} />
          </View>
          <Text style={styles.optionText}>{t('actions.select') || 'Seleccionar'}</Text>
        </TouchableOpacity>

        {/* OPTION: Edit Metadata */}
        <TouchableOpacity
          style={styles.optionRow}
          onPress={() => {
            closeMenu();
            useMetadataEditorStore.getState().openSheet([selectedTrack]);
          }}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="pencil" size={24} color={colors.text} />
          </View>
          <Text style={styles.optionText}>{t('metadata_editor.title_single') || 'Editar metadatos'}</Text>
        </TouchableOpacity>

        {/* OPTION: Manage Tags */}
        <TouchableOpacity
          style={styles.optionRow}
          onPress={() => {
            closeMenu();
            useTagManagerStore.getState().openForTrack(selectedTrack);
          }}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="pricetag-outline" size={24} color={colors.text} />
          </View>
          <Text style={styles.optionText}>{t('tags.manage')}</Text>
        </TouchableOpacity>

        {/* OPTION: Add to Playlist */}
        <TouchableOpacity
          style={styles.optionRow}
          onPress={() => {
            closeMenu();
            usePlaylistSelectorStore.getState().openSelector(selectedTrack);
          }}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="add-circle-outline" size={24} color={colors.text} />
          </View>
          <Text style={styles.optionText}>{t('actions.add_to_playlist')}</Text>
        </TouchableOpacity>

        {/* OPTION: Remove from Playlist */}
        {useTrackMenuStore.getState().playlistId && (
          <TouchableOpacity
            style={styles.optionRow}
            onPress={async () => {
              const pId = useTrackMenuStore.getState().playlistId!;
              closeMenu();
              await PlaylistService.removeTrackFromPlaylist(pId, selectedTrack.id);
            }}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="trash-outline" size={24} color={colors.heartIcon} />
            </View>
            <Text style={[styles.optionText, { color: colors.heartIcon }]}>{t('actions.remove_from_playlist')}</Text>
          </TouchableOpacity>
        )}

        {/* OPTION: Share */}
        <TouchableOpacity
          style={styles.optionRow}
          onPress={handleShare}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="share-social-outline" size={24} color={colors.text} />
          </View>
          <Text style={styles.optionText}>{t('actions.share')}</Text>
        </TouchableOpacity>

        {/* separator */}
        <View style={styles.separator} />

        {/* OPTION: Go to Album */}
        {albumId && (
          <TouchableOpacity
            style={styles.optionRow}
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
          >
            <View style={styles.iconContainer}>
              <Ionicons name="disc-outline" size={24} color={colors.text} />
            </View>
            <Text style={styles.optionText}>{t('actions.go_to_album')}</Text>
          </TouchableOpacity>
        )}

        {/* OPTION: Go to Artist */}
        {artistId && (
          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => {
              closeMenu();
              if (artistsList.length > 1) {
                useArtistsListSheetStore.getState().openSheet(artistsList);
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
          >
            <View style={styles.iconContainer}>
              <Ionicons name="person-outline" size={24} color={colors.text} />
            </View>
            <Text style={styles.optionText}>{t('actions.go_to_artist')}</Text>
          </TouchableOpacity>
        )}

        {/* OPTION: Exclude song */}
        <TouchableOpacity
          style={styles.optionRow}
          onPress={handleExclude}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="eye-off-outline" size={24} color={colors.heartIcon} />
          </View>
          <Text style={[styles.optionText, { color: colors.heartIcon }]}>{t('actions.exclude_song')}</Text>
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
