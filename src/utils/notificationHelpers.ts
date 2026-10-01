export function parseVersionParts(version: string): number[] {
  const clean = version.replace(/^v/i, '').split('-')[0].trim();
  const parts = clean.split('.').map(p => {
    const num = Number.parseInt(p, 10);
    return Number.isNaN(num) ? 0 : num;
  });
  while (parts.length < 3) {
    parts.push(0);
  }
  return parts;
}

export function isNewerVersion(remoteVersion: string, currentVersion: string): boolean {
  if (!remoteVersion || !currentVersion) return false;
  const remote = parseVersionParts(remoteVersion);
  const current = parseVersionParts(currentVersion);

  for (let i = 0; i < 3; i++) {
    if (remote[i] > current[i]) return true;
    if (remote[i] < current[i]) return false;
  }
  return false;
}

export function getNextMonday9AM(now: Date = new Date()): Date {
  const target = new Date(now);
  target.setHours(9, 0, 0, 0);

  const day = target.getDay(); // 0: Sunday, 1: Monday, ...
  let daysUntilMonday = (1 - day + 7) % 7;

  // If today is Monday and it is already 9:00 AM or later, advance to next Monday
  if (daysUntilMonday === 0 && now.getTime() >= target.getTime()) {
    daysUntilMonday = 7;
  }

  target.setDate(target.getDate() + daysUntilMonday);
  return target;
}

export function getNextMonthFirst9AM(now: Date = new Date()): Date {
  const todayFirst9AM = new Date(now.getFullYear(), now.getMonth(), 1, 9, 0, 0, 0);

  if (now.getDate() === 1 && now.getTime() < todayFirst9AM.getTime()) {
    return todayFirst9AM;
  }

  return new Date(now.getFullYear(), now.getMonth() + 1, 1, 9, 0, 0, 0);
}

export function getNextYearFirst9AM(now: Date = new Date()): Date {
  const todayJan1st9AM = new Date(now.getFullYear(), 0, 1, 9, 0, 0, 0);

  if (now.getMonth() === 0 && now.getDate() === 1 && now.getTime() < todayJan1st9AM.getTime()) {
    return todayJan1st9AM;
  }

  return new Date(now.getFullYear() + 1, 0, 1, 9, 0, 0, 0);
}

export interface PeriodRange {
  from: Date;
  to: Date;
  label: string;
  periodKey: string;
}

export function getPreviousWeekRange(now: Date = new Date(), locale: string = 'es-ES'): PeriodRange {
  const day = now.getDay();
  const currentMondayDiff = now.getDate() - day + (day === 0 ? -6 : 1);
  const currentMonday = new Date(now.getFullYear(), now.getMonth(), currentMondayDiff, 0, 0, 0, 0);

  const prevMonday = new Date(currentMonday);
  prevMonday.setDate(currentMonday.getDate() - 7);

  const prevSunday = new Date(prevMonday);
  prevSunday.setDate(prevMonday.getDate() + 6);
  prevSunday.setHours(23, 59, 59, 999);

  const fmt = (d: Date) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const label = `${fmt(prevMonday)} – ${fmt(prevSunday)}`;
  const dateStr = prevMonday.toISOString().split('T')[0];
  const periodKey = `summary_weekly_${dateStr}`;

  return { from: prevMonday, to: prevSunday, label, periodKey };
}

export function getPreviousMonthRange(now: Date = new Date(), locale: string = 'es-ES'): PeriodRange {
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const rawMonthName = prevMonthStart.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const label = rawMonthName.charAt(0).toUpperCase() + rawMonthName.slice(1);
  const monthNumber = String(prevMonthStart.getMonth() + 1).padStart(2, '0');
  const periodKey = `summary_monthly_${prevMonthStart.getFullYear()}_${monthNumber}`;

  return { from: prevMonthStart, to: prevMonthEnd, label, periodKey };
}

export function getPreviousYearRange(now: Date = new Date()): PeriodRange {
  const prevYear = now.getFullYear() - 1;
  const from = new Date(prevYear, 0, 1, 0, 0, 0, 0);
  const to = new Date(prevYear, 11, 31, 23, 59, 59, 999);
  const label = String(prevYear);
  const periodKey = `summary_yearly_${prevYear}`;

  return { from, to, label, periodKey };
}

function parseNotificationDate(date?: Date | number | string | null): Date | null {
  if (!date) {
    return null;
  }
  const dateObj = date instanceof Date ? date : new Date(date);
  return Number.isNaN(dateObj.getTime()) ? null : dateObj;
}

function getRelativeDateString(diffMinutes: number, diffHours: number, t?: any): string | null {
  if (diffMinutes < 1) {
    return t?.('notifications.date_just_now') || 'Ahora mismo';
  }
  if (diffMinutes < 60) {
    return t?.('notifications.date_minutes_ago', { count: diffMinutes }) || `Hace ${diffMinutes} min`;
  }
  if (diffHours < 24) {
    return t?.('notifications.date_hours_ago', { count: diffHours }) || `Hace ${diffHours} h`;
  }
  return null;
}

export function formatNotificationDate(
  date?: Date | number | string | null,
  t?: any,
  locale: string = 'es-ES'
): string {
  const dateObj = parseNotificationDate(date);
  if (!dateObj) {
    return t?.('notifications.date_just_now') || 'Ahora mismo';
  }

  const diffMs = Math.max(0, Date.now() - dateObj.getTime());
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  const relativeStr = getRelativeDateString(diffMinutes, diffHours, t);
  if (relativeStr) {
    return relativeStr;
  }

  return dateObj.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

