import { Ionicons } from '@expo/vector-icons';
import { ScreenHeaderLayout } from '@/components/layouts/ScreenHeaderLayout';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { formatBytes, StorageBreakdown, StorageService } from '../../services/StorageService';
import { useToastStore } from '../../store/useToastStore';
import { useAppTheme } from '../../hooks/useAppTheme';

export default function SettingsStorageScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  const [loading, setLoading] = useState(true);
  const [clearingItem, setClearingItem] = useState<string | null>(null);
  const [data, setData] = useState<StorageBreakdown | null>(null);

  const loadData = async (isInitial: boolean = false) => {
    if (isInitial && !data) setLoading(true);
    try {
      const result = await StorageService.getStorageBreakdown();
      setData({ ...result });
    } catch (e) {
      console.error('[SettingsStorageScreen] Error loading storage stats:', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData(true);
    }, [])
  );

  const handleClearCache = async () => {
    if (clearingItem) return;
    setClearingItem('cache');
    try {
      await StorageService.clearCache();
      useToastStore.getState().showToast(t('settings.cache_cleared', 'Caché liberada correctamente'));
    } catch (e) {
      console.error('[SettingsStorageScreen] Error clearing cache:', e);
    } finally {
      setClearingItem(null);
      navigation.goBack();
    }
  };

  const handleConfirmDelete = (
    itemKey: 'artists' | 'playlists' | 'cd' | 'canvas',
    title: string,
    message: string,
    deleteFn: () => Promise<void>,
    successMsg: string
  ) => {
    Alert.alert(
      title,
      message,
      [
        { text: t('common.cancel', 'Cancelar'), style: 'cancel' },
        {
          text: t('common.delete', 'Eliminar'),
          style: 'destructive',
          onPress: async () => {
            setClearingItem(itemKey);
            try {
              await deleteFn();
              useToastStore.getState().showToast(successMsg);
            } catch (e) {
              console.error('[SettingsStorageScreen] Error deleting item:', e);
            } finally {
              setClearingItem(null);
              navigation.goBack();
            }
          }
        }
      ]
    );
  };

  const mmplayerRatio = data && data.deviceTotalBytes > 0 ? (data.mmplayerTotalBytes / data.deviceTotalBytes) * 100 : 0;
  const otherRatio = data && data.deviceTotalBytes > 0 ? (Math.max(0, data.deviceUsedBytes - data.mmplayerTotalBytes) / data.deviceTotalBytes) * 100 : 0;
  const otherFilesBytes = data ? Math.max(0, data.deviceUsedBytes - data.mmplayerTotalBytes) : 0;

  return (
    <ScreenHeaderLayout title={t('settings.storage_title', 'Almacenamiento')}>
      {({ headerHeight, bottomPadding }) => (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: headerHeight + 10,
              paddingBottom: bottomPadding + 30
            }
          ]}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.loadingText}>
                {t('common.loading', 'Calculando espacio de almacenamiento...')}
              </Text>
            </View>
          ) : data ? (
            <>
              {/* --- TARJETA 1: ALMACENAMIENTO DEL DISPOSITIVO --- */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="hardware-chip-outline" size={22} color={colors.accent} />
                  <Text style={styles.cardTitle}>{t('settings.device_storage', 'Almacenamiento del móvil')}</Text>
                </View>

                <View style={styles.storageTextRow}>
                  <Text style={styles.usedText}>
                    {formatBytes(data.deviceUsedBytes)}
                  </Text>
                  <Text style={styles.totalText}>
                    / {formatBytes(data.deviceTotalBytes)}
                  </Text>
                </View>
                <Text style={styles.subtext}>
                  {formatBytes(data.deviceFreeBytes)} {t('settings.free_space', 'disponibles')}
                </Text>

                {/* BARRA SEGMENTADA */}
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressSegment, { width: `${Math.max(1, mmplayerRatio)}%`, backgroundColor: '#EC4899' }]} />
                  <View style={[styles.progressSegment, { width: `${Math.max(1, otherRatio)}%`, backgroundColor: '#6B7280' }]} />
                </View>

                {/* LEYENDA */}
                <View style={styles.legendContainer}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#EC4899' }]} />
                    <Text style={styles.legendLabel}>{t('settings.mmplayer_storage', 'Peso de MMPlayer')}</Text>
                    <Text style={styles.legendValue}>{formatBytes(data.mmplayerTotalBytes)}</Text>
                  </View>

                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#6B7280' }]} />
                    <Text style={styles.legendLabel}>{t('settings.other_files', 'Otros archivos')}</Text>
                    <Text style={styles.legendValue}>{formatBytes(otherFilesBytes)}</Text>
                  </View>

                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#1F2937' }]} />
                    <Text style={styles.legendLabel}>{t('settings.free_space', 'Espacio libre')}</Text>
                    <Text style={styles.legendValue}>{formatBytes(data.deviceFreeBytes)}</Text>
                  </View>
                </View>
              </View>

              {/* --- TARJETA 2: DESGLOSE DE MMPLAYER --- */}
              <View style={styles.card}>
                <View style={styles.cardHeaderBetween}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name="musical-notes-outline" size={22} color="#EC4899" />
                    <Text style={styles.cardTitle}>{t('settings.mmplayer_storage', 'Peso de MMPlayer')}</Text>
                  </View>
                  <Text style={styles.totalMMPlayerValue}>{formatBytes(data.mmplayerTotalBytes)}</Text>
                </View>

                <View style={styles.breakdownList}>
                  {/* 1. Imágenes de Artistas */}
                  <View style={styles.breakdownRow}>
                    <View style={styles.breakdownLeft}>
                      <View style={[styles.itemIconBg, { backgroundColor: colors.accentAlpha15 }]}>
                        <Ionicons name="person-outline" size={18} color={colors.accent} />
                      </View>
                      <Text style={styles.itemTitle}>{t('settings.custom_artist_images', 'Imágenes de artistas personalizadas')}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={styles.itemValue}>{formatBytes(data.artistImagesBytes)}</Text>
                      <TouchableOpacity
                        style={styles.clearBtn}
                        onPress={() => handleConfirmDelete(
                          'artists',
                          t('settings.delete_artist_images_title', '¿Eliminar imágenes de artistas?'),
                          t('settings.delete_artist_images_msg', 'Se eliminarán las fotos personalizadas de todos los artistas y se restablecerán a la imagen predeterminada.'),
                          StorageService.clearAllArtistImages,
                          t('settings.artist_images_deleted', 'Imágenes de artistas eliminadas')
                        )}
                        disabled={clearingItem !== null}
                        activeOpacity={0.7}
                      >
                        {clearingItem === 'artists' ? (
                          <ActivityIndicator size="small" color="#EF4444" />
                        ) : (
                          <Text style={styles.clearBtnText}>{t('common.delete', 'Eliminar')}</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.separator} />

                  {/* 2. Imágenes de Playlists */}
                  <View style={styles.breakdownRow}>
                    <View style={styles.breakdownLeft}>
                      <View style={[styles.itemIconBg, { backgroundColor: 'rgba(236, 72, 153, 0.15)' }]}>
                        <Ionicons name="albums-outline" size={18} color="#EC4899" />
                      </View>
                      <Text style={styles.itemTitle}>{t('settings.custom_playlist_images', 'Imágenes de Playlists personalizadas')}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={styles.itemValue}>{formatBytes(data.playlistCoversBytes)}</Text>
                      <TouchableOpacity
                        style={styles.clearBtn}
                        onPress={() => handleConfirmDelete(
                          'playlists',
                          t('settings.delete_playlist_covers_title', '¿Eliminar portadas de playlists?'),
                          t('settings.delete_playlist_covers_msg', 'Se eliminarán las portadas personalizadas de todas las playlists.'),
                          StorageService.clearAllPlaylistCovers,
                          t('settings.playlist_covers_deleted', 'Portadas de playlists eliminadas')
                        )}
                        disabled={clearingItem !== null}
                        activeOpacity={0.7}
                      >
                        {clearingItem === 'playlists' ? (
                          <ActivityIndicator size="small" color="#EF4444" />
                        ) : (
                          <Text style={styles.clearBtnText}>{t('common.delete', 'Eliminar')}</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.separator} />

                  {/* 3. Imágenes de CD */}
                  <View style={styles.breakdownRow}>
                    <View style={styles.breakdownLeft}>
                      <View style={[styles.itemIconBg, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                        <Ionicons name="disc-outline" size={18} color="#F59E0B" />
                      </View>
                      <Text style={styles.itemTitle}>{t('settings.custom_cd_images', 'Imágenes de CD personalizadas')}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={styles.itemValue}>{formatBytes(data.cdCoversBytes)}</Text>
                      <TouchableOpacity
                        style={styles.clearBtn}
                        onPress={() => handleConfirmDelete(
                          'cd',
                          t('settings.delete_cd_covers_title', '¿Eliminar diseños de CD?'),
                          t('settings.delete_cd_covers_msg', 'Se eliminarán los diseños de CD personalizados de todos los álbumes.'),
                          StorageService.clearAllCDCovers,
                          t('settings.cd_covers_deleted', 'Diseños de CD eliminados')
                        )}
                        disabled={clearingItem !== null}
                        activeOpacity={0.7}
                      >
                        {clearingItem === 'cd' ? (
                          <ActivityIndicator size="small" color="#EF4444" />
                        ) : (
                          <Text style={styles.clearBtnText}>{t('common.delete', 'Eliminar')}</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.separator} />

                  {/* 4. Videos Canva */}
                  <View style={styles.breakdownRow}>
                    <View style={styles.breakdownLeft}>
                      <View style={[styles.itemIconBg, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                        <Ionicons name="videocam-outline" size={18} color="#10B981" />
                      </View>
                      <Text style={styles.itemTitle}>{t('settings.custom_canva_videos', 'Videos Canva personalizados')}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={styles.itemValue}>{formatBytes(data.canvasVideosBytes)}</Text>
                      <TouchableOpacity
                        style={styles.clearBtn}
                        onPress={() => handleConfirmDelete(
                          'canvas',
                          t('settings.delete_canvas_videos_title', '¿Eliminar vídeos Canva?'),
                          t('settings.delete_canvas_videos_msg', 'Se eliminarán todos los vídeos de fondo Canva asociados a las canciones.'),
                          StorageService.clearAllCanvasVideos,
                          t('settings.canvas_videos_deleted', 'Vídeos Canva eliminados')
                        )}
                        disabled={clearingItem !== null}
                        activeOpacity={0.7}
                      >
                        {clearingItem === 'canvas' ? (
                          <ActivityIndicator size="small" color="#EF4444" />
                        ) : (
                          <Text style={styles.clearBtnText}>{t('common.delete', 'Eliminar')}</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.separator} />

                  {/* 5. Lyrics */}
                  <View style={styles.breakdownRow}>
                    <View style={styles.breakdownLeft}>
                      <View style={[styles.itemIconBg, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                        <Ionicons name="document-text-outline" size={18} color="#3B82F6" />
                      </View>
                      <Text style={styles.itemTitle}>{t('settings.lyrics_storage', 'Lyrics')}</Text>
                    </View>
                    <Text style={styles.itemValue}>{formatBytes(data.lyricsBytes)}</Text>
                  </View>
                  <View style={styles.separator} />

                  {/* 6. Caché */}
                  <View style={styles.breakdownRow}>
                    <View style={styles.breakdownLeft}>
                      <View style={[styles.itemIconBg, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                        <Ionicons name="trash-bin-outline" size={18} color="#EF4444" />
                      </View>
                      <Text style={styles.itemTitle}>{t('settings.cache_storage', 'Caché')}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={styles.itemValue}>{formatBytes(data.cacheBytes)}</Text>
                      <TouchableOpacity
                        style={styles.clearBtn}
                        onPress={handleClearCache}
                        disabled={clearingItem !== null}
                        activeOpacity={0.7}
                      >
                        {clearingItem === 'cache' ? (
                          <ActivityIndicator size="small" color="#EF4444" />
                        ) : (
                          <Text style={styles.clearBtnText}>{t('settings.clear_cache', 'Limpiar')}</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            </>
          ) : null}
        </ScrollView>
      )}
    </ScreenHeaderLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#E5E7EB',
    marginTop: 14,
    fontSize: 14,
    fontFamily: 'Montserrat',
    fontWeight: '700',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  cardHeaderBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  storageTextRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  usedText: {
    fontSize: 28,
    fontFamily: 'Montserrat',
    fontWeight: '900',
    color: '#FFFFFF',
  },
  totalText: {
    fontSize: 16,
    fontFamily: 'Montserrat',
    fontWeight: '800',
    color: '#CCCCCC',
  },
  totalMMPlayerValue: {
    fontSize: 18,
    fontFamily: 'Montserrat',
    fontWeight: '800',
    color: '#EC4899',
  },
  subtext: {
    fontSize: 13,
    fontFamily: 'Montserrat',
    fontWeight: '700',
    color: '#CCCCCC',
    marginTop: 2,
    marginBottom: 16,
  },
  progressBarBg: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1F2937',
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressSegment: {
    height: '100%',
  },
  legendContainer: {
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  legendLabel: {
    flex: 1,
    color: '#F3F4F6',
    fontSize: 13,
    fontFamily: 'Montserrat',
    fontWeight: '700',
  },
  legendValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Montserrat',
    fontWeight: '800',
  },
  breakdownList: {
    marginTop: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 10,
  },
  itemIconBg: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    color: '#F3F4F6',
    fontSize: 14,
    fontFamily: 'Montserrat',
    fontWeight: '700',
    flex: 1,
  },
  itemValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Montserrat',
    fontWeight: '800',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  clearBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  clearBtnText: {
    color: '#EF4444',
    fontSize: 11,
    fontFamily: 'Montserrat',
    fontWeight: '700',
  },
});
