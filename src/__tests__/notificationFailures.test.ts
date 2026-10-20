import { NotificationService } from '../services/NotificationService';
import { database } from '../database';
import { navigationRef, waitForNavigationReady } from '../navigation/navigationRef';
import { Linking } from 'react-native';

beforeEach(() => { jest.clearAllMocks(); jest.spyOn(navigationRef, 'isReady').mockReturnValue(true); jest.spyOn(console, 'error').mockImplementation(() => {}); jest.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());

it('returns safe defaults when notifications cannot be fetched or counted', async () => {
  (database.get as jest.Mock).mockReturnValue({ query: () => ({ fetch: async () => { throw Error('Unavailable'); }, fetchCount: async () => { throw Error('Unavailable'); } }) });
  expect(await NotificationService.getNotifications()).toEqual([]);
  expect(await NotificationService.getUnreadCount()).toBe(0);
});

it('catches initialization failures and does not proceed to background checks', async () => {
  jest.spyOn(NotificationService, 'getUnreadCount').mockRejectedValueOnce(Error('Unavailable'));
  const summaries = jest.spyOn(NotificationService, 'checkAndGenerateSummaries').mockResolvedValue(undefined);
  await expect(NotificationService.init()).resolves.toBeUndefined();
  expect(summaries).not.toHaveBeenCalled();
});

it('initializes unread counts, summaries and app updates', async () => {
  const unread = jest.spyOn(NotificationService, 'getUnreadCount').mockResolvedValue(3);
  const summaries = jest.spyOn(NotificationService, 'checkAndGenerateSummaries').mockResolvedValue(undefined);
  const updates = jest.spyOn(NotificationService, 'checkForAppUpdates').mockResolvedValue(undefined);
  await NotificationService.init();
  expect(unread).toHaveBeenCalledTimes(1); expect(summaries).toHaveBeenCalledTimes(1); expect(updates).toHaveBeenCalledTimes(1);
});

it('waits for navigation and opens a valid notification URL', async () => {
  (waitForNavigationReady as jest.Mock).mockResolvedValue(true);
  await NotificationService.handleNotificationPressEvent({ id: 'news', data: { actionType: 'open_url', actionPayload: JSON.stringify({ url: 'https://example.com/update' }) } });
  expect(Linking.openURL).toHaveBeenCalledWith('https://example.com/update');
  expect(navigationRef.navigate).not.toHaveBeenCalled();
});

it.each(['invalid-json', '{}'])('falls back to the notification screen for an invalid payload: %s', async payload => {
  (waitForNavigationReady as jest.Mock).mockResolvedValue(true);
  await NotificationService.handleNotificationPressEvent({ id: 'news', data: { actionType: 'open_url', actionPayload: payload } });
  expect(navigationRef.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'NAVIGATE', payload: expect.objectContaining({ name: 'Main', params: expect.objectContaining({ screen: 'Inicio', params: expect.objectContaining({ screen: 'Notifications' }) }) }) }));
  expect(Linking.openURL).not.toHaveBeenCalled();
});

it('ignores missing events and does not navigate before the navigator is ready', async () => {
  await NotificationService.handleNotificationPressEvent(null);
  await NotificationService.handleNotificationPressEvent({});
  expect(waitForNavigationReady).not.toHaveBeenCalled();
  (waitForNavigationReady as jest.Mock).mockResolvedValue(false);
  await NotificationService.handleNotificationPressEvent({ id: 'news' });
  expect(navigationRef.navigate).not.toHaveBeenCalled();
  (waitForNavigationReady as jest.Mock).mockRejectedValueOnce(Error('Unavailable'));
  await expect(NotificationService.handleNotificationPressEvent({ id: 'news' })).resolves.toBeUndefined();
});
