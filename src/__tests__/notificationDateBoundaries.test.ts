import { formatNotificationDate, getNextYearFirst9AM, getPreviousWeekRange } from '../utils/notificationHelpers';

afterEach(() => jest.useRealTimers());

it('keeps the current January first deadline before 9 AM and rolls over at the deadline', () => {
  expect(getNextYearFirst9AM(new Date(2026, 0, 1, 8))).toEqual(new Date(2026, 0, 1, 9));
  expect(getNextYearFirst9AM(new Date(2026, 0, 1, 9))).toEqual(new Date(2027, 0, 1, 9));
});

it('uses the previous full Monday-to-Sunday week when called on Sunday', () => {
  const result = getPreviousWeekRange(new Date(2026, 9, 11, 12));
  expect(result.from).toEqual(new Date(2026, 8, 28));
  expect(result.to).toEqual(new Date(2026, 9, 4, 23, 59, 59, 999));
});

it('formats old, missing and invalid dates and uses supplied translations', () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 9, 13, 12));
  const translate = jest.fn((key: string) => 'translated:' + key);
  expect(formatNotificationDate(null, translate)).toBe('translated:notifications.date_just_now');
  expect(formatNotificationDate('invalid')).toBe('Ahora mismo');
  expect(formatNotificationDate(Date.now() + 60000, translate)).toBe('translated:notifications.date_just_now');
  expect(formatNotificationDate(Date.now() - 5 * 60000, translate)).toBe('translated:notifications.date_minutes_ago');
  expect(formatNotificationDate(Date.now() - 2 * 3600000, translate)).toBe('translated:notifications.date_hours_ago');
  const old = new Date(2026, 9, 10, 9);
  expect(formatNotificationDate(old.toISOString(), undefined, 'en-US')).toBe(old.toLocaleDateString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));
});
