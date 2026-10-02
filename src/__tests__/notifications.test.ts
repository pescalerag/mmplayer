import {
  isNewerVersion,
  parseVersionParts,
  getNextMonday9AM,
  getNextMonthFirst9AM,
  getNextYearFirst9AM,
  getPreviousWeekRange,
  getPreviousMonthRange,
  getPreviousYearRange,
  formatNotificationDate,
} from '../utils/notificationHelpers';
import { NotificationService } from '../services/NotificationService';
import { HistoryService } from '../services/HistoryService';
import { useNotificationStore } from '../store/useNotificationStore';
import { useSettingsStore, DEFAULT_NOTIFICATION_PREFERENCES } from '../store/useSettingsStore';
import { database } from '../database';
import { navigationRef } from '../navigation/navigationRef';
import { Linking } from 'react-native';

// In-memory mock for notifications collection
interface MockRecord {
  id: string;
  _raw: { id: string };
  type: string;
  title: string;
  description?: string | null;
  createdAt: Date;
  isRead: boolean;
  actionType?: string | null;
  actionPayload?: string | null;
  update: (cb: (item: any) => void) => Promise<void>;
  prepareUpdate: (cb: (item: any) => void) => any;
  destroyPermanently: () => Promise<void>;
  prepareDestroyPermanently: () => any;
}

describe('Notification System Test Suite', () => {
  let mockNotificationsStore: MockRecord[] = [];

  const createMockRecord = (data: Partial<MockRecord>): MockRecord => {
    const record: MockRecord = {
      id: data.id || `notif_${Date.now()}_${Math.random()}`,
      _raw: { id: data.id || '' },
      type: data.type || 'songs_added',
      title: data.title || 'Test Notification',
      description: data.description ?? null,
      createdAt: data.createdAt || new Date(),
      isRead: data.isRead ?? false,
      actionType: data.actionType ?? null,
      actionPayload: data.actionPayload ?? null,
      update: async (cb) => {
        cb(record);
      },
      prepareUpdate: (cb) => {
        cb(record);
        return { action: 'update', record };
      },
      destroyPermanently: async () => {
        mockNotificationsStore = mockNotificationsStore.filter((r) => r.id !== record.id);
      },
      prepareDestroyPermanently: () => ({
        action: 'delete',
        record,
      }),
    };
    return record;
  };

  beforeEach(() => {
    mockNotificationsStore = [];
    useNotificationStore.setState({ unreadCount: 0 });
    useSettingsStore.setState({ notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES } });
    NotificationService.setScreenActive(false);

    const mockCollection = {
      query: (...clauses: any[]) => ({
        fetch: jest.fn().mockImplementation(async () => {
          let results = [...mockNotificationsStore];
          for (const c of clauses) {
            const str = JSON.stringify(c);
            if (str.includes('is_read')) {
              results = results.filter((n) => !n.isRead);
            }
            if (str.includes('songs_added') || str.includes('songs_moved') || str.includes('songs_deleted')) {
              results = results.filter((n) => ['songs_added', 'songs_moved', 'songs_deleted'].includes(n.type));
            }
          }
          return results;
        }),
        fetchCount: jest.fn().mockImplementation(async () => mockNotificationsStore.filter((n) => !n.isRead).length),
      }),
      find: jest.fn().mockImplementation(async (id: string) => {
        const found = mockNotificationsStore.find((n) => n.id === id);
        if (!found) throw new Error('Not found');
        return found;
      }),
      create: jest.fn().mockImplementation(async (cb: (item: any) => void) => {
        const record = createMockRecord({});
        cb(record);
        if (record._raw.id) {
          record.id = record._raw.id;
        }
        mockNotificationsStore.push(record);
        return record;
      }),
    };

    (database.get as jest.Mock) = jest.fn().mockImplementation((table: string) => {
      if (table === 'notifications') return mockCollection;
      return { query: () => ({ fetch: async () => [] }) };
    });

    (database.write as jest.Mock) = jest.fn().mockImplementation(async (cb: any) => cb());
    (database.batch as jest.Mock) = jest.fn().mockImplementation(async (batches: any[]) => {
      for (const op of batches) {
        if (op?.action === 'delete') {
          mockNotificationsStore = mockNotificationsStore.filter((r) => r.id !== op.record.id);
        }
      }
    });
  });

  describe('1. Version Comparison & Helpers', () => {
    it('debe parsear correctamente partes de versión con o sin prefijo v', () => {
      expect(parseVersionParts('1.4.0')).toEqual([1, 4, 0]);
      expect(parseVersionParts('v2.3.1')).toEqual([2, 3, 1]);
      expect(parseVersionParts('3.0')).toEqual([3, 0, 0]);
      expect(parseVersionParts('2.4.0-beta.1')).toEqual([2, 4, 0]);
    });

    it('debe detectar correctamente si una versión remota es superior a la actual', () => {
      expect(isNewerVersion('2.4.0', '2.3.2')).toBe(true);
      expect(isNewerVersion('v3.0.0', '2.9.9')).toBe(true);
      expect(isNewerVersion('2.3.3', '2.3.2')).toBe(true);
      expect(isNewerVersion('2.3.2', '2.3.2')).toBe(false);
      expect(isNewerVersion('2.3.1', '2.3.2')).toBe(false);
      expect(isNewerVersion('1.9.9', '2.0.0')).toBe(false);
    });
  });

  describe('2. Scheduled Notification Trigger Calculations (9:00 AM)', () => {
    it('debe calcular el próximo lunes a las 9:00 AM exactamente', () => {
      // Caso 1: Domingo 2026-10-04 a las 14:00 -> el próximo lunes es mañana 2026-10-05 a las 9:00
      const sunday = new Date(2026, 9, 4, 14, 0, 0);
      const nextMondayFromSun = getNextMonday9AM(sunday);
      expect(nextMondayFromSun.getDay()).toBe(1); // Lunes
      expect(nextMondayFromSun.getDate()).toBe(5);
      expect(nextMondayFromSun.getHours()).toBe(9);
      expect(nextMondayFromSun.getMinutes()).toBe(0);

      // Caso 2: Lunes 2026-10-05 a las 08:30 (antes de las 9) -> es hoy a las 9:00
      const mondayMorning = new Date(2026, 9, 5, 8, 30, 0);
      const nextMondayMorning = getNextMonday9AM(mondayMorning);
      expect(nextMondayMorning.getDate()).toBe(5);
      expect(nextMondayMorning.getHours()).toBe(9);

      // Caso 3: Lunes 2026-10-05 a las 09:15 (después de las 9) -> es el siguiente lunes (12 de octubre)
      const mondayAfternoon = new Date(2026, 9, 5, 9, 15, 0);
      const nextMondayAfternoon = getNextMonday9AM(mondayAfternoon);
      expect(nextMondayAfternoon.getDate()).toBe(12);
      expect(nextMondayAfternoon.getHours()).toBe(9);
    });

    it('debe calcular el día 1 del próximo mes a las 9:00 AM', () => {
      // 15 de octubre -> 1 de noviembre a las 9:00
      const midMonth = new Date(2026, 9, 15, 12, 0, 0);
      const nextMonth = getNextMonthFirst9AM(midMonth);
      expect(nextMonth.getDate()).toBe(1);
      expect(nextMonth.getMonth()).toBe(10); // Noviembre (0-indexed)
      expect(nextMonth.getHours()).toBe(9);

      // 1 de octubre a las 8:00 AM -> es hoy a las 9:00 AM
      const firstOctMorning = new Date(2026, 9, 1, 8, 0, 0);
      const nextMonthToday = getNextMonthFirst9AM(firstOctMorning);
      expect(nextMonthToday.getMonth()).toBe(9); // Octubre
      expect(nextMonthToday.getDate()).toBe(1);
      expect(nextMonthToday.getHours()).toBe(9);
    });

    it('debe calcular el 1 de enero a las 9:00 AM', () => {
      // 20 de julio de 2026 -> 1 de enero de 2027 a las 9:00 AM
      const midYear = new Date(2026, 6, 20, 10, 0, 0);
      const nextYear = getNextYearFirst9AM(midYear);
      expect(nextYear.getFullYear()).toBe(2027);
      expect(nextYear.getMonth()).toBe(0); // Enero
      expect(nextYear.getDate()).toBe(1);
      expect(nextYear.getHours()).toBe(9);
    });
  });

  describe('3. Period Range Calculation for Summaries', () => {
    it('debe calcular el rango de la semana anterior (lunes a domingo)', () => {
      // Miércoles 7 de octubre de 2026
      const refDate = new Date(2026, 9, 7, 12, 0, 0);
      const range = getPreviousWeekRange(refDate, 'es-ES');
      expect(range.from.getDay()).toBe(1); // Lunes
      expect(range.to.getDay()).toBe(0); // Domingo
      expect(range.periodKey).toContain('summary_weekly_');
      expect(range.label).toBeDefined();
    });

    it('debe calcular el rango del mes anterior', () => {
      // 5 de octubre de 2026 -> mes anterior es septiembre (mes 8 en 0-indexed)
      const refDate = new Date(2026, 9, 5, 12, 0, 0);
      const range = getPreviousMonthRange(refDate, 'es-ES');
      expect(range.from.getMonth()).toBe(8); // Septiembre
      expect(range.from.getDate()).toBe(1);
      expect(range.to.getMonth()).toBe(8);
      expect(range.periodKey).toBe('summary_monthly_2026_09');
    });

    it('debe calcular el rango del año anterior', () => {
      const refDate = new Date(2027, 0, 2);
      const range = getPreviousYearRange(refDate);
      expect(range.from.getFullYear()).toBe(2026);
      expect(range.to.getFullYear()).toBe(2026);
      expect(range.periodKey).toBe('summary_yearly_2026');
    });

    it('debe formatear fechas relativas correctamente', () => {
      const tMock = (k: string) => k;
      const now = new Date();
      expect(formatNotificationDate(now, tMock)).toBe('notifications.date_just_now');

      const tenMinutesAgo = new Date(now.getTime() - 10 * 60000);
      expect(formatNotificationDate(tenMinutesAgo, tMock)).toBe('notifications.date_minutes_ago');

      const twoHoursAgo = new Date(now.getTime() - 2 * 3600000);
      expect(formatNotificationDate(twoHoursAgo, tMock)).toBe('notifications.date_hours_ago');
    });
  });

  describe('4. Notification Creation for All 7 Types', () => {
    beforeEach(() => {
      useSettingsStore.setState({
        notificationPreferences: {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          songs_added: true,
          songs_moved: true,
          songs_deleted: true,
        },
      });
    });

    it('debe crear notificación de canciones añadidas (songs_added) con navegación a biblioteca', async () => {
      await NotificationService.addSongsAddedNotification(5);
      const notifs = await NotificationService.getNotifications();
      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe('songs_added');
      expect(notifs[0].actionType).toBe('navigate_library');
      expect(notifs[0].isRead).toBe(false);
    });

    it('debe crear notificación de canciones movidas (songs_moved) con navegación a biblioteca', async () => {
      await NotificationService.addSongsMovedNotification(3);
      const notifs = await NotificationService.getNotifications();
      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe('songs_moved');
      expect(notifs[0].actionType).toBe('navigate_library');
    });

    it('debe crear notificación de canciones eliminadas (songs_deleted) sin navegación', async () => {
      await NotificationService.addSongsDeletedNotification(2);
      const notifs = await NotificationService.getNotifications();
      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe('songs_deleted');
      expect(notifs[0].actionType).toBe('none');
    });

    it('debe crear notificación de resumen semanal (summary_weekly)', async () => {
      const range = getPreviousWeekRange(new Date(2026, 9, 5));
      await NotificationService.addWeeklySummaryNotification(range);
      const notifs = await NotificationService.getNotifications();
      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe('summary_weekly');
      expect(notifs[0].actionType).toBe('navigate_stats_week');
      expect(notifs[0].id).toBe(range.periodKey);
    });

    it('debe crear notificación de resumen mensual (summary_monthly)', async () => {
      const range = getPreviousMonthRange(new Date(2026, 9, 1));
      await NotificationService.addMonthlySummaryNotification(range);
      const notifs = await NotificationService.getNotifications();
      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe('summary_monthly');
      expect(notifs[0].actionType).toBe('navigate_stats_month');
    });

    it('debe crear notificación de resumen anual (summary_yearly)', async () => {
      const range = getPreviousYearRange(new Date(2027, 0, 1));
      await NotificationService.addYearlySummaryNotification(range);
      const notifs = await NotificationService.getNotifications();
      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe('summary_yearly');
      expect(notifs[0].actionType).toBe('navigate_stats_year');
    });

    it('debe crear notificación de actualización (app_update) con enlace a Play Store', async () => {
      await NotificationService.addAppUpdateNotification('2.4.0');
      const notifs = await NotificationService.getNotifications();
      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe('app_update');
      expect(notifs[0].actionType).toBe('open_url');
      expect(notifs[0].id).toBe('app_update_2.4.0');
      expect(JSON.parse(notifs[0].actionPayload || '{}').url).toContain('play.google.com');
    });
  });

  describe('5. Reading, Unread Count & Deletion Lifecycle', () => {
    beforeEach(() => {
      useSettingsStore.setState({
        notificationPreferences: {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          songs_added: true,
          songs_moved: true,
          songs_deleted: true,
        },
      });
    });

    it('debe calcular el unreadCount y actualizar el store reactivo', async () => {
      await NotificationService.addSongsAddedNotification(10);
      await NotificationService.addSongsMovedNotification(2);
      expect(useNotificationStore.getState().unreadCount).toBe(2);

      const unread = await NotificationService.getUnreadCount();
      expect(unread).toBe(2);
    });

    it('debe marcar una notificación individual como leída', async () => {
      await NotificationService.addSongsAddedNotification(5);
      const notifs = await NotificationService.getNotifications();
      expect(notifs[0].isRead).toBe(false);

      await NotificationService.markAsRead(notifs[0].id);
      expect(notifs[0].isRead).toBe(true);
      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });

    it('debe marcar únicamente las notificaciones de biblioteca como leídas al entrar a la pantalla', async () => {
      await NotificationService.addSongsAddedNotification(3);
      await NotificationService.addSongsDeletedNotification(1);
      const range = getPreviousWeekRange();
      await NotificationService.addWeeklySummaryNotification(range);

      const before = await NotificationService.getNotifications();
      expect(before.filter((n) => !n.isRead)).toHaveLength(3);

      // Auto-mark library notifications
      await NotificationService.markLibraryNotificationsAsRead();

      const after = await NotificationService.getNotifications();
      const libraryUnread = after.filter((n) => ['songs_added', 'songs_deleted'].includes(n.type) && !n.isRead);
      const statsUnread = after.filter((n) => n.type === 'summary_weekly' && !n.isRead);

      expect(libraryUnread).toHaveLength(0);
      expect(statsUnread).toHaveLength(1);
    });

    it('debe marcar automáticamente como leídas las notificaciones de biblioteca si la pantalla está activa', async () => {
      NotificationService.setScreenActive(true);
      await NotificationService.addSongsAddedNotification(5);
      await NotificationService.addSongsMovedNotification(2);
      await NotificationService.addSongsDeletedNotification(1);

      const notifs = await NotificationService.getNotifications();
      expect(notifs).toHaveLength(3);
      expect(notifs.every((n) => n.isRead)).toBe(true);
      expect(useNotificationStore.getState().unreadCount).toBe(0);

      NotificationService.setScreenActive(false);
    });

    it('debe marcar todas las notificaciones como leídas', async () => {
      await NotificationService.addSongsAddedNotification(1);
      await NotificationService.addAppUpdateNotification('2.5.0');
      expect(useNotificationStore.getState().unreadCount).toBe(2);

      await NotificationService.markAllAsRead();
      const all = await NotificationService.getNotifications();
      expect(all.every((n) => n.isRead)).toBe(true);
      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });

    it('debe eliminar una notificación individual', async () => {
      await NotificationService.addSongsAddedNotification(1);
      const notifs = await NotificationService.getNotifications();
      const targetId = notifs[0].id;

      await NotificationService.deleteNotification(targetId);
      const remaining = await NotificationService.getNotifications();
      expect(remaining).toHaveLength(0);
    });

    it('debe vaciar todas las notificaciones con clearAllNotifications', async () => {
      await NotificationService.addSongsAddedNotification(1);
      await NotificationService.addSongsMovedNotification(2);
      await NotificationService.addAppUpdateNotification('3.0.0');

      expect((await NotificationService.getNotifications())).toHaveLength(3);

      await NotificationService.clearAllNotifications();
      expect((await NotificationService.getNotifications())).toHaveLength(0);
      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });
  });

  describe('6. Summary Activity Threshold (History Requirement)', () => {
    it('NO debe generar resúmenes si no hay actividad en el período (hasHistoryInRange es false)', async () => {
      const spy = jest.spyOn(HistoryService, 'hasHistoryInRange').mockResolvedValue(false);

      await NotificationService.checkAndGenerateSummaries();

      const notifs = await NotificationService.getNotifications();
      const summaries = notifs.filter((n) => n.type.startsWith('summary_'));
      expect(summaries).toHaveLength(0);

      spy.mockRestore();
    });

    it('SÍ debe generar resúmenes cuando existen registros en el período (hasHistoryInRange es true)', async () => {
      const spy = jest.spyOn(HistoryService, 'hasHistoryInRange').mockResolvedValue(true);

      await NotificationService.checkAndGenerateSummaries();

      const notifs = await NotificationService.getNotifications();
      const summaries = notifs.filter((n) => n.type.startsWith('summary_'));
      expect(summaries.length).toBeGreaterThan(0);
      expect(summaries.some((n) => n.type === 'summary_weekly')).toBe(true);

      spy.mockRestore();
    });
  });

  describe('7. Notification Settings and Preferences', () => {
    it('NO debe crear notificación si el tipo está desactivado en preferencias', async () => {
      useSettingsStore.setState({
        notificationPreferences: {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          songs_added: false,
        },
      });

      await NotificationService.addSongsAddedNotification(5);

      const notifs = await NotificationService.getNotifications();
      expect(notifs).toHaveLength(0);
      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });

    it('SÍ debe crear notificación si el tipo está activado en preferencias', async () => {
      useSettingsStore.setState({
        notificationPreferences: {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          songs_added: true,
        },
      });

      await NotificationService.addSongsAddedNotification(3);

      const notifs = await NotificationService.getNotifications();
      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe('songs_added');
      expect(useNotificationStore.getState().unreadCount).toBe(1);
    });

    it('NO debe generar resúmenes si summary_weekly está desactivado en preferencias', async () => {
      const spy = jest.spyOn(HistoryService, 'hasHistoryInRange').mockResolvedValue(true);
      useSettingsStore.setState({
        notificationPreferences: {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          summary_weekly: false,
          summary_monthly: false,
          summary_yearly: false,
        },
      });

      await NotificationService.checkAndGenerateSummaries();

      const notifs = await NotificationService.getNotifications();
      expect(notifs.filter((n) => n.type.startsWith('summary_'))).toHaveLength(0);

      spy.mockRestore();
    });

    it('las preferencias por defecto tienen la biblioteca desactivada y resúmenes/actualizaciones activados', () => {
      expect(DEFAULT_NOTIFICATION_PREFERENCES.songs_added).toBe(false);
      expect(DEFAULT_NOTIFICATION_PREFERENCES.songs_moved).toBe(false);
      expect(DEFAULT_NOTIFICATION_PREFERENCES.songs_deleted).toBe(false);
      expect(DEFAULT_NOTIFICATION_PREFERENCES.summary_weekly).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFERENCES.summary_monthly).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFERENCES.summary_yearly).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFERENCES.app_update).toBe(true);
    });

    it('las preferencias se actualizan correctamente a través de useSettingsStore.setNotificationPreferences', () => {
      const setPrefs = useSettingsStore.getState().setNotificationPreferences;
      setPrefs({
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        songs_deleted: false,
        app_update: false,
      });

      const current = useSettingsStore.getState().notificationPreferences;
      expect(current.songs_deleted).toBe(false);
      expect(current.app_update).toBe(false);
      expect(current.songs_added).toBe(false);
    });
  });

  describe('8. Individual Disabled Notification Types', () => {
    const ALL_ENABLED = {
      songs_added: true,
      songs_moved: true,
      songs_deleted: true,
      summary_weekly: true,
      summary_monthly: true,
      summary_yearly: true,
      app_update: true,
    };

    it('desactivar individualmente songs_added bloquea solo songs_added', async () => {
      useSettingsStore.setState({
        notificationPreferences: { ...ALL_ENABLED, songs_added: false },
      });

      await NotificationService.addSongsAddedNotification(1);
      await NotificationService.addSongsMovedNotification(1);

      const notifs = await NotificationService.getNotifications();
      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe('songs_moved');
    });

    it('desactivar individualmente songs_moved bloquea solo songs_moved', async () => {
      useSettingsStore.setState({
        notificationPreferences: { ...ALL_ENABLED, songs_moved: false },
      });

      await NotificationService.addSongsMovedNotification(1);
      await NotificationService.addSongsDeletedNotification(1);

      const notifs = await NotificationService.getNotifications();
      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe('songs_deleted');
    });

    it('desactivar individualmente songs_deleted bloquea solo songs_deleted', async () => {
      useSettingsStore.setState({
        notificationPreferences: { ...ALL_ENABLED, songs_deleted: false },
      });

      await NotificationService.addSongsDeletedNotification(1);
      await NotificationService.addSongsAddedNotification(1);

      const notifs = await NotificationService.getNotifications();
      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe('songs_added');
    });

    it('desactivar individualmente summary_weekly bloquea solo el resumen semanal', async () => {
      const spy = jest.spyOn(HistoryService, 'hasHistoryInRange').mockResolvedValue(true);
      useSettingsStore.setState({
        notificationPreferences: { ...ALL_ENABLED, summary_weekly: false },
      });

      await NotificationService.checkAndGenerateSummaries();

      const notifs = await NotificationService.getNotifications();
      expect(notifs.some((n) => n.type === 'summary_weekly')).toBe(false);
      expect(notifs.some((n) => n.type === 'summary_monthly')).toBe(true);

      spy.mockRestore();
    });

    it('desactivar individualmente summary_monthly bloquea solo el resumen mensual', async () => {
      const spy = jest.spyOn(HistoryService, 'hasHistoryInRange').mockResolvedValue(true);
      useSettingsStore.setState({
        notificationPreferences: { ...ALL_ENABLED, summary_monthly: false },
      });

      await NotificationService.checkAndGenerateSummaries();

      const notifs = await NotificationService.getNotifications();
      expect(notifs.some((n) => n.type === 'summary_monthly')).toBe(false);
      expect(notifs.some((n) => n.type === 'summary_weekly')).toBe(true);

      spy.mockRestore();
    });

    it('desactivar individualmente summary_yearly bloquea solo el resumen anual', async () => {
      const spy = jest.spyOn(HistoryService, 'hasHistoryInRange').mockResolvedValue(true);
      useSettingsStore.setState({
        notificationPreferences: { ...ALL_ENABLED, summary_yearly: false },
      });

      await NotificationService.checkAndGenerateSummaries();

      const notifs = await NotificationService.getNotifications();
      expect(notifs.some((n) => n.type === 'summary_yearly')).toBe(false);
      expect(notifs.some((n) => n.type === 'summary_weekly')).toBe(true);

      spy.mockRestore();
    });

    it('desactivar individualmente app_update bloquea solo las notificaciones de actualización', async () => {
      useSettingsStore.setState({
        notificationPreferences: { ...ALL_ENABLED, app_update: false },
      });

      await NotificationService.addAppUpdateNotification('3.0.0');
      await NotificationService.addSongsAddedNotification(2);

      const notifs = await NotificationService.getNotifications();
      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe('songs_added');
    });
  });

  describe('9. Combined and Grouped Disabled Notification Preferences', () => {
    it('desactivar todas las notificaciones bloquea cualquier creación y mantiene unreadCount en 0', async () => {
      const spy = jest.spyOn(HistoryService, 'hasHistoryInRange').mockResolvedValue(true);
      useSettingsStore.setState({
        notificationPreferences: {
          songs_added: false,
          songs_moved: false,
          songs_deleted: false,
          summary_weekly: false,
          summary_monthly: false,
          summary_yearly: false,
          app_update: false,
        },
      });

      await NotificationService.addSongsAddedNotification(5);
      await NotificationService.addSongsMovedNotification(3);
      await NotificationService.addSongsDeletedNotification(2);
      await NotificationService.addAppUpdateNotification('4.0.0');
      await NotificationService.checkAndGenerateSummaries();

      const notifs = await NotificationService.getNotifications();
      expect(notifs).toHaveLength(0);
      expect(useNotificationStore.getState().unreadCount).toBe(0);

      spy.mockRestore();
    });

    it('desactivar el grupo de biblioteca bloquea solo biblioteca y permite resúmenes y actualizaciones', async () => {
      const spy = jest.spyOn(HistoryService, 'hasHistoryInRange').mockResolvedValue(true);
      useSettingsStore.setState({
        notificationPreferences: {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          songs_added: false,
          songs_moved: false,
          songs_deleted: false,
        },
      });

      await NotificationService.addSongsAddedNotification(1);
      await NotificationService.addSongsMovedNotification(1);
      await NotificationService.addSongsDeletedNotification(1);
      await NotificationService.addAppUpdateNotification('2.5.0');
      await NotificationService.checkAndGenerateSummaries();

      const notifs = await NotificationService.getNotifications();
      const libraryTypes = ['songs_added', 'songs_moved', 'songs_deleted'];
      expect(notifs.some((n) => libraryTypes.includes(n.type))).toBe(false);
      expect(notifs.some((n) => n.type === 'app_update')).toBe(true);
      expect(notifs.some((n) => n.type === 'summary_weekly')).toBe(true);

      spy.mockRestore();
    });

    it('desactivar el grupo de resúmenes bloquea todos los resúmenes y permite biblioteca y updates', async () => {
      const spy = jest.spyOn(HistoryService, 'hasHistoryInRange').mockResolvedValue(true);
      useSettingsStore.setState({
        notificationPreferences: {
          songs_added: true,
          songs_moved: true,
          songs_deleted: true,
          summary_weekly: false,
          summary_monthly: false,
          summary_yearly: false,
          app_update: true,
        },
      });

      await NotificationService.addSongsAddedNotification(2);
      await NotificationService.addAppUpdateNotification('2.5.0');
      await NotificationService.checkAndGenerateSummaries();

      const notifs = await NotificationService.getNotifications();
      expect(notifs.some((n) => n.type.startsWith('summary_'))).toBe(false);
      expect(notifs.some((n) => n.type === 'songs_added')).toBe(true);
      expect(notifs.some((n) => n.type === 'app_update')).toBe(true);

      spy.mockRestore();
    });

    it('restablecer las preferencias a los valores por defecto desactiva biblioteca y mantiene activos resúmenes y actualizaciones', async () => {
      useSettingsStore.setState({
        notificationPreferences: {
          songs_added: true,
          songs_moved: true,
          songs_deleted: true,
          summary_weekly: false,
          summary_monthly: false,
          summary_yearly: false,
          app_update: false,
        },
      });

      // Restaurar valores por defecto
      useSettingsStore.getState().setNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES });

      await NotificationService.addSongsAddedNotification(1);
      await NotificationService.addAppUpdateNotification('3.0.0');

      const notifs = await NotificationService.getNotifications();
      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe('app_update');
    });
  });

  describe('10. Notification Press Deep-Linking and Cold-Start Handler', () => {
    it('debe navegar a Notifications cuando se pulsa una notificación de resumen', async () => {
      jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
      const navigateSpy = jest.spyOn(navigationRef, 'navigate');

      await NotificationService.handleNotificationPressEvent({
        id: 'summary_weekly',
        data: { type: 'summary_weekly' },
      });

      expect(navigateSpy).toHaveBeenCalledWith('Notifications');
      navigateSpy.mockRestore();
    });

    it('debe ignorar notificaciones nulas o sin datos relevantes', async () => {
      const navigateSpy = jest.spyOn(navigationRef, 'navigate');

      await NotificationService.handleNotificationPressEvent(null);
      await NotificationService.handleNotificationPressEvent({});

      expect(navigateSpy).not.toHaveBeenCalled();
      navigateSpy.mockRestore();
    });

    it('no debe navegar si la navegación no está lista (timeout)', async () => {
      jest.spyOn(navigationRef, 'isReady').mockReturnValue(false);
      const navigateSpy = jest.spyOn(navigationRef, 'navigate');

      await NotificationService.handleNotificationPressEvent({
        id: 'summary_weekly',
        data: { type: 'summary_weekly' },
      });

      expect(navigateSpy).not.toHaveBeenCalled();
      navigateSpy.mockRestore();
    });

    it('debe abrir la URL cuando actionType es open_url y el payload es válido', async () => {
      jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
      const navigateSpy = jest.spyOn(navigationRef, 'navigate');
      const openUrlSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);

      await NotificationService.handleNotificationPressEvent({
        id: 'app_update',
        data: {
          type: 'app_update',
          actionType: 'open_url',
          actionPayload: JSON.stringify({ url: 'https://example.com/update' }),
        },
      });

      expect(openUrlSpy).toHaveBeenCalledWith('https://example.com/update');
      expect(navigateSpy).not.toHaveBeenCalled();
      navigateSpy.mockRestore();
      openUrlSpy.mockRestore();
    });

    it('debe navegar a Notifications si el payload de open_url es un JSON inválido', async () => {
      jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
      const navigateSpy = jest.spyOn(navigationRef, 'navigate');

      await NotificationService.handleNotificationPressEvent({
        id: 'app_update',
        data: {
          type: 'app_update',
          actionType: 'open_url',
          actionPayload: '{invalid-json',
        },
      });

      expect(navigateSpy).toHaveBeenCalledWith('Notifications');
      navigateSpy.mockRestore();
    });
  });

  describe('11. App Update Remote Check & Fallback Mechanism', () => {
    let fetchSpy: jest.SpyInstance;

    beforeEach(() => {
      fetchSpy = jest.spyOn(global, 'fetch');
    });

    afterEach(() => {
      fetchSpy.mockRestore();
    });

    it('debe crear notificación de actualización si la URL primaria tiene una versión más nueva', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ latestVersion: '3.0.0', releaseNotes: 'New features' }),
      } as any);

      await NotificationService.checkForAppUpdates();

      const notifs = await NotificationService.getNotifications();
      expect(notifs.some((n) => n.type === 'app_update' && n.id === 'app_update_3.0.0')).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('debe usar la URL de respaldo si la URL primaria falla con error de red o timeout', async () => {
      fetchSpy
        .mockRejectedValueOnce(new Error('Network request failed'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ latestVersion: '2.5.0' }),
        } as any);

      await NotificationService.checkForAppUpdates();

      const notifs = await NotificationService.getNotifications();
      expect(notifs.some((n) => n.type === 'app_update' && n.id === 'app_update_2.5.0')).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('no debe crear notificación si la versión remota no es superior a la actual', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ latestVersion: '2.3.2' }),
      } as any);

      await NotificationService.checkForAppUpdates();

      const notifs = await NotificationService.getNotifications();
      expect(notifs.some((n) => n.type === 'app_update')).toBe(false);
    });

    it('no debe lanzar error si ambas URLs fallan', async () => {
      fetchSpy
        .mockRejectedValueOnce(new Error('Primary failed'))
        .mockRejectedValueOnce(new Error('Fallback failed'));

      await expect(NotificationService.checkForAppUpdates()).resolves.not.toThrow();
      const notifs = await NotificationService.getNotifications();
      expect(notifs.some((n) => n.type === 'app_update')).toBe(false);
    });
  });
});



