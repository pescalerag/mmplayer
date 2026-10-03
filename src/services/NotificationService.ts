import { Linking } from 'react-native';
import Constants from 'expo-constants';
import { database } from '../database';
import AppNotification, { NotificationType } from '../database/models/AppNotification';
import { navigationRef, waitForNavigationReady } from '../navigation/navigationRef';
import { Q } from '@nozbe/watermelondb';
import i18n from '../constants/i18n';
import { HistoryService } from './HistoryService';
import { useSettingsStore } from '../store/useSettingsStore';
import { useNotificationStore } from '../store/useNotificationStore';
import {
  PeriodRange,
  getPreviousWeekRange,
  getPreviousMonthRange,
  getPreviousYearRange,
  isNewerVersion,
} from '../utils/notificationHelpers';

const REMOTE_UPDATE_URL = 'https://pescalerag.github.io/mmplayer-hall-of-fame/update.json';
const FALLBACK_UPDATE_URL = 'https://raw.githubusercontent.com/pescalerag/mmplayer-hall-of-fame/main/update.json';
const FETCH_TIMEOUT_MS = 5000;
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.pescalerag.mmplayer';

export interface CreateNotificationParams {
  id?: string;
  type: NotificationType;
  title: string;
  description?: string;
  actionType?: string;
  actionPayload?: string;
  createdAt?: Date;
  isRead?: boolean;
}

class NotificationServiceImpl {
  public isNotificationsScreenActive = false;

  public setScreenActive(active: boolean) {
    this.isNotificationsScreenActive = active;
  }

  private get collection() {
    return database.get<AppNotification>('notifications');
  }

  public async getNotifications(): Promise<AppNotification[]> {
    try {
      return await this.collection.query(Q.sortBy('created_at', Q.desc)).fetch();
    } catch (e) {
      console.error('[NotificationService] Error fetching notifications:', e);
      return [];
    }
  }

  public async getUnreadCount(): Promise<number> {
    try {
      const count = await this.collection.query(Q.where('is_read', false)).fetchCount();
      useNotificationStore.getState().setUnreadCount(count);
      return count;
    } catch (e) {
      console.error('[NotificationService] Error counting unread notifications:', e);
      return 0;
    }
  }

  public async exists(id: string): Promise<boolean> {
    try {
      const record = await this.collection.find(id);
      return Boolean(record);
    } catch {
      return false;
    }
  }

  public isNotificationTypeEnabled(type: NotificationType): boolean {
    try {
      const prefs = useSettingsStore.getState().notificationPreferences;
      if (!prefs) return true;
      return prefs[type] ?? true;
    } catch {
      return true;
    }
  }

  public async createNotification(params: CreateNotificationParams): Promise<AppNotification | null> {
    try {
      if (!this.isNotificationTypeEnabled(params.type)) {
        return null;
      }

      if (params.id && (await this.exists(params.id))) {
        return null;
      }

      let createdNotification: AppNotification | null = null;
      await database.write(async () => {
        createdNotification = await this.collection.create((notif) => {
          if (params.id) {
            notif._raw.id = params.id;
          }
          notif.type = params.type;
          notif.title = params.title;
          notif.description = params.description || null;
          const createdDate = params.createdAt || new Date();
          notif.createdAt = createdDate;
          (notif._raw as any).created_at = createdDate.getTime();
          notif.isRead = params.isRead ?? false;
          notif.actionType = params.actionType || null;
          notif.actionPayload = params.actionPayload || null;
        });
      });

      await this.getUnreadCount();

      return createdNotification;
    } catch (e) {
      console.error('[NotificationService] Error creating notification:', e);
      return null;
    }
  }

  // --- LIBRARY NOTIFICATIONS ---

  public async addSongsAddedNotification(count: number): Promise<void> {
    if (count <= 0) return;
    const title = count === 1
      ? i18n.t('notifications.songs_added_singular') || 'Se ha añadido 1 canción a tu biblioteca.'
      : i18n.t('notifications.songs_added_plural', { count }) || `Se han añadido ${count} canciones a tu biblioteca.`;

    await this.createNotification({
      type: 'songs_added',
      title,
      actionType: 'navigate_library',
      isRead: this.isNotificationsScreenActive,
    });
  }

  public async addSongsMovedNotification(count: number): Promise<void> {
    if (count <= 0) return;
    const title = count === 1
      ? i18n.t('notifications.songs_moved_singular') || 'Se ha reubicado 1 canción correctamente.'
      : i18n.t('notifications.songs_moved_plural', { count }) || `Se han reubicado ${count} canciones correctamente.`;

    await this.createNotification({
      type: 'songs_moved',
      title,
      actionType: 'navigate_library',
      isRead: this.isNotificationsScreenActive,
    });
  }

  public async addSongsDeletedNotification(count: number): Promise<void> {
    if (count <= 0) return;
    const title = count === 1
      ? i18n.t('notifications.songs_deleted_singular') || 'Se ha eliminado 1 canción de tu biblioteca.'
      : i18n.t('notifications.songs_deleted_plural', { count }) || `Se han eliminado ${count} canciones de tu biblioteca.`;

    await this.createNotification({
      type: 'songs_deleted',
      title,
      actionType: 'none',
      isRead: this.isNotificationsScreenActive,
    });
  }

  // --- STATS NOTIFICATIONS ---

  public async addWeeklySummaryNotification(range: PeriodRange): Promise<void> {
    const title = i18n.t('notifications.summary_weekly_title') || 'Tu resumen semanal ya está aquí.';
    const payload = JSON.stringify({
      period: 'week',
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      label: range.label,
    });

    await this.createNotification({
      id: range.periodKey,
      type: 'summary_weekly',
      title,
      description: range.label,
      actionType: 'navigate_stats_week',
      actionPayload: payload,
    });
  }

  public async addMonthlySummaryNotification(range: PeriodRange): Promise<void> {
    const title = i18n.t('notifications.summary_monthly_title') || 'Tu resumen mensual ya está aquí.';
    const payload = JSON.stringify({
      period: 'month',
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      label: range.label,
    });

    await this.createNotification({
      id: range.periodKey,
      type: 'summary_monthly',
      title,
      description: range.label,
      actionType: 'navigate_stats_month',
      actionPayload: payload,
    });
  }

  public async addYearlySummaryNotification(range: PeriodRange): Promise<void> {
    const title = i18n.t('notifications.summary_yearly_title') || 'Tu resumen del año ya está aquí.';
    const payload = JSON.stringify({
      period: 'year',
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      label: range.label,
    });

    await this.createNotification({
      id: range.periodKey,
      type: 'summary_yearly',
      title,
      description: range.label,
      actionType: 'navigate_stats_year',
      actionPayload: payload,
    });
  }

  // --- UPDATE NOTIFICATION ---

  public async addAppUpdateNotification(latestVersion: string): Promise<void> {
    const title = i18n.t('notifications.update_title') || 'Nueva actualización disponible.';
    const versionLabel = latestVersion.startsWith('v') ? latestVersion : `v${latestVersion}`;
    const description = i18n.t('notifications.update_desc', { version: versionLabel })
      || `Actualiza ahora a la versión ${versionLabel}.`;

    const payload = JSON.stringify({
      url: PLAY_STORE_URL,
      version: latestVersion,
    });

    await this.createNotification({
      id: `app_update_${latestVersion}`,
      type: 'app_update',
      title,
      description,
      actionType: 'open_url',
      actionPayload: payload,
    });
  }

  // --- MARK AS READ & DELETE ---

  public async markAsRead(id: string): Promise<void> {
    try {
      const record = await this.collection.find(id);
      if (record && !record.isRead) {
        await database.write(async () => {
          await record.update((notif) => {
            notif.isRead = true;
          });
        });
        await this.getUnreadCount();
      }
    } catch (e) {
      console.error('[NotificationService] Error marking as read:', e);
    }
  }

  public async markAllAsRead(): Promise<void> {
    try {
      const unreadList = await this.collection.query(Q.where('is_read', false)).fetch();
      if (unreadList.length === 0) return;

      await database.write(async () => {
        const batch = unreadList.map((item) =>
          item.prepareUpdate((notif) => {
            notif.isRead = true;
          })
        );
        await database.batch(batch);
      });
      await this.getUnreadCount();
    } catch (e) {
      console.error('[NotificationService] Error marking all as read:', e);
    }
  }

  public async markLibraryNotificationsAsRead(): Promise<void> {
    try {
      const libraryUnread = await this.collection
        .query(
          Q.where('is_read', false),
          Q.where('type', Q.oneOf(['songs_added', 'songs_moved', 'songs_deleted']))
        )
        .fetch();

      if (libraryUnread.length === 0) return;

      await database.write(async () => {
        const batch = libraryUnread.map((item) =>
          item.prepareUpdate((notif) => {
            notif.isRead = true;
          })
        );
        await database.batch(batch);
      });
      await this.getUnreadCount();
    } catch (e) {
      console.error('[NotificationService] Error marking library notifications as read:', e);
    }
  }

  public async clearAllNotifications(): Promise<void> {
    try {
      const all = await this.collection.query().fetch();
      if (all.length === 0) return;

      await database.write(async () => {
        const batch = all.map((item) => item.prepareDestroyPermanently());
        await database.batch(batch);
      });
      useNotificationStore.getState().setUnreadCount(0);
    } catch (e) {
      console.error('[NotificationService] Error clearing notifications:', e);
    }
  }

  public async deleteNotification(id: string): Promise<void> {
    try {
      const record = await this.collection.find(id);
      if (record) {
        await database.write(async () => {
          await record.destroyPermanently();
        });
        await this.getUnreadCount();
      }
    } catch (e) {
      console.error('[NotificationService] Error deleting notification:', e);
    }
  }

  public async hasCurrentWeeklySummary(now: Date = new Date()): Promise<boolean> {
    const weeklyRange = getPreviousWeekRange(now);
    return await this.exists(weeklyRange.periodKey);
  }

  // --- STARTUP CHECKS: SUMMARIES & UPDATES ---

  public async checkAndGenerateSummaries(): Promise<void> {
    try {
      const now = new Date();
      const locale = i18n.language || 'es-ES';

      await this.processWeeklySummary(now, locale);
      await this.processMonthlySummary(now, locale);
      await this.processYearlySummary(now);
    } catch (e) {
      console.error('[NotificationService] Error checking summaries:', e);
    }
  }

  private async processWeeklySummary(now: Date, locale: string): Promise<void> {
    if (!this.isNotificationTypeEnabled('summary_weekly')) return;
    const weeklyRange = getPreviousWeekRange(now, locale);
    const hasWeekly = await this.exists(weeklyRange.periodKey);
    if (!hasWeekly) {
      const hasRecords = await HistoryService.hasHistoryInRange(weeklyRange.from, weeklyRange.to);
      console.log(`[NotificationService] Weekly summary check: ${weeklyRange.periodKey} (range: ${weeklyRange.label}). hasRecords: ${hasRecords}`);
      if (hasRecords) {
        await this.addWeeklySummaryNotification(weeklyRange);
      }
    }
  }

  private async processMonthlySummary(now: Date, locale: string): Promise<void> {
    if (!this.isNotificationTypeEnabled('summary_monthly')) return;
    const monthlyRange = getPreviousMonthRange(now, locale);
    const hasMonthly = await this.exists(monthlyRange.periodKey);
    if (!hasMonthly) {
      const hasRecords = await HistoryService.hasHistoryInRange(monthlyRange.from, monthlyRange.to);
      if (hasRecords) {
        await this.addMonthlySummaryNotification(monthlyRange);
      }
    }
  }

  private async processYearlySummary(now: Date): Promise<void> {
    if (!this.isNotificationTypeEnabled('summary_yearly')) return;
    const yearlyRange = getPreviousYearRange(now);
    const hasYearly = await this.exists(yearlyRange.periodKey);
    if (!hasYearly) {
      const hasRecords = await HistoryService.hasHistoryInRange(yearlyRange.from, yearlyRange.to);
      if (hasRecords) {
        await this.addYearlySummaryNotification(yearlyRange);
      }
    }
  }

  public async checkForAppUpdates(): Promise<void> {
    if (!this.isNotificationTypeEnabled('app_update')) return;
    try {
      const data = await this.fetchRemoteUpdateData();
      if (!data?.latestVersion) return;

      const currentVersion = Constants.expoConfig?.version || '2.3.2';
      if (isNewerVersion(data.latestVersion, currentVersion)) {
        await this.addAppUpdateNotification(data.latestVersion);
      }
    } catch (e) {
      console.warn('[NotificationService] Error checking app updates:', e);
    }
  }

  private async fetchJsonFromUrl(url: string): Promise<{ latestVersion: string; releaseNotes?: string } | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (res.ok) {
        return (await res.json()) as { latestVersion: string; releaseNotes?: string };
      }
    } catch {
      // Continue to fallback
    } finally {
      clearTimeout(timer);
    }
    return null;
  }

  private async fetchRemoteUpdateData(): Promise<{ latestVersion: string; releaseNotes?: string } | null> {
    const primaryData = await this.fetchJsonFromUrl(REMOTE_UPDATE_URL);
    if (primaryData) {
      return primaryData;
    }
    return this.fetchJsonFromUrl(FALLBACK_UPDATE_URL);
  }

  public async handleNotificationPressEvent(notification: any): Promise<void> {
    if (!notification) return;
    try {
      const notifType = notification.data?.type || notification.id;
      if (!notifType) return;

      const isReady = await waitForNavigationReady(8000);
      if (!isReady) return;

      if (notification.data?.actionType === 'open_url' && notification.data?.actionPayload) {
        try {
          const payload = JSON.parse(notification.data.actionPayload);
          if (payload?.url) {
            await Linking.openURL(payload.url);
            return;
          }
        } catch {
          // Fall through to Notifications screen
        }
      }

      navigationRef.navigate('Notifications' as any);
    } catch (err) {
      console.warn('[NotificationService] Error handling notification press event:', err);
    }
  }

  // --- INIT LIFECYCLE ---

  public async init(): Promise<void> {
    try {
      await this.getUnreadCount();
      await this.checkAndGenerateSummaries();
      await this.checkForAppUpdates();
    } catch (e) {
      console.warn('[NotificationService] Init error:', e);
    }
  }
}

export const NotificationService = new NotificationServiceImpl();
