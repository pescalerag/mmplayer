import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import PlaybackHistory from '../database/models/PlaybackHistory';
import Track from '../database/models/Track';
import { calculateActivityCharts, ActivityChartStats, EMPTY_CHART_STATS, startOfChartDay } from '../utils/activityCharts';

export interface ActivityChartResult extends ActivityChartStats {
  firstHistoryDate?: Date | null;
}

async function getArtistHistoryScope(artistId: string, now: Date) {
  const trackIds = await database.collections.get<Track>('tracks')
    .query(Q.on('track_collaborators', 'artist_id', artistId)).fetchIds();
  const clauses = [Q.where('item_type', 'track'), Q.where('item_id', Q.oneOf(trackIds))];
  if (trackIds.length === 0) return { clauses, firstHistoryDate: null };
  const records = await database.collections.get<PlaybackHistory>('playback_history')
    .query(...clauses, Q.where('played_at', Q.lte(now.getTime())), Q.sortBy('played_at', Q.asc), Q.take(1)).fetch();
  return { clauses, firstHistoryDate: records[0]?.playedAt ?? null };
}

async function getArtistStats(artistId: string, from: Date | null, end: Date, now: Date): Promise<ActivityChartResult> {
  const { clauses, firstHistoryDate } = await getArtistHistoryScope(artistId, now);
  if (!firstHistoryDate) return { ...EMPTY_CHART_STATS, firstHistoryDate };
  const firstDay = startOfChartDay(firstHistoryDate);
  const start = new Date(Math.max(from?.getTime() ?? firstDay.getTime(), firstDay.getTime()));
  const records = await database.collections.get<PlaybackHistory>('playback_history')
    .query(...clauses, Q.where('played_at', Q.gte(start.getTime())), Q.where('played_at', Q.lte(end.getTime()))).fetch();
  return { ...calculateActivityCharts(records, start, end, now), firstHistoryDate };
}

export const ActivityChartsService = {
  async getStats(from: Date | null, to: Date, now: Date = new Date(), artistId?: string): Promise<ActivityChartResult> {
    const end = new Date(Math.min(to.getTime(), now.getTime()));
    if (artistId !== undefined) return getArtistStats(artistId, from, end, now);
    const clauses = [Q.where('item_type', 'track'), Q.where('played_at', Q.lte(end.getTime()))];
    if (from) clauses.push(Q.where('played_at', Q.gte(from.getTime())));
    const records = await database.collections.get<PlaybackHistory>('playback_history').query(...clauses).fetch();
    return calculateActivityCharts(records, from, end, now);
  },
};
