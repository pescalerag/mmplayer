import {
  calculateActivityCharts, EMPTY_CHART_STATS, formatChartBucket, getChartValues,
  getClockSegmentPath, getMonthDays,
} from '../utils/activityCharts';

const date = (day: number, hour = 0) => new Date(2026, 9, day, hour);
const record = (day: number, hour: number, durationPlayed: number | null) => ({ playedAt: date(day, hour), durationPlayed });

describe('activity chart calculations', () => {
  it('includes silent days, counts today, and excludes future days and records', () => {
    const stats = calculateActivityCharts([record(1, 8, 120), record(3, 8, 60), record(4, 9, 600)], date(1), date(7), date(3, 18));
    expect(stats.dayCount).toBe(3);
    expect(stats.averageMinutes).toBe(1);
    expect(stats.averagePlays).toBeCloseTo(2 / 3);
    expect(stats.days.map(day => day.seconds)).toEqual([120, 0, 60]);
    expect(stats.hours).toHaveLength(24);
    expect(stats.hours[8]).toEqual({ key: 8, seconds: 180, plays: 2 });
    expect(stats.months).toEqual([{ key: date(1).getTime(), seconds: 180, plays: 2 }]);
  });

  it('counts all-time from the earliest recorded day through today, even with unordered records', () => {
    const stats = calculateActivityCharts([record(5, 9, 180), record(2, 23, 60)], null, date(10), date(8, 12));
    expect(stats.dayCount).toBe(7);
    expect(stats.days[0].key).toBe(date(2).getTime());
    expect(stats.days[6].key).toBe(date(8).getTime());
    expect(stats.averageMinutes).toBeCloseTo(4 / 7);
  });

  it('uses the whole elapsed selected period, including days preceding the first listen', () => {
    const stats = calculateActivityCharts([record(3, 12, 60)], date(1), date(5, 23), date(10));
    expect(stats.dayCount).toBe(5);
    expect(stats.averageMinutes).toBe(0.2);
    expect(stats.days.map(day => day.plays)).toEqual([0, 0, 1, 0, 0]);
  });

  it('returns finite zero averages for an empty selected period and an empty all-time history', () => {
    expect(calculateActivityCharts([], null, date(3), date(3))).toEqual(EMPTY_CHART_STATS);
    const selected = calculateActivityCharts([], date(1), date(3, 23), date(10));
    expect(selected.dayCount).toBe(3);
    expect(selected.averageMinutes).toBe(0);
    expect(selected.averagePlays).toBe(0);
    expect(selected.hours.every(hour => hour.plays === 0)).toBe(true);
  });

  it('rejects future or reversed ranges and future-only all-time history', () => {
    expect(calculateActivityCharts([], date(4), date(5), date(3))).toEqual(EMPTY_CHART_STATS);
    expect(calculateActivityCharts([], date(4), date(2), date(10))).toEqual(EMPTY_CHART_STATS);
    expect(calculateActivityCharts([record(4, 1, 60)], null, date(3), date(3))).toEqual(EMPTY_CHART_STATS);
  });

  it('filters invalid and out-of-range dates and sanitizes durations without dropping plays', () => {
    const records = [
      record(1, 8, 120), record(2, 8, null), record(2, 8, -10), record(2, 9, NaN),
      record(2, 10, Infinity), record(3, 0, 60), { playedAt: new Date(NaN), durationPlayed: 10 },
    ];
    const stats = calculateActivityCharts(records, date(2), date(2, 23), date(10));
    expect(stats.averageMinutes).toBe(0);
    expect(stats.averagePlays).toBe(4);
    expect(calculateActivityCharts(records, null, date(2, 23), date(10)).dayCount).toBe(2);
    expect(calculateActivityCharts([{ playedAt: new Date(NaN), durationPlayed: 0 }], null, date(2))).toEqual(EMPTY_CHART_STATS);
  });

  it('assigns listens to their recorded local hour at midnight and late evening', () => {
    const stats = calculateActivityCharts([record(1, 0, 60), record(1, 23, 90)], date(1), date(1, 23), date(10));
    expect(stats.hours[0].seconds).toBe(60);
    expect(stats.hours[23].seconds).toBe(90);
  });

  it('groups months across years and preserves silent months and leap days', () => {
    const from = new Date(2023, 11, 31);
    const to = new Date(2024, 2, 1, 23);
    const stats = calculateActivityCharts([{ playedAt: new Date(2024, 1, 29, 12), durationPlayed: 600 }], from, to, to);
    expect(stats.dayCount).toBe(62);
    expect(stats.months.map(month => month.seconds)).toEqual([0, 0, 600, 0]);
    expect(getMonthDays(stats.days, new Date(2024, 1, 1).getTime())).toHaveLength(29);
    expect(getMonthDays(stats.days, new Date(2025, 1, 1).getTime())).toEqual([]);
  });

  it.each([[2, 28, 30], [9, 24, 26]])('counts calendar days across DST boundaries (%s/%s)', (month, first, last) => {
    const from = new Date(2026, month, first);
    const to = new Date(2026, month, last, 23, 59);
    const stats = calculateActivityCharts([], from, to, to);
    expect(stats.dayCount).toBe(3);
    expect(stats.days).toHaveLength(3);
    expect(stats.days.map(day => new Date(day.key).getDate())).toEqual([first, first + 1, last]);
  });

  it('computes interval values and chronological cumulative totals for both metrics', () => {
    const buckets = [{ key: 1, seconds: 90, plays: 2 }, { key: 2, seconds: 0, plays: 0 }, { key: 3, seconds: 30, plays: 1 }];
    expect(getChartValues(buckets, 'duration', false)).toEqual([1.5, 0, 0.5]);
    expect(getChartValues(buckets, 'duration', true)).toEqual([1.5, 1.5, 2]);
    expect(getChartValues(buckets, 'plays', false)).toEqual([2, 0, 1]);
    expect(getChartValues(buckets, 'plays', true)).toEqual([2, 2, 3]);
    expect(getChartValues([], 'duration', true)).toEqual([]);
    expect(buckets[2].seconds).toBe(30);
  });

  it('formats hours and calendar labels for supported locales', () => {
    expect(formatChartBucket(0, 'hour', 'es-ES')).toBe('00:00');
    expect(formatChartBucket(23, 'hour', 'en-US')).toBe('23:00');
    for (const locale of ['es-ES', 'en-US', 'pt-BR']) {
      expect(formatChartBucket(date(11).getTime(), 'day', locale)).toBe(date(11).toLocaleDateString(locale, { day: 'numeric', month: 'short' }));
      expect(formatChartBucket(date(1).getTime(), 'month', locale)).toContain('2026');
    }
  });

  it('creates finite clock paths for zero and populated hours with increasing radius', () => {
    const empty = getClockSegmentPath(0, 0, 0);
    expect(empty).not.toMatch(/NaN|Infinity/);
    expect(empty).toContain('A55,55');
    const full = getClockSegmentPath(23, 120, 120);
    expect(full).toContain('A98,98');
    expect(full).not.toMatch(/NaN|Infinity/);
    expect(full.endsWith(' Z')).toBe(true);
  });
});
