import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import { ActivityChartsService } from '../services/ActivityChartsService';
import { EMPTY_CHART_STATS, getChartTotals } from '../utils/activityCharts';

describe('artist chart history', () => {
  const now = new Date(2026, 9, 11, 12);
  const first = new Date(2026, 9, 4, 8);
  const listen = { itemId: 'shared-track', playedAt: first, durationPlayed: 600 };
  const fetchIds = jest.fn();
  const fetch = jest.fn();
  const tracksQuery = jest.fn(() => ({ fetchIds }));
  const historyQuery = jest.fn(() => ({ fetch }));
  beforeEach(() => {
    jest.clearAllMocks();
    fetchIds.mockResolvedValue(['shared-track']);
    fetch.mockReset().mockResolvedValueOnce([listen]).mockResolvedValue([listen]);
    (database.collections.get as jest.Mock).mockImplementation(table => table === 'tracks' ? { query: tracksQuery } : { query: historyQuery });
  });

  it('filters by collaborations and counts the complete listen regardless of playback context', async () => {
    const stats = await ActivityChartsService.getStats(null, now, now, 'artist-a');
    expect(tracksQuery).toHaveBeenCalledWith(Q.on('track_collaborators', 'artist_id', 'artist-a'));
    expect(historyQuery).toHaveBeenNthCalledWith(1, Q.where('item_type', 'track'), Q.where('item_id', Q.oneOf(['shared-track'])), Q.where('played_at', Q.lte(now.getTime())), Q.sortBy('played_at', Q.asc), Q.take(1));
    expect(stats.firstHistoryDate).toEqual(first);
    expect(stats.dayCount).toBe(8);
    expect(stats.averageMinutes).toBe(10 / 8);
    expect(getChartTotals(stats.hours)).toEqual({ seconds: 600, plays: 1 });
    const collaborator = await ActivityChartsService.getStats(null, now, now, 'artist-b');
    expect(getChartTotals(collaborator.hours)).toEqual({ seconds: 600, plays: 1 });
    expect(tracksQuery).toHaveBeenLastCalledWith(Q.on('track_collaborators', 'artist_id', 'artist-b'));
  });

  it('starts averages at the first artist listen when the period begins earlier', async () => {
    const stats = await ActivityChartsService.getStats(new Date(2026, 9, 1), new Date(2026, 9, 31), now, 'artist-a');
    expect(stats.dayCount).toBe(8);
    expect(historyQuery).toHaveBeenLastCalledWith(Q.where('item_type', 'track'), Q.where('item_id', Q.oneOf(['shared-track'])), Q.where('played_at', Q.gte(new Date(2026, 9, 4).getTime())), Q.where('played_at', Q.lte(now.getTime())));
  });

  it('keeps silent periods after the first artist listen and their zero averages', async () => {
    fetch.mockReset().mockResolvedValueOnce([listen]).mockResolvedValueOnce([]);
    const from = new Date(2026, 9, 7);
    const to = new Date(2026, 9, 9, 23, 59);
    const stats = await ActivityChartsService.getStats(from, to, now, 'artist-a');
    expect(stats.dayCount).toBe(3);
    expect(stats.averageMinutes).toBe(0);
    expect(stats.averagePlays).toBe(0);
    expect(stats.firstHistoryDate).toEqual(first);
    expect(stats.days.map(day => day.plays)).toEqual([0, 0, 0]);
    expect(historyQuery).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), Q.where('played_at', Q.gte(from.getTime())), Q.where('played_at', Q.lte(to.getTime())));
  });

  it('returns no history without querying listens when the artist has no tracks', async () => {
    fetchIds.mockResolvedValueOnce([]);
    expect(await ActivityChartsService.getStats(null, now, now, 'artist-a')).toEqual({ ...EMPTY_CHART_STATS, firstHistoryDate: null });
    expect(historyQuery).not.toHaveBeenCalled();
  });

  it('returns an empty result for an artist with tracks but no recorded listens', async () => {
    fetch.mockReset().mockResolvedValueOnce([]);
    expect(await ActivityChartsService.getStats(null, now, now, 'artist-a')).toEqual({ ...EMPTY_CHART_STATS, firstHistoryDate: null });
    expect(historyQuery).toHaveBeenCalledTimes(1);
  });

  it('does not create daily buckets before the artist first listen', async () => {
    fetch.mockReset().mockResolvedValueOnce([listen]).mockResolvedValueOnce([]);
    const stats = await ActivityChartsService.getStats(new Date(2026, 9, 1), new Date(2026, 9, 2), now, 'artist-a');
    expect(stats.days).toEqual([]);
    expect(stats.averageMinutes).toBe(0);
  });

  it('propagates track and first-listen query errors for retry', async () => {
    fetchIds.mockRejectedValueOnce(new Error('tracks unavailable'));
    await expect(ActivityChartsService.getStats(null, now, now, 'artist-a')).rejects.toThrow('tracks unavailable');
    fetch.mockReset().mockRejectedValueOnce(new Error('history unavailable'));
    await expect(ActivityChartsService.getStats(null, now, now, 'artist-a')).rejects.toThrow('history unavailable');
  });
});
