import {
  calculateDateRangeInfo,
  getAllRange,
  getCustomRange,
  getYearRange,
  getMonthRange,
  getWeekRange,
  getDayRange,
} from '../screens/activity/utils/activityDateUtils';
import {
  formatDuration,
  getSectionLabel,
  getHighlightStatLabel,
  getSongHighlightStatLabel,
  getDisplayStats,
  getVisibleSmartLists,
  EMPTY_DETAILED_STATS,
} from '../screens/activity/utils/activityStatUtils';

describe('activityDateUtils', () => {
  const dummyT = (key: string) => key;

  test('getAllRange returns full range', () => {
    const now = new Date(2026, 9, 2);
    const range = getAllRange(now, dummyT);
    expect(range.from).toBeNull();
    expect(range.to).toEqual(now);
    expect(range.canGoPrev).toBe(false);
    expect(range.canGoNext).toBe(false);
  });

  test('getCustomRange formats dates', () => {
    const from = new Date(2026, 0, 15);
    const to = new Date(2026, 1, 20);
    const range = getCustomRange(from, to, 'es-ES');
    expect(range.from).toEqual(from);
    expect(range.to).toEqual(to);
    expect(range.canGoPrev).toBe(false);
    expect(range.canGoNext).toBe(false);
    expect(range.label).toContain('–');
  });

  test('getYearRange calculates correct bounds', () => {
    const now = new Date(2026, 5, 1);
    const firstDate = new Date(2024, 0, 1);
    const range = getYearRange(now, 0, firstDate);
    expect(range.label).toBe('2026');
    expect(range.canGoNext).toBe(false);
    expect(range.canGoPrev).toBe(true);

    const prevYearRange = getYearRange(now, -1, firstDate);
    expect(prevYearRange.label).toBe('2025');
    expect(prevYearRange.canGoNext).toBe(true);
    expect(prevYearRange.canGoPrev).toBe(true);
  });

  test('getMonthRange calculates correct bounds', () => {
    const now = new Date(2026, 5, 15);
    const firstDate = new Date(2026, 0, 1);
    const range = getMonthRange(now, 0, firstDate, 'es-ES');
    expect(range.canGoNext).toBe(false);
    expect(range.canGoPrev).toBe(true);
  });

  test('getWeekRange and getDayRange', () => {
    const now = new Date(2026, 9, 2);
    const firstDayStart = new Date(2026, 8, 1);
    const weekRange = getWeekRange(now, 0, firstDayStart, 'es-ES');
    expect(weekRange.canGoNext).toBe(false);

    const dayRange = getDayRange(now, 0, firstDayStart, 'es-ES', dummyT);
    expect(dayRange.canGoNext).toBe(false);
    expect(dayRange.canGoPrev).toBe(true);
  });

  test('calculateDateRangeInfo handles all periods', () => {
    const firstDate = new Date(2025, 0, 1);
    expect(calculateDateRangeInfo('all', 0, firstDate, null, new Date(), dummyT).label).toBe('activity.all_activity');
    expect(calculateDateRangeInfo('year', 0, firstDate, null, new Date(), dummyT).canGoPrev).toBe(true);
  });
});

describe('activityStatUtils', () => {
  const dummyT = (key: string, opts?: any) => {
    if (opts?.count !== undefined) return `${opts.count} plays`;
    if (opts?.time !== undefined) return opts.time;
    return key;
  };

  test('formatDuration formats zero, minutes, and hours', () => {
    expect(formatDuration(0, dummyT)).toBe('0 activity.min_suffix');
    expect(formatDuration(180, dummyT)).toBe('3 activity.min_suffix');
    expect(formatDuration(7200, dummyT)).toBe('2.0 activity.hour_suffix');
  });

  test('getSectionLabel handles today, week, month, and year', () => {
    expect(getSectionLabel('day', 0, 'Hoy', dummyT)).toBe('activity.today_highlights');
    expect(getSectionLabel('week', 0, 'Semana', dummyT)).toBe('activity.week_highlights');
    expect(getSectionLabel('all', 0, 'Toda', dummyT)).toBe('activity.global_highlights');
    expect(getSectionLabel('day', -1, 'Ayer', dummyT)).toContain('Ayer');
  });

  test('getHighlightStatLabel and getSongHighlightStatLabel', () => {
    expect(getHighlightStatLabel('duration', 3600, 10, dummyT)).toBe('1.0 activity.hour_suffix');
    expect(getHighlightStatLabel('plays', 3600, 10, dummyT)).toBe('10 plays');

    const songLabel = getSongHighlightStatLabel('duration', 'Artist', 120, 2, dummyT);
    expect(songLabel).toContain('Artist');
  });

  test('getDisplayStats returns mock stats when tutorial visible without real activity', () => {
    const stats = getDisplayStats(EMPTY_DETAILED_STATS, false, true);
    expect(stats.topSong).toBe('Midnight City');

    const realStats = getDisplayStats(
      {
        totalHours: 5,
        totalPlays: 20,
        topSongs: [{ id: '1', title: 'Test Song' }],
        topAlbums: [],
        topArtists: [],
      },
      true,
      false
    );
    expect(realStats.topSong).toBe('Test Song');
  });

  test('getVisibleSmartLists filters correctly', () => {
    const lists = [
      { id: 'top_50', name: 'Global', placeholderIcon: 'star', trackCount: 50 },
      { id: 'top_50_week', name: 'Weekly', placeholderIcon: 'trending-up', trackCount: 30 },
    ];
    const visible = getVisibleSmartLists(lists, 'week', 0, false);
    expect(visible).toHaveLength(2);
  });
});
