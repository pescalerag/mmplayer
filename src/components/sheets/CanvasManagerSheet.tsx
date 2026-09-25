import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSheetProps } from '@/hooks/useSheetProps';
import { useToastStore } from '@/store/useToastStore';
import { useMultiSelectStore } from '@/store/useMultiSelectStore';
import { MediaAssetService, CanvasVideoItem } from '@/services/MediaAssetService';
import { formatBytes } from '@/services/StorageService';
import Track from '@/database/models/Track';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CanvasGridItemProps {
  item: CanvasVideoItem;
  isAssigned: boolean;
  itemWidth: number;
  itemHeight: number;
  onPress: (item: CanvasVideoItem) => void;
  onLongPress: (item: CanvasVideoItem) => void;
  colors: any;
  fonts: any;
  styles: any;
}

const CanvasGridItem = React.memo(({
  item,
  isAssigned,
  itemWidth,
  itemHeight,
  onPress,
  onLongPress,
  colors,
  fonts,
  styles,
}: CanvasGridItemProps) => {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
      style={[
        styles.gridItem,
        {
          width: itemWidth,
          height: itemHeight,
          borderColor: isAssigned ? '#10B981' : (colors.cardBackground || '#2A2A2A'),
          borderWidth: isAssigned ? 2 : 1,
        },
      ]}
    >
      {item.thumbnailUri ? (
        <Image
          source={{ uri: item.thumbnailUri }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          recyclingKey={item.uri}
        />
      ) : (
        <View style={styles.placeholderContainer}>
          <LinearGradient
            colors={['#2A2A2A', '#161616']}
            style={StyleSheet.absoluteFillObject}
          />
          <Ionicons name="videocam-outline" size={32} color="rgba(255,255,255,0.4)" />
        </View>
      )}

      {isAssigned && (
        <View style={styles.assignedBadge}>
          <Ionicons name="checkmark-circle" size={20} color="#10B981" />
        </View>
      )}

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.85)']}
        style={styles.itemGradient}
      >
        <View style={styles.itemFooter}>
          <Ionicons name="videocam" size={11} color="rgba(255,255,255,0.7)" />
          <Text style={[styles.itemSizeText, { fontFamily: fonts.regular }]}>
            {formatBytes(item.size)}
          </Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
});
CanvasGridItem.displayName = 'CanvasGridItem';

export default function CanvasManagerSheet() {
  const { colors, fonts, layout } = useAppTheme();
  const styles = useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
  const { t } = useTranslation();

  const {
    isVisible,
    props: { tracks: targetTracks = [] },
    close: closeSheet,
  } = useSheetProps<{ tracks: Track[] }>('canvas-manager');

  const [videos, setVideos] = useState<CanvasVideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  // Cargar lista de vídeos subidos
  const loadVideos = useCallback(async () => {
    try {
      setLoading(true);
      const list = await MediaAssetService.getAllUploadedCanvasVideos();
      setVideos(list);
    } catch (e) {
      console.error('[CanvasManagerSheet] Error cargando vídeos:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isVisible) {
      loadVideos();
    }
  }, [isVisible, loadVideos]);

  // Dimensiones del grid de 3 columnas
  // Container horizontal padding: 24 on each side = 48
  // Gap between columns = 8 (2 gaps = 16)
  const availableWidth = SCREEN_WIDTH - 48;
  const itemWidth = Math.floor((availableWidth - 16) / 3);
  const itemHeight = Math.floor(itemWidth * 1.45);

  // Set de URIs actualmente asignadas a las canciones objetivo
  const assignedUris = useMemo(() => {
    const set = new Set<string>();
    targetTracks.forEach((track) => {
      if (track?.bgVideo) {
        set.add(track.bgVideo);
      }
    });
    return set;
  }, [targetTracks]);

  // Subtítulo descriptivo según el contexto
  const subtitleText = useMemo(() => {
    if (!targetTracks || targetTracks.length === 0) {
      return t('canvas.manager_subtitle') || 'Selecciona un vídeo o sube uno nuevo';
    }
    if (targetTracks.length === 1) {
      return t('canvas.assign_single', { title: targetTracks[0]?.title || t('actions.unknown') }) || `Asignar a ${targetTracks[0]?.title}`;
    }
    return t('canvas.assign_batch', { count: targetTracks.length }) || `Asignar a ${targetTracks.length} canciones`;
  }, [targetTracks, t]);

  // Aplicar un vídeo a las canciones seleccionadas
  const applyVideoUri = useCallback(
    async (uri: string) => {
      try {
        if (targetTracks.length > 0) {
          await MediaAssetService.assignCanvasToTracks(targetTracks, uri);
          useToastStore.getState().showToast(t('actions.canvas_saved') || 'Vídeo de fondo guardado correctamente', 'videocam');
          if (useMultiSelectStore.getState().isSelectionMode) {
            useMultiSelectStore.getState().exitSelectionMode();
          }
        }
        closeSheet();
      } catch (e) {
        console.error('[CanvasManagerSheet] Error asignando vídeo:', e);
        Alert.alert(t('actions.error') || 'Error', t('actions.canvas_error') || 'Hubo un error al asignar el vídeo.');
      }
    },
    [targetTracks, closeSheet, t]
  );

  // Selección directa desde la grilla
  const handleSelectVideo = useCallback(
    (item: CanvasVideoItem) => {
      applyVideoUri(item.uri);
    },
    [applyVideoUri]
  );

  // Eliminación con pulsación larga
  const handleLongPressVideo = useCallback(
    (item: CanvasVideoItem) => {
      Alert.alert(
        t('canvas.delete_title') || 'Eliminar vídeo',
        t('canvas.delete_msg') || '¿Estás seguro de que deseas eliminar este vídeo de la aplicación? Las canciones que lo usen dejarán de tener vídeo de fondo.',
        [
          { text: t('actions.cancel') || 'Cancelar', style: 'cancel' },
          {
            text: t('actions.delete') || 'Eliminar',
            style: 'destructive',
            onPress: async () => {
              try {
                await MediaAssetService.deleteCanvasVideo(item.uri);
                useToastStore.getState().showToast(t('actions.canvas_removed') || 'Vídeo de fondo eliminado', 'trash');
                loadVideos();
              } catch (e) {
                console.error('[CanvasManagerSheet] Error borrando vídeo:', e);
              }
            },
          },
        ]
      );
    },
    [t, loadVideos]
  );

  // Flujo de subir nuevo vídeo con detección de duplicados
  const handleUploadNew = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'video/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      setIsUploading(true);

      const dupCheck = await MediaAssetService.checkCanvasDuplicate(asset.uri);

      if (dupCheck.isDuplicate && dupCheck.existingVideo) {
        setIsUploading(false);
        const existing = dupCheck.existingVideo;

        Alert.alert(
          t('canvas.duplicate_title') || 'Vídeo ya subido',
          t('canvas.duplicate_msg') || 'Este vídeo ya se encuentra subido en la aplicación. ¿Deseas usar el vídeo existente para no duplicar espacio?',
          [
            {
              text: t('actions.cancel') || 'Cancelar',
              style: 'cancel',
              onPress: () => {
                MediaAssetService.cleanupTempSource(asset.uri);
              },
            },
            {
              text: t('canvas.duplicate_continue') || 'Continuar y usar existente',
              onPress: async () => {
                await MediaAssetService.cleanupTempSource(asset.uri);
                await applyVideoUri(existing.uri);
              },
            },
            {
              text: t('canvas.duplicate_upload_anyway') || 'Subir de nuevo',
              onPress: async () => {
                try {
                  setIsUploading(true);
                  const newUri = await MediaAssetService.saveNewCanvasVideo(asset.uri, `${Date.now()}`);
                  setIsUploading(false);
                  await applyVideoUri(newUri);
                } catch (e) {
                  setIsUploading(false);
                  console.error('[CanvasManagerSheet] Error forzando subida:', e);
                }
              },
            },
          ]
        );
      } else {
        const newUri = await MediaAssetService.saveNewCanvasVideo(asset.uri, dupCheck.md5);
        setIsUploading(false);
        await applyVideoUri(newUri);
      }
    } catch (error) {
      setIsUploading(false);
      console.error('[CanvasManagerSheet] Error al subir vídeo:', error);
      Alert.alert(t('actions.error') || 'Error', t('actions.canvas_error') || 'Hubo un error al seleccionar el vídeo.');
    }
  };

  const rowCount = Math.ceil(videos.length / 3);
  const totalContentHeight = rowCount * (itemHeight + 8) + 24;
  const listHeight = Math.min(totalContentHeight, SCREEN_HEIGHT * 0.58);

  const keyExtractor = useCallback((item: CanvasVideoItem) => item.uri, []);

  const renderItem = useCallback(
    ({ item, index }: { item: CanvasVideoItem; index: number }) => {
      const rem = index % 3;
      let alignItems: 'flex-start' | 'center' | 'flex-end' = 'flex-end';
      if (rem === 0) alignItems = 'flex-start';
      else if (rem === 1) alignItems = 'center';

      return (
        <View style={{ width: '100%', alignItems, marginBottom: 8 }}>
          <CanvasGridItem
            item={item}
            isAssigned={assignedUris.has(item.uri)}
            itemWidth={itemWidth}
            itemHeight={itemHeight}
            onPress={handleSelectVideo}
            onLongPress={handleLongPressVideo}
            colors={colors}
            fonts={fonts}
            styles={styles}
          />
        </View>
      );
    },
    [assignedUris, itemWidth, itemHeight, handleSelectVideo, handleLongPressVideo, colors, fonts, styles]
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('canvas.manager_title') || 'Vídeos subidos'}</Text>
        <Text style={styles.headerSubtitle} numberOfLines={1}>
          {subtitleText}
        </Text>
      </View>

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.uploadButton, { backgroundColor: colors.accent }]}
          onPress={handleUploadNew}
          activeOpacity={0.8}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color={colors.onAccent} />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={20} color={colors.onAccent} />
              <Text style={[styles.uploadButtonText, { color: colors.onAccent, fontFamily: fonts.regular }]}>
                {t('canvas.upload_new') || 'Subir nuevo vídeo'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Grid Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : videos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.cardBackground || '#1E1E1E' }]}>
            <Ionicons name="videocam-outline" size={40} color={colors.textSecondary || '#777'} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: fonts.regular }]}>
            {t('canvas.empty_title') || 'No hay vídeos subidos'}
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {t('canvas.empty_desc') || 'Sube un vídeo de fondo para poder asignarlo a tus canciones y reutilizarlo cuando quieras.'}
          </Text>
        </View>
      ) : (
        <View style={[styles.listContainer, { height: listHeight }]}>
          <FlashList
            data={videos}
            keyExtractor={keyExtractor}
            numColumns={3}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={renderItem}
          />
        </View>
      )}
    </View>
  );
}

const getStyles = (colors: any, fonts: any, layout: any) =>
  StyleSheet.create({
    container: {
      width: '100%',
      flexShrink: 1,
    },
    header: {
      marginBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBackground || '#282828',
      paddingBottom: 12,
    },
    headerTitle: {
      color: colors.accent,
      fontSize: 13,
      fontFamily: fonts.regular,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    headerSubtitle: {
      color: colors.text,
      fontSize: 18,
      fontFamily: fonts.regular,
      fontWeight: '800',
      marginTop: 4,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 16,
    },
    uploadButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      paddingVertical: 12,
      gap: 8,
    },
    uploadButtonText: {
      fontWeight: '800',
      fontSize: 14,
    },
    listContent: {
      paddingBottom: 24,
    },
    gridItem: {
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: '#1A1A1A',
      position: 'relative',
    },
    assignedBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      borderRadius: 12,
      padding: 2,
    },
    itemGradient: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 40,
      justifyContent: 'flex-end',
      paddingHorizontal: 6,
      paddingBottom: 6,
    },
    itemFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    itemSizeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '600',
    },
    centerContainer: {
      paddingVertical: 60,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
      paddingHorizontal: 20,
    },
    emptyIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 6,
      textAlign: 'center',
    },
    emptyDesc: {
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
      lineHeight: 18,
    },
    placeholderContainer: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#1E1E1E',
    },
    listContainer: {
      width: '100%',
      overflow: 'hidden',
    },
  });
