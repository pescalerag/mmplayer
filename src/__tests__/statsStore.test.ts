import { Subject } from 'rxjs';
import { database } from '../database';
import { HistoryService } from '../services/HistoryService';
import { useStatsStore } from '../store/useStatsStore';

jest.mock('../services/HistoryService', () => ({ HistoryService: { getWeeklyStats: jest.fn() } }));

it('keeps previous weekly statistics visible while refreshing and after a failed refresh', async () => {
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
  const stats = { totalHours: 12, topArtist: 'Artist', topArtistId: 'a', topArtistImg: null, topArtistDuration: 10,
    topAlbum: 'Album', topAlbumId: 'b', topAlbumImg: null, topAlbumDuration: 9,
    topSong: 'Song', topSongId: 'c', topSongImg: null, topSongArtist: 'Artist', topSongDuration: 8 };
  const writes = new Subject();
  (database.get as jest.Mock).mockReturnValue({ changes: writes });
  try {
    (HistoryService.getWeeklyStats as jest.Mock).mockResolvedValueOnce(stats);
    const first = useStatsStore.getState().fetchStats();
    expect(useStatsStore.getState().isLoading).toBe(true);
    await first;
    expect(useStatsStore.getState()).toMatchObject({ ...stats, isLoading: false });
    await useStatsStore.getState().fetchStats();
    expect(HistoryService.getWeeklyStats).toHaveBeenCalledTimes(1);
    writes.next([{ type: 'updated' }]);
    (HistoryService.getWeeklyStats as jest.Mock).mockRejectedValueOnce(new Error('Database unavailable'));
    const refresh = useStatsStore.getState().fetchStats();
    expect(useStatsStore.getState()).toMatchObject({ ...stats, isLoading: false });
    await refresh;
    expect(useStatsStore.getState()).toMatchObject({ ...stats, isLoading: false });
    expect(errorLog).toHaveBeenCalled();
  } finally { errorLog.mockRestore(); }
});
