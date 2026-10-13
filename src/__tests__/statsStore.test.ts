import { HistoryService } from '../services/HistoryService';
import { useStatsStore } from '../store/useStatsStore';

jest.mock('../services/HistoryService', () => ({ HistoryService: { getWeeklyStats: jest.fn() } }));

it('keeps previous weekly statistics visible while refreshing and after a failed refresh', async () => {
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
  const stats = { totalHours: 12, topArtist: 'Artist', topArtistId: 'a', topArtistImg: null, topArtistDuration: 10,
    topAlbum: 'Album', topAlbumId: 'b', topAlbumImg: null, topAlbumDuration: 9,
    topSong: 'Song', topSongId: 'c', topSongImg: null, topSongArtist: 'Artist', topSongDuration: 8 };
  try {
    (HistoryService.getWeeklyStats as jest.Mock).mockResolvedValueOnce(stats);
    const first = useStatsStore.getState().fetchStats();
    expect(useStatsStore.getState().isLoading).toBe(true);
    await first;
    expect(useStatsStore.getState()).toMatchObject({ ...stats, isLoading: false });
    (HistoryService.getWeeklyStats as jest.Mock).mockRejectedValueOnce(new Error('Database unavailable'));
    const refresh = useStatsStore.getState().fetchStats();
    expect(useStatsStore.getState()).toMatchObject({ ...stats, isLoading: false });
    await refresh;
    expect(useStatsStore.getState()).toMatchObject({ ...stats, isLoading: false });
    expect(errorLog).toHaveBeenCalled();
  } finally { errorLog.mockRestore(); }
});
