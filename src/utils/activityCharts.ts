export type ChartMetric = 'duration' | 'plays';
export type ChartGranularity = 'hour' | 'day' | 'month';

export interface ChartHistoryRecord {
  playedAt: Date;
  durationPlayed: number | null;
}

export interface ChartBucket {
  key: number;
  seconds: number;
  plays: number;
}

export interface ActivityChartStats {
  days: ChartBucket[];
  months: ChartBucket[];
  hours: ChartBucket[];
  dayCount: number;
  averageMinutes: number;
  averagePlays: number;
}

export const EMPTY_CHART_STATS: ActivityChartStats = {
  days: [], months: [], hours: [], dayCount: 0, averageMinutes: 0, averagePlays: 0,
};

export function startOfChartDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function calendarDayNumber(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
}

function emptyBucket(key: number): ChartBucket {
  return { key, seconds: 0, plays: 0 };
}

function createDailyBuckets(from: Date, to: Date): Map<number, ChartBucket> {
  const buckets = new Map<number, ChartBucket>();
  const cursor = startOfChartDay(from);
  const lastDay = startOfChartDay(to).getTime();
  while (cursor.getTime() <= lastDay) {
    buckets.set(cursor.getTime(), emptyBucket(cursor.getTime()));
    cursor.setDate(cursor.getDate() + 1);
  }
  return buckets;
}

function addRecord(bucket: ChartBucket, record: ChartHistoryRecord): void {
  const seconds = record.durationPlayed ?? 0;
  bucket.seconds += Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  bucket.plays += 1;
}

function groupMonths(days: ChartBucket[]): ChartBucket[] {
  const months = new Map<number, ChartBucket>();
  for (const day of days) {
    const date = new Date(day.key);
    const key = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
    const month = months.get(key) ?? emptyBucket(key);
    month.seconds += day.seconds;
    month.plays += day.plays;
    months.set(key, month);
  }
  return Array.from(months.values());
}

function firstRecordDate(records: ChartHistoryRecord[], to: Date): Date | null {
  const timestamps = records.map(record => record.playedAt.getTime()).filter(Number.isFinite);
  const earliest = timestamps.reduce((min, timestamp) => Math.min(min, timestamp), Infinity);
  return earliest <= to.getTime() ? startOfChartDay(new Date(earliest)) : null;
}

export function calculateActivityCharts(
  records: ChartHistoryRecord[], from: Date | null, to: Date, now: Date = new Date(),
): ActivityChartStats {
  const end = new Date(Math.min(to.getTime(), now.getTime()));
  const start = from === null ? firstRecordDate(records, end) : startOfChartDay(from);
  if (!start || start.getTime() > end.getTime()) return { ...EMPTY_CHART_STATS };
  const daily = createDailyBuckets(start, end);
  const hours = Array.from({ length: 24 }, (_, hour) => emptyBucket(hour));
  for (const record of records) {
    const timestamp = record.playedAt.getTime();
    if (timestamp < start.getTime() || timestamp > end.getTime() || !Number.isFinite(timestamp)) continue;
    addRecord(daily.get(startOfChartDay(record.playedAt).getTime())!, record);
    addRecord(hours[record.playedAt.getHours()], record);
  }
  const days = Array.from(daily.values());
  const dayCount = calendarDayNumber(end) - calendarDayNumber(start) + 1;
  const totals = hours.reduce((sum, hour) => ({ seconds: sum.seconds + hour.seconds, plays: sum.plays + hour.plays }), { seconds: 0, plays: 0 });
  return {
    days, months: groupMonths(days), hours, dayCount,
    averageMinutes: totals.seconds / 60 / dayCount,
    averagePlays: totals.plays / dayCount,
  };
}

export function getChartValues(buckets: readonly ChartBucket[], metric: ChartMetric, cumulative: boolean): number[] {
  let total = 0;
  return buckets.map(bucket => {
    const value = metric === 'duration' ? bucket.seconds / 60 : bucket.plays;
    total += value;
    return cumulative ? total : value;
  });
}

export function getMonthDays(days: readonly ChartBucket[], monthKey: number): ChartBucket[] {
  const month = new Date(monthKey);
  return days.filter(day => {
    const date = new Date(day.key);
    return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
  });
}

export function getChartTotals(buckets: readonly ChartBucket[]): { seconds: number; plays: number } {
  return buckets.reduce((sum, bucket) => ({ seconds: sum.seconds + bucket.seconds, plays: sum.plays + bucket.plays }), { seconds: 0, plays: 0 });
}

export function formatChartBucket(key: number, granularity: ChartGranularity, locale: string): string {
  if (granularity === 'hour') return `${String(key).padStart(2, '0')}:00`;
  const options: Intl.DateTimeFormatOptions = granularity === 'month'
    ? { month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' };
  return new Date(key).toLocaleDateString(locale, options);
}

export function getClockSegmentPath(hour: number, value: number, max: number): string {
  const innerRadius = 55;
  const outerRadius = innerRadius + (max > 0 ? value / max : 0) * 43;
  const point = (radius: number, angle: number) => {
    const radians = (angle - 90) * Math.PI / 180;
    return `${120 + radius * Math.cos(radians)},${120 + radius * Math.sin(radians)}`;
  };
  const start = hour * 15 + 1;
  const end = (hour + 1) * 15 - 1;
  return `M${point(innerRadius, start)} L${point(outerRadius, start)} A${outerRadius},${outerRadius} 0 0 1 ${point(outerRadius, end)} L${point(innerRadius, end)} A${innerRadius},${innerRadius} 0 0 0 ${point(innerRadius, start)} Z`;
}
