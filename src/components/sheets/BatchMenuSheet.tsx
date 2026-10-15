import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { useSheetProps } from '@/hooks/useSheetProps';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BaseMenuSheet, MenuOption, MenuSeparator } from '@/components/sheets/BaseMenuSheet';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useToastStore } from '../../store/useToastStore';
import { useMultiSelectStore } from '../../store/useMultiSelectStore';
import { openQueueDestination, openMetadataEditor, openPlaylistSelector, openTagManagerForBatch, openCanvasManager } from '@/store/useUIStore';
import { database } from '../../database';
import { ScannerService } from '../../services/ScannerService';
import { MediaAssetService } from '../../services/MediaAssetService';
import { ShuffleService } from '../../services/ShuffleService';
import { zipAndShareTracks } from '../../utils/zipHelper';

export default function BatchMenuSheet() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const { props: { tracks: selectedTracks }, close: closeMenu } = useSheetProps<{ tracks: any[] }>('batch-menu');
  const addMultipleToQueueNext = usePlayerStore(state => state.addMultipleToQueueNext);
  const addMultipleToQueueEnd = usePlayerStore(state => state.addMultipleToQueueEnd);
  const exitSelectionMode = useMultiSelectStore(state => state.exitSelectionMode);

  if (!selectedTracks || selectedTracks.length === 0) return null;

  const anyHasCanvas = selectedTracks.some(t => !!t.bgVideo);
  const anyIsFavorite = selectedTracks.some(t => t.isFavorite);
  const anyIsExcludedFromShuffle = selectedTracks.some(t => !!t.isExcludedFromShuffle);
  const anyIsNotExcludedFromShuffle = selectedTracks.some(t => !t.isExcludedFromShuffle);

  const handleExcludeFromShuffle = async () => {
    try {
      await ShuffleService.batchSetTracksExclusion(selectedTracks, true);
      useToastStore.getState().showToast(t('toasts.batch_excluded_from_shuffle'), 'shuffle');
      exitSelectionMode();
      closeMenu();
    } catch (e) {
      console.error('Error excluyendo canciones de aleatorio en lote:', e);
    }
  };

  const handleIncludeInShuffle = async () => {
    try {
      await ShuffleService.batchSetTracksExclusion(selectedTracks, false);
      useToastStore.getState().showToast(t('toasts.batch_included_in_shuffle'), 'shuffle');
      exitSelectionMode();
      closeMenu();
    } catch (e) {
      console.error('Error incluyendo canciones en aleatorio en lote:', e);
    }
  };

  const handleAddNext = () => {
    addMultipleToQueueNext(selectedTracks);
    useToastStore.getState().showToast(t('toasts.playing_next'), 'return-down-forward');
    exitSelectionMode();
    closeMenu();
  };

  const handleAddEnd = () => {
    addMultipleToQueueEnd(selectedTracks);
    useToastStore.getState().showToast(t('toasts.added_to_queue'), 'list');
    exitSelectionMode();
    closeMenu();
  };

  const handleEditMetadata = () => {
    closeMenu();
    openMetadataEditor(selectedTracks);
  };

  const handleOpenCanvasManager = (targetTracks: any[]) => {
    if (targetTracks.length === 0) {
      Alert.alert(t('actions.info'), t('canvas.no_tracks_to_update'));
      return;
    }
    closeMenu();
    openCanvasManager(targetTracks);
  };

  const handlePickCanvas = () => {
    if (anyHasCanvas) {
      Alert.alert(
        t('canvas.update_batch_title'),
        t('canvas.update_batch_msg'),
        [
          { text: t('actions.cancel'), style: 'cancel' },
          { text: t('canvas.update_all'), onPress: () => handleOpenCanvasManager(selectedTracks) },
          { text: t('canvas.update_only_without'), onPress: () => handleOpenCanvasManager(selectedTracks.filter((t: any) => !t.bgVideo)) }
        ]
      );
    } else {
      handleOpenCanvasManager(selectedTracks);
    }
  };

  const handleRemoveCanvas = () => {
    Alert.alert(
      t('canvas.remove_from_tracks'),
      t('canvas.remove_confirm'),
      [
        { text: t('actions.cancel'), style: 'cancel' },
        {
          text: t('actions.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await MediaAssetService.removeCanvasFromTracks(selectedTracks);
              useToastStore.getState().showToast(t('actions.canvas_removed'), 'trash');
              exitSelectionMode();
              closeMenu();
            } catch (e) {
              console.error('[BatchMenuSheet] Error quitando vídeo:', e);
            }
          },
        },
      ]
    );
  };

  const handleManageTags = () => {
    closeMenu();
    openTagManagerForBatch(selectedTracks);
  };

  const handleAddToPlaylist = () => {
    closeMenu();
    openPlaylistSelector(selectedTracks);
  };

  const handleShareAsZip = async () => {
    closeMenu();
    try {
      await zipAndShareTracks(selectedTracks);
      exitSelectionMode();
    } catch {
      Alert.alert(t('actions.error'), t('actions.share_zip_error'));
    }
  };

  const handleAddToFavorites = async () => {
    const tracksToLike = selectedTracks.filter(t => !t.isFavorite);
    if (tracksToLike.length > 0) {
      await database.write(async () => {
        for (const track of tracksToLike) {
          await track.update((t: any) => {
            t.isFavorite = true;
          });
        }
      });
    }
    useToastStore.getState().showToast(t('toasts.added_to_favourites'), 'heart');
    exitSelectionMode();
    closeMenu();
  };

  const handleRemoveFromFavorites = async () => {
    const tracksToUnlike = selectedTracks.filter(t => t.isFavorite);
    if (tracksToUnlike.length > 0) {
      await database.write(async () => {
        for (const track of tracksToUnlike) {
          await track.update((t: any) => {
            t.isFavorite = false;
          });
        }
      });
    }
    useToastStore.getState().showToast(t('toasts.removed_from_favourites'), 'heart-dislike');
    exitSelectionMode();
    closeMenu();
  };

  const handleExclude = () => {
    setTimeout(() => {
      Alert.alert(
        t('actions.exclude_song_title'),
        t('actions.exclude_songs_confirm', { count: selectedTracks.length }),
        [
          { text: t('actions.cancel'), style: "cancel" },
          {
            text: t('actions.exclude'),
            style: "destructive",
            onPress: async () => {
              closeMenu();
              const songPaths = selectedTracks.map(t => t.fileUrl);
              const excludeSong = useSettingsStore.getState().excludeSong;
              for (const path of songPaths) {
                excludeSong(path);
              }
              await ScannerService.deleteMultipleSongsContents(songPaths);
              exitSelectionMode();
            }
          }
        ]
      );
    }, 100);
  };

  return (
    <BaseMenuSheet
      title={t('library.song_count', { count: selectedTracks.length })}
      subtitle={t('actions.batch_actions')}
      placeholderIcon="checkbox-outline"
    >
      {/* OPTION: Play Next */}
      <MenuOption
        icon="return-down-forward"
        text={t('actions.add_next')}
        onPress={handleAddNext}
      />

      {/* OPTION: Add to Queue */}
      <MenuOption
        icon="list"
        text={t('actions.add_to_queue')}
        onPress={handleAddEnd}
      />
      <MenuOption icon="duplicate-outline" text={t('queue.add_to_other')} onPress={() => openQueueDestination(selectedTracks, exitSelectionMode)} />


      {/* OPTION: Edit Metadata */}
      <MenuOption
        icon="pencil"
        text={t('metadata_editor.title_batch')}
        onPress={handleEditMetadata}
      />

      {/* OPTION: Change Background Video / Canvas */}
      <MenuOption
        icon="videocam-outline"
        text={t('actions.canvas_change')}
        onPress={handlePickCanvas}
      />

      {/* OPTION: Remove Background Video if at least one selected has canvas */}
      {anyHasCanvas && (
        <MenuOption
          icon="videocam-off-outline"
          text={t('actions.canvas_remove')}
          iconColor={colors.heartIcon}
          textStyle={{ color: colors.heartIcon }}
          onPress={handleRemoveCanvas}
        />
      )}

      {/* OPTION: Manage Tags */}
      <MenuOption
        icon="pricetag-outline"
        text={t('tags.manage')}
        onPress={handleManageTags}
      />

      {/* OPTION: Add to Playlist */}
      <MenuOption
        icon="add-circle-outline"
        text={t('actions.add_to_playlist')}
        onPress={handleAddToPlaylist}
      />

      {/* OPTION: Share selection as ZIP */}
      <MenuOption
        icon="share-social-outline"
        text={t('actions.share_as_zip')}
        onPress={handleShareAsZip}
      />

      {/* OPTION: Add to Favorites */}
      <MenuOption
        icon="heart-outline"
        text={t('actions.add_to_favorites')}
        onPress={handleAddToFavorites}
      />

      {/* OPTION: Remove from Favorites (Only show if at least one selected is favorite) */}
      {anyIsFavorite && (
        <MenuOption
          icon="heart-dislike-outline"
          text={t('actions.remove_from_favorites')}
          iconColor={colors.heartIcon}
          textStyle={{ color: colors.heartIcon }}
          onPress={handleRemoveFromFavorites}
        />
      )}

      {/* OPTION: Exclude from Shuffle */}
      {anyIsNotExcludedFromShuffle && (
        <MenuOption
          icon="shuffle-outline"
          text={t('actions.batch_exclude_from_shuffle')}
          onPress={handleExcludeFromShuffle}
        />
      )}

      {/* OPTION: Include in Shuffle */}
      {anyIsExcludedFromShuffle && (
        <MenuOption
          icon="shuffle-outline"
          text={t('actions.batch_include_in_shuffle')}
          onPress={handleIncludeInShuffle}
        />
      )}

      <MenuSeparator />

      {/* OPTION: Exclude songs */}
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
