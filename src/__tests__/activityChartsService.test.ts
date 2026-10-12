import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import { ActivityChartsService } from '../services/ActivityChartsService';

describe('ActivityChartsService', () => {
  const now = new Date(2026, 9, 11, 12);
  const from = new Date(2026, 9, 1);
  const fetch = jest.fn();
  const query = jest.fn(() => ({ fetch }));
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockResolvedValue([{ playedAt: new Date(2026, 9, 2, 8), durationPlayed: 600 }]);
    (database.collections.get as jest.Mock).mockReturnValue({ query });
  });

  it('queries only track listens within the range capped to now', async () => {
    const stats = await ActivityChartsService.getStats(from, new Date(2026, 9, 31), now);
    expect(database.collections.get).toHaveBeenCalledWith('playback_history');
    expect(query).toHaveBeenCalledWith(Q.where('item_type', 'track'), Q.where('played_at', Q.lte(now.getTime())), Q.where('played_at', Q.gte(from.getTime())));
    expect(stats.dayCount).toBe(11);
    expect(stats.averageMinutes).toBeCloseTo(10 / 11);
    expect(stats.hours[8].plays).toBe(1);
    expect(database.collections.get).toHaveBeenCalledTimes(1);
  });

  it('queries all-time without a lower bound and starts on the first listen', async () => {
    const stats = await ActivityChartsService.getStats(null, now, now);
    expect(query).toHaveBeenCalledWith(Q.where('item_type', 'track'), Q.where('played_at', Q.lte(now.getTime())));
    expect(stats.dayCount).toBe(10);
  });

  it('keeps the selected historical upper boundary', async () => {
    const to = new Date(2026, 9, 3, 23, 59);
    expect((await ActivityChartsService.getStats(from, to, now)).dayCount).toBe(3);
    expect(query).toHaveBeenCalledWith(expect.anything(), Q.where('played_at', Q.lte(to.getTime())), expect.anything());
  });

  it('uses current time by default', async () => {
    jest.useFakeTimers().setSystemTime(now);
    try { expect((await ActivityChartsService.getStats(from, new Date(2026, 9, 31))).dayCount).toBe(11); }
    finally { jest.useRealTimers(); }
  });

  it('propagates database failures so the screen can show retry instead of misleading empty data', async () => {
    fetch.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(ActivityChartsService.getStats(from, now, now)).rejects.toThrow('database unavailable');
  });
});
