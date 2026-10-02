export type Period = 'day' | 'week' | 'month' | 'year' | 'all' | 'custom';

export const PERIODS: ('day' | 'week' | 'month' | 'year' | 'all')[] = ['day', 'week', 'month', 'year', 'all'];

export interface DateRangeInfo {
  from: Date | null;
  to: Date;
  label: string;
  canGoPrev: boolean;
  canGoNext: boolean;
}

export function getAllRange(now: Date, t: (key: string) => string): DateRangeInfo {
  return {
    from: null,
    to: now,
    label: t('activity.all_activity') || 'Toda la actividad',
    canGoPrev: false,
    canGoNext: false,
  };
}

export function getCustomRange(
  customFrom: Date | null,
  customTo: Date,
  locale: string
): DateRangeInfo {
  const fromStr = customFrom ? customFrom.toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : '...';
  const toStr = customTo ? customTo.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '...';

  return {
    from: customFrom,
    to: customTo,
    label: `${fromStr} – ${toStr}`,
    canGoPrev: false,
    canGoNext: false,
  };
}

export function getYearRange(
  now: Date,
  dateOffset: number,
  firstDate: Date | null
): DateRangeInfo {
  const targetYear = now.getFullYear() + dateOffset;
  const from = new Date(targetYear, 0, 1, 0, 0, 0, 0);
  const to = new Date(targetYear, 11, 31, 23, 59, 59, 999);
  const label = String(targetYear);

  const canGoNext = targetYear < now.getFullYear();
  const canGoPrev = firstDate ? targetYear > firstDate.getFullYear() : false;

  return { from, to, label, canGoPrev, canGoNext };
}

export function getMonthRange(
  now: Date,
  dateOffset: number,
  firstDate: Date | null,
  locale: string
): DateRangeInfo {
  const targetDate = new Date(now.getFullYear(), now.getMonth() + dateOffset, 1, 0, 0, 0, 0);
  const from = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1, 0, 0, 0, 0);
  const to = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999);

  const monthName = targetDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const label = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const canGoNext = from.getTime() < currentMonthStart.getTime();

  const firstMonthStart = firstDate
    ? new Date(firstDate.getFullYear(), firstDate.getMonth(), 1, 0, 0, 0, 0)
    : null;
  const canGoPrev = firstMonthStart ? from.getTime() > firstMonthStart.getTime() : false;

  return { from, to, label, canGoPrev, canGoNext };
}

function getWeekLabel(from: Date, to: Date, now: Date, locale: string): string {
  const fmt = (d: Date) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const fmtWithYear = (d: Date) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });

  if (from.getFullYear() !== to.getFullYear()) {
    return `${fmtWithYear(from)} – ${fmtWithYear(to)}`;
  }
  if (from.getFullYear() !== now.getFullYear()) {
    return `${fmt(from)} – ${fmtWithYear(to)}`;
  }
  return `${fmt(from)} – ${fmt(to)}`;
}

export function getWeekRange(
  now: Date,
  dateOffset: number,
  firstDayStart: Date | null,
  locale: string
): DateRangeInfo {
  const nowDay = now.getDay();
  const currentMondayDiff = now.getDate() - nowDay + (nowDay === 0 ? -6 : 1);
  const targetMonday = new Date(now.getFullYear(), now.getMonth(), currentMondayDiff + (dateOffset * 7), 0, 0, 0, 0);
  const from = new Date(targetMonday);
  const to = new Date(targetMonday);
  to.setDate(targetMonday.getDate() + 6);
  to.setHours(23, 59, 59, 999);

  const label = getWeekLabel(from, to, now, locale);
  const canGoNext = dateOffset < 0;
  const prevWeekEnd = new Date(from.getTime() - 1);
  const canGoPrev = firstDayStart ? prevWeekEnd.getTime() >= firstDayStart.getTime() : false;

  return { from, to, label, canGoPrev, canGoNext };
}

function getDayLabel(targetDay: Date, dateOffset: number, now: Date, locale: string, t: (key: string) => string): string {
  if (dateOffset === 0) {
    const formatted = targetDay.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
    return `${t('activity.history_today') || 'Hoy'} · ${formatted}`;
  }
  if (dateOffset === -1) {
    const formatted = targetDay.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
    return `${t('activity.history_yesterday') || 'Ayer'} · ${formatted}`;
  }

  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  };
  if (targetDay.getFullYear() !== now.getFullYear()) {
    dateOptions.year = 'numeric';
  }
  const formatted = targetDay.toLocaleDateString(locale, dateOptions);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function getDayRange(
  now: Date,
  dateOffset: number,
  firstDayStart: Date | null,
  locale: string,
  t: (key: string) => string
): DateRangeInfo {
  const targetDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dateOffset, 0, 0, 0, 0);
  const from = new Date(targetDay);
  const to = new Date(targetDay);
  to.setHours(23, 59, 59, 999);

  const label = getDayLabel(targetDay, dateOffset, now, locale, t);
  const canGoNext = dateOffset < 0;
  const canGoPrev = firstDayStart ? from.getTime() > firstDayStart.getTime() : false;

  return { from, to, label, canGoPrev, canGoNext };
}

export function calculateDateRangeInfo(
  period: Period,
  dateOffset: number,
  firstHistoryDate: Date | null,
  customFrom: Date | null,
  customTo: Date,
  t: (key: string) => string
): DateRangeInfo {
  const now = new Date();
  const locale = t('activity.locale_code') || 'es-ES';

  if (period === 'all') {
    return getAllRange(now, t);
  }
  if (period === 'custom') {
    return getCustomRange(customFrom, customTo, locale);
  }

  const firstDayStart = firstHistoryDate
    ? new Date(firstHistoryDate.getFullYear(), firstHistoryDate.getMonth(), firstHistoryDate.getDate(), 0, 0, 0, 0)
    : null;

  if (period === 'year') {
    return getYearRange(now, dateOffset, firstHistoryDate);
  }
  if (period === 'month') {
    return getMonthRange(now, dateOffset, firstHistoryDate, locale);
  }
  if (period === 'week') {
    return getWeekRange(now, dateOffset, firstDayStart, locale);
  }
  return getDayRange(now, dateOffset, firstDayStart, locale, t);
}
