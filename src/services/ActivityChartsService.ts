import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import PlaybackHistory from '../database/models/PlaybackHistory';
import { calculateActivityCharts, ActivityChartStats } from '../utils/activityCharts';

export const ActivityChartsService = {
  async getStats(from: Date | null, to: Date, now: Date = new Date()): Promise<ActivityChartStats> {
    const end = new Date(Math.min(to.getTime(), now.getTime()));
    const clauses = [Q.where('item_type', 'track'), Q.where('played_at', Q.lte(end.getTime()))];
    if (from) clauses.push(Q.where('played_at', Q.gte(from.getTime())));
    const records = await database.collections.get<PlaybackHistory>('playback_history').query(...clauses).fetch();
    return calculateActivityCharts(records, from, end, now);
  },
};
