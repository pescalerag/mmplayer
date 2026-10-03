import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FlashList } from '@shopify/flash-list';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Q } from '@nozbe/watermelondb';
import withObservables from '@nozbe/with-observables';
import { useAppTheme } from '../../hooks/useAppTheme';
import { Layout } from '../../theme/theme';
import { database } from '../../database';
import { NotificationService } from '../../services/NotificationService';
import { openNotificationSettings } from '../../store/useUIStore';
import AppNotification from '../../database/models/AppNotification';
import NotificationCard from '../../components/notifications/NotificationCard';
import { HistoryService } from '../../services/HistoryService';

interface NotificationsScreenProps {
  notifications: AppNotification[];
}

function NotificationsScreenContent({ notifications }: Readonly<NotificationsScreenProps>) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, fonts } = useAppTheme();
  const { t } = useTranslation();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(100);

  // Auto-mark library notifications as read and check summaries on focus
  useFocusEffect(
    useCallback(() => {
      NotificationService.setScreenActive(true);
      NotificationService.markLibraryNotificationsAsRead().catch(() => {});
      NotificationService.checkAndGenerateSummaries().catch(() => {});

      return () => {
        NotificationService.setScreenActive(false);
      };
    }, [])
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await NotificationService.checkAndGenerateSummaries();
      await NotificationService.markLibraryNotificationsAsRead();
    } catch (e) {
      console.error('[NotificationsScreen] Error refreshing:', e);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const handleMarkAllAsRead = useCallback(() => {
    Alert.alert(
      t('notifications.mark_all_read_title') || 'Marcar todo como leído',
      t('notifications.mark_all_read_confirm') || '¿Deseas marcar todas las notificaciones como leídas?',
      [
        { text: t('common.cancel') || 'Cancelar', style: 'cancel' },
        {
          text: t('common.confirm') || 'Confirmar',
          onPress: async () => {
            await NotificationService.markAllAsRead();
          },
        },
      ]
    );
  }, [t]);

  const handleClearAll = useCallback(() => {
    Alert.alert(
      t('notifications.clear_all_title') || 'Borrar notificaciones',
      t('notifications.clear_all_confirm') || '¿Estás seguro de que deseas eliminar todas las notificaciones?',
      [
        { text: t('common.cancel') || 'Cancelar', style: 'cancel' },
        {
          text: t('common.delete') || 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await NotificationService.clearAllNotifications();
          },
        },
      ]
    );
  }, [t]);

  const handleDeleteNotification = useCallback(async (id: string) => {
    try {
      await NotificationService.deleteNotification(id);
    } catch (e) {
      console.error('[NotificationsScreen] Error deleting notification:', e);
    }
  }, []);

  const handleNotificationPress = useCallback(
    async (item: AppNotification) => {
      await NotificationService.markAsRead(item.id);

      if (item.actionType === 'navigate_library') {
        const tabNav = navigation.getParent();
        if (tabNav?.navigate) {
          tabNav.navigate('Biblioteca');
        } else {
          navigation.navigate('Biblioteca' as any);
        }
        return;
      }

      if (item.actionType?.startsWith('navigate_stats')) {
        await handleStatsNavigation(item, navigation);
        return;
      }

      if (item.actionType === 'open_url') {
        try {
          const payload = item.actionPayload ? JSON.parse(item.actionPayload) : null;
          const url = payload?.url || 'https://play.google.com/store/apps/details?id=com.pescalerag.mmplayer';
          await Linking.openURL(url);
        } catch (e) {
          console.error('[NotificationsScreen] Error opening url:', e);
        }
      }
    },
    [navigation]
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* 1. HEADER SMOKE GRADIENT (BASE DE FONDO) */}
      <LinearGradient
        colors={[
          colors.background,
          'rgba(0, 0, 0, 0.95)',
          'rgba(0, 0, 0, 0.8)',
          'transparent',
        ]}
        locations={[0, 0.45, 0.8, 1]}
        style={[styles.headerSmoke, { height: headerHeight + 30 }]}
        pointerEvents="none"
      />

      {/* 2. CAPA DE ILUMINACIÓN MORADA (SOBRE EL HUMO, DETRÁS DEL HEADER) */}
      <LinearGradient
        colors={[colors.accentAlpha20, 'transparent']}
        style={styles.purpleGlow}
        pointerEvents="none"
      />

      {/* 3. HEADER BAR (INTERFAZ) */}
      <View
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          activeOpacity={0.7}
          accessibilityLabel={t('common.back') || 'Atrás'}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.text, fontFamily: fonts.bold }]}>
          {t('notifications.title') || 'Notificaciones'}
        </Text>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={openNotificationSettings}
            style={styles.headerButton}
            activeOpacity={0.7}
            accessibilityLabel={t('notifications.settings_button') || 'Ajustes de notificaciones'}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="settings-outline" size={20} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleMarkAllAsRead}
            style={styles.headerButton}
            activeOpacity={0.7}
            accessibilityLabel={t('notifications.mark_all_read') || 'Marcar todo como leído'}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="mail-open-outline" size={20} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleClearAll}
            style={styles.headerButton}
            activeOpacity={0.7}
            accessibilityLabel={t('notifications.clear_all') || 'Borrar notificaciones'}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="trash-outline" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* LIST OF NOTIFICATIONS */}
      <FlashList
        data={notifications}
        keyExtractor={(item) => item.id}
        extraData={notifications}
        renderItem={({ item }) => (
          <NotificationCard
            notification={item}
            onPress={handleNotificationPress}
            onDelete={handleDeleteNotification}
          />
        )}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + 28,
            paddingBottom:
              Layout.MINI_PLAYER_HEIGHT +
              Layout.TAB_BAR_HEIGHT +
              Layout.PLAYER_MARGIN +
              insets.bottom +
              20,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressViewOffset={headerHeight + 10}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.accentAlpha10 }]}>
              <Ionicons name="notifications-off-outline" size={40} color={colors.accent} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: fonts.bold }]}>
              {t('notifications.empty_title') || 'No hay notificaciones'}
            </Text>
            <Text
              style={[
                styles.emptySubtitle,
                { color: colors.textSecondary, fontFamily: fonts.regular },
              ]}
            >
              {t('notifications.empty_subtitle') ||
                'Aquí recibirás resúmenes de tu actividad, novedades y cambios en tu biblioteca.'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const ObservableNotificationsScreen = withObservables([], () => ({
  notifications: database
    .get<AppNotification>('notifications')
    .query(Q.sortBy('created_at', Q.desc))
    .observeWithColumns(['is_read']),
}))(NotificationsScreenContent);

export default function NotificationsScreen() {
  return <ObservableNotificationsScreen />;
}

async function handleStatsNavigation(item: AppNotification, navigation: any) {
  try {
    const payload = item.actionPayload ? JSON.parse(item.actionPayload) : null;
    if (!payload?.from || !payload?.to) {
      const tabNav = navigation.getParent();
      if (tabNav?.navigate) {
        tabNav.navigate('Actividad');
      } else {
        navigation.navigate('WeeklyActivity');
      }
      return;
    }

    const fromDate = new Date(payload.from);
    const toDate = new Date(payload.to);
    const period = payload.period || 'week';

    const detailedStats = await HistoryService.getDetailedStatsForPeriod(
      period,
      'duration',
      fromDate,
      toDate
    );

    const shareParams = {
      formattedPeriodText: payload.label || '',
      metric: 'duration' as const,
      totalHours: detailedStats.totalHours,
      totalPlays: detailedStats.totalPlays,
      topArtists: detailedStats.topArtists,
      topSongs: detailedStats.topSongs,
    };

    // Navegar en el RootStack para que se presente por encima de todo (incluyendo tabs y MiniPlayer)
    const rootNav = navigation.getParent()?.getParent() || navigation.getParent() || navigation;
    if (rootNav?.navigate) {
      rootNav.navigate('ShareStats', shareParams);
    } else {
      navigation.navigate('ShareStats', shareParams);
    }
  } catch (err) {
    console.error('[NotificationsScreen] Error navigating to stats:', err);
    const tabNav = navigation.getParent();
    if (tabNav?.navigate) {
      tabNav.navigate('Actividad');
    } else {
      navigation.navigate('WeeklyActivity');
    }
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerSmoke: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  purpleGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    zIndex: 2,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    flex: 1,
    marginLeft: 14,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 0,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingTop: 80,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
