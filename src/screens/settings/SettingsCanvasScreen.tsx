import { ScreenHeaderLayout } from '@/components/layouts/ScreenHeaderLayout';
import { useAppTheme } from '@/hooks/useAppTheme';
import { CanvasVideoItem, MediaAssetService } from '@/services/MediaAssetService';
import { formatBytes } from '@/services/StorageService';
import { useToastStore } from '@/store/useToastStore';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Animated from 'react-native-reanimated';
import { getRowFadeIn } from '@/utils/cascadeAnimations';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CanvasGridItemProps {
  readonly item: CanvasVideoItem;
  readonly itemWidth: number;
  readonly itemHeight: number;
  readonly onDeletePress: (item: CanvasVideoItem) => void;
  readonly colors: any;
  readonly fonts: any;
  readonly styles: any;
}

const CanvasGridItem = memo(function CanvasGridItem({
  item,
  itemWidth,
  itemHeight,
  onDeletePress,
  colors,
  fonts,
  styles,
}: CanvasGridItemProps) {
  const handleDelete = useCallback(() => {
    onDeletePress(item);
  }, [onDeletePress, item]);

  return (
    <View
      style={[
        styles.gridItem,
        {
          width: itemWidth,
          height: itemHeight,
          borderColor: colors.cardBackground || '#2A2A2A',
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

      {/* Botón de papelera para eliminar individualmente */}
      <TouchableOpacity
        style={styles.deleteBadge}
        onPress={handleDelete}
        activeOpacity={0.75}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="trash-outline" size={15} color="#EF4444" />
      </TouchableOpacity>

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
    </View>
  );
});

interface CanvasEmptyViewProps {
  readonly colors: any;
  readonly fonts: any;
  readonly styles: any;
  readonly title: string;
  readonly desc: string;
}

const CanvasEmptyView = memo(function CanvasEmptyView({
  colors,
  fonts,
  styles,
  title,
  desc,
}: CanvasEmptyViewProps) {
  return (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIconCircle, { backgroundColor: colors.cardBackground || '#1E1E1E' }]}>
        <Ionicons name="videocam-outline" size={40} color={colors.textSecondary || '#777'} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: fonts.regular }]}>
        {title}
      </Text>
      <Text style={[styles.emptyDesc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
        {desc}
      </Text>
    </View>
  );
});

export default function SettingsCanvasScreen() {
  const { colors, fonts, layout } = useAppTheme();
  const styles = useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
  const { t } = useTranslation();

  const [videos, setVideos] = useState<CanvasVideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const loadVideos = useCallback(async () => {
    try {
      setLoading(true);
      const list = await MediaAssetService.getAllUploadedCanvasVideos();
      setVideos(list);
    } catch (e) {
      console.error('[SettingsCanvasScreen] Error cargando vídeos:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVideos();
  }, [loadVideos]);

  // Dimensiones del grid de 3 columnas
  const availableWidth = SCREEN_WIDTH - 40;
  const itemWidth = Math.floor((availableWidth - 16) / 3);
  const itemHeight = Math.floor(itemWidth * 1.45);

  const handleDeleteVideo = useCallback(
    (item: CanvasVideoItem) => {
      Alert.alert(
        t('canvas.delete_title', 'Eliminar vídeo'),
        t(
          'canvas.delete_msg',
          '¿Estás seguro de que deseas eliminar este vídeo de la aplicación? Las canciones que lo usen dejarán de tener vídeo de fondo.'
        ),
        [
          { text: t('common.cancel', 'Cancelar'), style: 'cancel' },
          {
            text: t('common.delete', 'Eliminar'),
            style: 'destructive',
            onPress: async () => {
              try {
                await MediaAssetService.deleteCanvasVideo(item.uri);
                useToastStore
                  .getState()
                  .showToast(t('actions.canvas_removed', 'Vídeo de fondo eliminado'), 'trash');
                await loadVideos();
              } catch (e) {
                console.error('[SettingsCanvasScreen] Error borrando vídeo:', e);
              }
            },
          },
        ]
      );
    },
    [t, loadVideos]
  );

  const handleUploadVideos = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'video/*',
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      setIsUploading(true);
      const results = await Promise.allSettled(
        result.assets.map((asset) => MediaAssetService.saveNewCanvasVideo(asset.uri))
      );

      let uploadedCount = 0;
      for (const res of results) {
        if (res.status === 'fulfilled') {
          uploadedCount++;
        } else {
          console.error('[SettingsCanvasScreen] Error subiendo vídeo:', res.reason);
        }
      }

      setIsUploading(false);

      if (uploadedCount > 0) {
        const toastMessage =
          uploadedCount === 1
            ? t('canvas.video_uploaded_single', 'Vídeo subido correctamente')
            : t('canvas.videos_uploaded_plural', {
              count: uploadedCount,
              defaultValue: `Se han subido ${uploadedCount} vídeos correctamente`,
            });
        useToastStore.getState().showToast(toastMessage, 'videocam');
        await loadVideos();
      }
    } catch (error) {
      setIsUploading(false);
      console.error('[SettingsCanvasScreen] Error en handleUploadVideos:', error);
      Alert.alert(t('common.error', 'Error'), t('actions.canvas_error', 'Hubo un error al seleccionar los vídeos.'));
    }
  };

  const keyExtractor = useCallback((item: CanvasVideoItem) => item.uri, []);

  const renderItem = useCallback(
    ({ item, index }: { item: CanvasVideoItem; index: number }) => {
      const rem = index % 3;
      let alignItems: 'flex-start' | 'center' | 'flex-end' = 'flex-end';
      if (rem === 0) alignItems = 'flex-start';
      else if (rem === 1) alignItems = 'center';

      return (
        <Animated.View
          entering={getRowFadeIn(index, 3)}
          style={{ width: '100%', alignItems, marginBottom: 8 }}
        >
          <CanvasGridItem
            item={item}
            itemWidth={itemWidth}
            itemHeight={itemHeight}
            onDeletePress={handleDeleteVideo}
            colors={colors}
            fonts={fonts}
            styles={styles}
          />
        </Animated.View>
      );
    },
    [itemWidth, itemHeight, handleDeleteVideo, colors, fonts, styles]
  );

  const renderHeader = () => (
    <View style={styles.topSection}>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {t(
          'canvas.manage_canvas_subtitle',
          'Administra o elimina los vídeos de fondo subidos a la aplicación'
        )}
      </Text>

      <TouchableOpacity
        style={[styles.uploadButton, { backgroundColor: colors.accent }]}
        onPress={handleUploadVideos}
        activeOpacity={0.8}
        disabled={isUploading}
      >
        {isUploading ? (
          <>
            <ActivityIndicator size="small" color={colors.onAccent || '#FFFFFF'} />
            <Text style={[styles.uploadButtonText, { color: colors.onAccent || '#FFFFFF', fontFamily: fonts.regular }]}>
              {t('canvas.uploading_videos', 'Subiendo vídeos...')}
            </Text>
          </>
        ) : (
          <>
            <Ionicons name="cloud-upload-outline" size={20} color={colors.onAccent || '#FFFFFF'} />
            <Text style={[styles.uploadButtonText, { color: colors.onAccent || '#FFFFFF', fontFamily: fonts.regular }]}>
              {t('canvas.upload_videos', 'Subir vídeos')}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <ScreenHeaderLayout title={t('settings.custom_canva_videos', 'Videos Canva personalizados')}>
      {({ headerHeight, bottomPadding }) => {
        if (loading) {
          return (
            <View style={[styles.centerContainer, { paddingTop: headerHeight + 10, paddingBottom: bottomPadding }]}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          );
        }

        return (
          <View style={styles.container}>
            <FlashList
              data={videos}
              keyExtractor={keyExtractor}
              numColumns={3}
              contentContainerStyle={[
                styles.listContent,
                {
                  paddingTop: headerHeight + 10,
                  paddingBottom: bottomPadding + 20,
                },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              renderItem={renderItem}
              ListHeaderComponent={renderHeader}
              ListEmptyComponent={
                <CanvasEmptyView
                  colors={colors}
                  fonts={fonts}
                  styles={styles}
                  title={t('canvas.empty_title', 'No hay vídeos subidos')}
                  desc={t(
                    'canvas.empty_desc',
                    'Sube un vídeo de fondo para poder asignarlo a tus canciones y reutilizarlo cuando quieras.'
                  )}
                />
              }
            />
          </View>
        );
      }}
    </ScreenHeaderLayout>
  );
}

const getStyles = (colors: any, fonts: any, _layout: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    topSection: {
      marginBottom: 16,
    },
    subtitle: {
      fontSize: 13,
      fontFamily: fonts.regular,
      fontWeight: '600',
      lineHeight: 18,
      marginBottom: 14,
    },
    uploadButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      paddingVertical: 13,
      paddingHorizontal: 16,
      gap: 8,
    },
    uploadButtonText: {
      fontWeight: '800',
      fontSize: 14,
    },
    listContent: {
      paddingHorizontal: 20,
    },
    gridItem: {
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: '#1A1A1A',
      position: 'relative',
      borderWidth: 1,
    },
    placeholderContainer: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
    },
    deleteBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      borderRadius: 14,
      width: 28,
      height: 28,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.4)',
      zIndex: 10,
    },
    itemGradient: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 38,
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
      color: 'rgba(255, 255, 255, 0.85)',
      fontSize: 10,
      fontWeight: '700',
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingBottom: 40,
    },
    emptyIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      justifyContent: 'center',
      alignItems: 'center',
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
      textAlign: 'center',
      lineHeight: 18,
    },
  });
