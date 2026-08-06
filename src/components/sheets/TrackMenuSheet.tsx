import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View, Text, TouchableOpacity } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import Album from '../../database/models/Album';
import Artist from '../../database/models/Artist';
import { getActiveTabName, navigationRef } from '../../navigation/navigationRef';
import { PlaylistService } from '../../services/PlaylistService';
import { ScannerService } from '../../services/ScannerService';
import { useMultiSelectStore } from '../../store/useMultiSelectStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useToastStore } from '../../store/useToastStore';
import { MediaAssetService } from '../../services/MediaAssetService';
import { useSheetProps } from '@/hooks/useSheetProps';
import { openArtistsList, openMetadataEditor, openTagManager, openPlaylistSelector } from '@/store/useUIStore';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BaseMenuSheet, MenuOption, MenuSeparator } from '@/components/sheets/BaseMenuSheet';

const TrackRatingRow = React.memo(({
  rating,
  onRatingChange,
  colors
}: {
  rating: number | null;
  onRatingChange: (val: number | null) => void;
  colors: any;
}) => {
  const { t } = useTranslation();
  const [localRating, setLocalRating] = useState<number | null>(rating);

  useEffect(() => {
    setLocalRating(rating);
  }, [rating]);

  const handleStarPress = (starIndex: number, isHalf: boolean) => {
    const newRating = isHalf ? starIndex - 0.5 : starIndex;
    // Si se pulsa la misma estrella que ya está seleccionada, limpia la valoración
    if (newRating === localRating) {
      setLocalRating(null);
      onRatingChange(null);
    } else {
      setLocalRating(newRating);
      onRatingChange(newRating);
    }
  };

  const handleClear = () => {
    setLocalRating(null);
    onRatingChange(null);
  };

  const renderStars = () => {
    const stars = [];
    const currentRating = localRating || 0;
    for (let i = 1; i <= 5; i++) {
      let iconName: "star" | "star-half" | "star-outline" = "star-outline";
      if (i <= currentRating) {
        iconName = "star";
      } else if (i - 0.5 === currentRating) {
        iconName = "star-half";
      }
      const isFilled = currentRating >= i - 0.5;
      stars.push(
        <View key={i} style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
          <Ionicons
            name={iconName}
            size={44}
            color={isFilled ? '#FFD700' : '#888888'}
          />
          {/* Left half touchable for half rating */}
          <TouchableOpacity
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 22,
            }}
            onPress={() => handleStarPress(i, true)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8 }}
          />
          {/* Right half touchable for full rating */}
          <TouchableOpacity
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: 22,
            }}
            onPress={() => handleStarPress(i, false)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8 }}
          />
        </View>
      );
    }
    return stars;
  };

  return (
    <View style={{
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
    }}>
      <Text style={{
        color: '#888888',
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 8,
        letterSpacing: 1
      }}>
        {t('actions.rating_label')}: {localRating ? localRating.toFixed(1) : t('actions.rating_none')}
      </Text>

      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {renderStars()}
        </View>

        {/* Botón X para limpiar la valoración */}
        <TouchableOpacity
          onPress={handleClear}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
          style={{
            marginLeft: 4,
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: localRating ? 'rgba(255,255,255,0.15)' : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name="close"
            size={16}
            color={localRating ? '#AAAAAA' : 'rgba(100,100,100,0.4)'}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
});
TrackRatingRow.displayName = 'TrackRatingRow';

export default function TrackMenuSheet() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const { props: { track: selectedTrack, callbacks: navCallbacks, playlistId }, close: closeMenu } = useSheetProps<{ track: any; callbacks?: any; playlistId?: string }>('track-menu');
  const addToQueueNext = usePlayerStore(state => state.addToQueueNext);
  const addToQueueEnd = usePlayerStore(state => state.addToQueueEnd);
  const excludeSong = useSettingsStore(state => state.excludeSong);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [artistName, setArtistName] = useState(t('actions.unknown'));
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [artistId, setArtistId] = useState<string | null>(null);
  const [artistsList, setArtistsList] = useState<Artist[]>([]);
  const [isFavorite, setIsFavorite] = useState(selectedTrack?.isFavorite ?? false);

  useEffect(() => {
    if (selectedTrack) {
      setIsFavorite(selectedTrack.isFavorite);
    }
  }, [selectedTrack]);

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

  const handleToggleFavorite = async () => {
    if (!selectedTrack) return;
    try {
      const wasFavorite = isFavorite;
      await selectedTrack.toggleLike();
      closeMenu();
      useToastStore.getState().showToast(
        wasFavorite ? t('toasts.removed_from_favourites') : t('toasts.added_to_favourites'),
        wasFavorite ? 'heart-dislike' : 'heart'
      );
    } catch (error) {
      console.error('Error al cambiar favorito:', error);
    }
  };

  return (
    <BaseMenuSheet
      title={selectedTrack.title}
      subtitle={artistName}
      coverUrl={imageUrl}
      placeholderIcon="musical-notes"
    >
      <MenuSeparator />
      <TrackRatingRow
        rating={selectedTrack.rating}
        colors={colors}
        onRatingChange={async (newRating) => {
          try {
            await selectedTrack.updateRating(newRating);
          } catch (e) {
            console.error('Error updating track rating:', e);
          }
        }}
      />
      <MenuSeparator />

      {/* OPTION: Play Next */}
      <MenuOption
        icon="return-down-forward"
        text={t('actions.add_next')}
        onPress={() => {
          addToQueueNext(selectedTrack);
          useToastStore.getState().showToast(t('toasts.playing_next'), 'return-down-forward');
          closeMenu();
        }}
      />

      {/* OPTION: Add to Queue */}
      <MenuOption
        icon="list"
        text={t('actions.add_to_queue')}
        onPress={() => {
          addToQueueEnd(selectedTrack);
          useToastStore.getState().showToast(t('toasts.added_to_queue'), 'list');
          closeMenu();
        }}
      />

      {/* OPTION: Select */}
      <MenuOption
        icon="checkmark-circle-outline"
        text={t('actions.select') || 'Seleccionar'}
        onPress={() => {
          closeMenu();
          useMultiSelectStore.getState().enterSelectionMode(selectedTrack);
        }}
      />

      {/* OPTION: Edit Metadata */}
      <MenuOption
        icon="pencil"
        text={t('metadata_editor.title_single') || 'Editar metadatos'}
        onPress={() => {
          closeMenu();
          openMetadataEditor([selectedTrack]);
        }}
      />

      {/* OPTION: Add Background Video / Canvas */}
      <MenuOption
        icon="videocam-outline"
        text={selectedTrack.bgVideo ? t('actions.canvas_change') : t('actions.canvas_add')}
        onPress={async () => {
          try {
            const result = await DocumentPicker.getDocumentAsync({
              type: 'video/*',
              copyToCacheDirectory: true,
            });

            const asset = result.assets?.[0];
            if (asset) {
              const persistentUri = await MediaAssetService.saveTrackCanvasVideo(selectedTrack.id, asset.uri);
              await selectedTrack.updateBgVideo(persistentUri);
              useToastStore.getState().showToast(t('actions.canvas_saved'), 'videocam');
              closeMenu();
            }
          } catch (error) {
            console.error('Error al seleccionar vídeo:', error);
            Alert.alert(t('actions.error'), t('actions.canvas_error'));
          }
        }}
      />

      {/* OPTION: Remove Background Video if exists */}
      {selectedTrack.bgVideo && (
        <MenuOption
          icon="videocam-off-outline"
          text={t('actions.canvas_remove')}
          iconColor={colors.heartIcon}
          textStyle={{ color: colors.heartIcon }}
          onPress={async () => {
            await MediaAssetService.removeTrackCanvasVideo(selectedTrack.id);
            await selectedTrack.updateBgVideo(null);
            useToastStore.getState().showToast(t('actions.canvas_removed'), 'trash');
            closeMenu();
          }}
        />
      )}

      {/* OPTION: Manage Tags */}
      <MenuOption
        icon="pricetag-outline"
        text={t('tags.manage')}
        onPress={() => {
          closeMenu();
          openTagManager('track', selectedTrack.id, selectedTrack.title);
        }}
      />

      {/* OPTION: Add to Playlist */}
      <MenuOption
        icon="add-circle-outline"
        text={t('actions.add_to_playlist')}
        onPress={() => {
          closeMenu();
          openPlaylistSelector(selectedTrack);
        }}
      />

      {/* OPTION: Remove from Playlist */}
      {playlistId && (
        <MenuOption
          icon="trash-outline"
          text={t('actions.remove_from_playlist')}
          iconColor={colors.heartIcon}
          textStyle={{ color: colors.heartIcon }}
          onPress={async () => {
            const pId = playlistId!;
            closeMenu();
            await PlaylistService.removeTrackFromPlaylist(pId, selectedTrack.id);
          }}
        />
      )}

      {/* OPTION: Favorite */}
      <MenuOption
        icon={isFavorite ? "heart" : "heart-outline"}
        text={isFavorite ? t('actions.remove_from_favorites') : t('actions.add_to_favorites')}
        iconColor={isFavorite ? colors.heartIcon : colors.text}
        textStyle={isFavorite ? { color: colors.heartIcon } : undefined}
        onPress={handleToggleFavorite}
      />

      {/* OPTION: Share */}
      <MenuOption
        icon="share-social-outline"
        text={t('actions.share')}
        onPress={handleShare}
      />

      {/* separator */}
      {(albumId || artistId) && <MenuSeparator />}

      {/* OPTION: Go to Album */}
      {albumId && (
        <MenuOption
          icon="disc-outline"
          text={t('actions.go_to_album')}
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
        />
      )}

      {/* OPTION: Go to Artist */}
      {artistId && (
        <MenuOption
          icon="person-outline"
          text={t('actions.go_to_artist')}
          onPress={() => {
            closeMenu();
            if (artistsList.length > 1) {
              openArtistsList(artistsList);
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
        />
      )}

      {/* OPTION: Exclude song */}
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
