import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useSheetProps } from '@/hooks/useSheetProps';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BaseMenuSheet, MenuOption, MenuSeparator } from '@/components/sheets/BaseMenuSheet';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useToastStore } from '../../store/useToastStore';
import { useMultiSelectStore } from '../../store/useMultiSelectStore';
import { openMetadataEditor, openPlaylistSelector, openTagManagerForBatch } from '@/store/useUIStore';
import { database } from '../../database';
import { ScannerService } from '../../services/ScannerService';

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

  const performPickCanvas = async (targetTracks: any[]) => {
    if (targetTracks.length === 0) {
      Alert.alert('Info', 'No hay canciones para actualizar.');
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'video/*',
        copyToCacheDirectory: true,
      });

      const asset = result.assets?.[0];
      if (asset) {
        await database.write(async () => {
          for (const track of targetTracks) {
            await track.update((t: any) => {
              t.bgVideo = asset.uri;
            });
          }
        });
        useToastStore.getState().showToast(t('actions.canvas_saved'), 'videocam');
        exitSelectionMode();
        closeMenu();
      }
    } catch (error) {
      console.error('Error al seleccionar vídeo en lote:', error);
      Alert.alert(t('actions.error'), t('actions.canvas_error'));
    }
  };

  const handlePickCanvas = () => {
    if (anyHasCanvas) {
      Alert.alert(
        'Actualizar Canvas',
        'Algunas canciones seleccionadas ya tienen un vídeo de fondo asignado. ¿Qué deseas hacer?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Actualizar todas', onPress: () => performPickCanvas(selectedTracks) },
          { text: 'Solo las que no tienen', onPress: () => performPickCanvas(selectedTracks.filter(t => !t.bgVideo)) }
        ]
      );
    } else {
      performPickCanvas(selectedTracks);
    }
  };

  const handleManageTags = () => {
    closeMenu();
    openTagManagerForBatch(selectedTracks);
  };

  const handleAddToPlaylist = () => {
    closeMenu();
    openPlaylistSelector(selectedTracks);
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
    Alert.alert(
      t('actions.exclude_song_title'),
      `¿Estás seguro de que deseas excluir estas ${selectedTracks.length} canciones del escaneo? Se borrarán de la biblioteca.`,
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
  };

  return (
    <BaseMenuSheet
      title={`${selectedTracks.length} canciones`}
      subtitle={t('actions.select') || 'Acciones en lote'}
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

      {/* OPTION: Edit Metadata */}
      <MenuOption
        icon="pencil"
        text={t('metadata_editor.title_batch') || 'Editar metadatos'}
        onPress={handleEditMetadata}
      />

      {/* OPTION: Change Background Video / Canvas */}
      <MenuOption
        icon="videocam-outline"
        text={t('actions.canvas_change')}
        onPress={handlePickCanvas}
      />

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
