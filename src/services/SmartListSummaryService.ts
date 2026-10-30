import { database } from '../database';
import Track from '../database/models/Track';
import PlaybackHistory from '../database/models/PlaybackHistory';
import { ObservedResource } from '../utils/observedResource';
import { observeTableChanges } from './ScreenDataChanges';
import { HistoryService } from './HistoryService';
import { SmartListService } from './SmartListService';

export function calculateSmartListCounts(
    tracks: readonly { id: string; rating?: number | null }[],
    history: readonly { itemId: string; durationPlayed: number | null; playedAt: Date }[],
    weekStart: number, monthStart: number, yearStart: number,
): Record<string, number> {
    const result: Record<string, number> = { rating_unrated: 0, rating_1_2: 0, rating_2_3: 0, rating_3_4: 0, rating_4_5: 0, rating_5: 0 };
    const ids = new Set(tracks.map(track => track.id));
    for (const track of tracks) {
        const rating = track.rating || 0;
        if (!rating) result.rating_unrated++;
        if ([1, 1.5, 2].includes(rating)) result.rating_1_2++;
        if ([2, 2.5, 3].includes(rating)) result.rating_2_3++;
        if ([3, 3.5, 4].includes(rating)) result.rating_3_4++;
        if ([4, 4.5, 5].includes(rating)) result.rating_4_5++;
        if (rating === 5) result.rating_5++;
    }
    for (const [key, since] of [['top_50', 0], ['top_50_week', weekStart], ['top_50_month', monthStart], ['top_50_year', yearStart]] as const) {
        result[key] = countTopTracks(history, ids, since);
    }
    return result;
}

function countTopTracks(history: readonly { itemId: string; durationPlayed: number | null; playedAt: Date }[], ids: ReadonlySet<string>, since: number) {
    const totals = new Map<string, number>();
    for (const record of history) {
        if (record.playedAt.getTime() >= since) totals.set(record.itemId, (totals.get(record.itemId) || 0) + (record.durationPlayed || 0));
    }
    return [...totals].sort((a, b) => b[1] - a[1]).slice(0, 50).filter(([id]) => ids.has(id)).length;
}

const resource = new ObservedResource<Record<string, number>>(() => observeTableChanges(['tracks', 'playback_history']), 1);

export const SmartListSummaryService = {
    async get() {
        const counts = await resource.load(new Date().toDateString(), async () => {
            const [tracks, history] = await Promise.all([
                database.get<Track>('tracks').query().fetch(),
                database.get<PlaybackHistory>('playback_history').query().fetch(),
            ]);
            return calculateSmartListCounts(tracks, history,
                HistoryService.getPeriodRange('week').from?.getTime() || 0,
                HistoryService.getPeriodRange('month').from?.getTime() || 0,
                HistoryService.getPeriodRange('year').from?.getTime() || 0);
        });
        return SmartListService.getSmartLists().map(list => ({ ...list, trackCount: counts[list.id] || 0 }));
    },
};
