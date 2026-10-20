import { Subject } from 'rxjs';
import { database } from '../database';
import { calculateSmartListCounts, SmartListSummaryService } from '../services/SmartListSummaryService';

it('preserves rating interval boundaries and counts distinct existing songs in the top 50', () => {
    const counts = calculateSmartListCounts([
        { id: 'a', rating: 2 }, { id: 'b', rating: 5 }, { id: 'c', rating: null },
    ], [
        { itemId: 'a', durationPlayed: 100, playedAt: new Date(100) },
        { itemId: 'a', durationPlayed: 200, playedAt: new Date(200) },
        { itemId: 'b', durationPlayed: 50, playedAt: new Date(300) },
        { itemId: 'deleted', durationPlayed: 500, playedAt: new Date(300) },
    ], 250, 150);
    expect(counts).toMatchObject({ rating_1_2: 1, rating_2_3: 1, rating_4_5: 1, rating_5: 1, rating_unrated: 1, top_50: 2, top_50_week: 1, top_50_month: 2 });
});

it('shares two reads across screens and invalidates counts on existing-record updates', async () => {
    const trackWrites = new Subject(); const historyWrites = new Subject();
    const tracks = [{ id: 'a', rating: 4 }];
    const history = [{ itemId: 'a', durationPlayed: 20, playedAt: new Date() }];
    const fetchTracks = jest.fn(async () => tracks), fetchHistory = jest.fn(async () => history);
    (database.get as jest.Mock).mockImplementation(table => ({
        changes: table === 'tracks' ? trackWrites : historyWrites,
        query: () => ({ fetch: table === 'tracks' ? fetchTracks : fetchHistory }),
    }));
    const first = await Promise.all([SmartListSummaryService.get(), SmartListSummaryService.get()]);
    expect(first[0].find(list => list.id === 'rating_5')?.trackCount).toBe(0);
    expect(fetchTracks).toHaveBeenCalledTimes(1); expect(fetchHistory).toHaveBeenCalledTimes(1);
    await SmartListSummaryService.get(); expect(fetchTracks).toHaveBeenCalledTimes(1);
    tracks[0].rating = 5; trackWrites.next([{ type: 'updated' }]);
    const changed = await SmartListSummaryService.get();
    expect(changed.find(list => list.id === 'rating_5')?.trackCount).toBe(1);
    history[0].playedAt = new Date(0); historyWrites.next([{ type: 'updated' }]);
    const moved = await SmartListSummaryService.get();
    expect(moved.find(list => list.id === 'top_50_week')?.trackCount).toBe(0);
    expect(fetchHistory).toHaveBeenCalledTimes(3);
});
