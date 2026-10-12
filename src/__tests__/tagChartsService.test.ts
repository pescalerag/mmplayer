import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import { ActivityChartsService } from '../services/ActivityChartsService';
import { EMPTY_CHART_STATS, getChartTotals } from '../utils/activityCharts';

describe('tag chart queries', () => {
  const now = new Date(2026, 9, 12, 12);
  const first = new Date(2026, 9, 10, 8);
  const fetch = jest.fn();
  const query = jest.fn(() => ({ fetch }));
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockReset().mockResolvedValueOnce([{ playedAt: first }]).mockResolvedValue([{ playedAt: first, durationPlayed: 120 }]);
    (database.collections.get as jest.Mock).mockReturnValue({ query });
  });

  it.each(['track', 'album'] as const)('uses only captured %s assignments and never the current library tags', async scope => {
    const stats = await ActivityChartsService.getStats(null, now, now, undefined, { tagId: 'rock', scope });
    const clauses = [Q.where('item_type', 'track'), Q.where('tags_captured', true), Q.on('playback_history_tags', [Q.where('tag_id', 'rock'), Q.where('scope', scope)])];
    expect(query).toHaveBeenNthCalledWith(1, ...clauses, Q.where('played_at', Q.lte(now.getTime())), Q.sortBy('played_at', Q.asc), Q.take(1));
    expect(query).toHaveBeenLastCalledWith(...clauses, Q.where('played_at', Q.gte(new Date(2026, 9, 10).getTime())), Q.where('played_at', Q.lte(now.getTime())));
    expect(stats.dayCount).toBe(3);
    expect(stats.averageMinutes).toBeCloseTo(2 / 3);
    expect(stats.firstHistoryDate).toEqual(first);
    expect(getChartTotals(stats.hours)).toEqual({ seconds: 120, plays: 1 });
    expect(database.collections.get).toHaveBeenCalledTimes(2);
    expect(database.collections.get).toHaveBeenCalledWith('playback_history');
  });

  it('returns empty tag stats when no captured history exists without reassigning old listens', async () => {
    fetch.mockReset().mockResolvedValueOnce([]);
    expect(await ActivityChartsService.getStats(null, now, now, undefined, { tagId: 'rock', scope: 'track' })).toEqual({ ...EMPTY_CHART_STATS, firstHistoryDate: null });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('clamps the range to the first captured listen and now', async () => {
    const stats = await ActivityChartsService.getStats(new Date(2026, 9, 1), new Date(2026, 9, 31), now, undefined, { tagId: 'rock', scope: 'track' });
    expect(stats.dayCount).toBe(3);
    expect(stats.days[0].key).toBe(new Date(2026, 9, 10).getTime());
    expect(stats.days.at(-1)?.key).toBe(new Date(2026, 9, 12).getTime());
  });

  it('propagates captured-history failures for the shared retry UI', async () => {
    fetch.mockReset().mockRejectedValueOnce(new Error('snapshot unavailable'));
    await expect(ActivityChartsService.getStats(null, now, now, undefined, { tagId: 'rock', scope: 'album' })).rejects.toThrow('snapshot unavailable');
  });
});
