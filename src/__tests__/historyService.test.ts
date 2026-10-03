import { HistoryService } from '../services/HistoryService';
import { database } from '../database';

describe('HistoryService - Stats Calculation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getWeeklyStats', () => {
    it('delegates to getStatsForPeriod with week and duration parameters', async () => {
      const spy = jest.spyOn(HistoryService, 'getStatsForPeriod').mockResolvedValueOnce({
        totalHours: 5.5,
        totalPlays: 10,
        topArtist: 'Artist A',
        topArtistId: 'art_1',
        topArtistImg: 'https://example.com/art.jpg',
        topArtistDuration: 3600,
        topArtistPlays: 5,
        topAlbum: 'Album B',
        topAlbumId: 'alb_1',
        topAlbumImg: 'https://example.com/alb.jpg',
        topAlbumDuration: 2400,
        topAlbumPlays: 4,
        topSong: 'Song C',
        topSongId: 'track_1',
        topSongImg: 'https://example.com/alb.jpg',
        topSongArtist: 'Artist A',
        topSongDuration: 1200,
        topSongPlays: 2,
      });

      const stats = await HistoryService.getWeeklyStats();

      expect(spy).toHaveBeenCalledWith('week', 'duration');
      expect(stats.totalHours).toBe(5.5);
      expect(stats.topArtist).toBe('Artist A');
      expect(stats.topAlbum).toBe('Album B');
      expect(stats.topSong).toBe('Song C');
      expect(stats.topSongArtist).toBe('Artist A');
    });

    it('returns empty defaults when there are no playback records', async () => {
      const stats = await HistoryService.getWeeklyStats();

      expect(stats).toEqual({
        totalHours: 0,
        totalPlays: 0,
        topArtist: '',
        topArtistId: '',
        topArtistImg: null,
        topArtistDuration: 0,
        topArtistPlays: 0,
        topAlbum: '',
        topAlbumId: '',
        topAlbumImg: null,
        topAlbumDuration: 0,
        topAlbumPlays: 0,
        topSong: '',
        topSongId: '',
        topSongImg: null,
        topSongArtist: '',
        topSongDuration: 0,
        topSongPlays: 0,
      });
    });
  });

  describe('hasHistoryInRange', () => {
    it('returns true when records exist in range', async () => {
      (database.collections.get as jest.Mock).mockReturnValue({
        query: jest.fn().mockReturnValue({
          fetchCount: jest.fn().mockResolvedValue(5),
        }),
      });

      const result = await HistoryService.hasHistoryInRange(new Date(2026, 0, 1), new Date(2026, 0, 7));
      expect(result).toBe(true);
    });

    it('returns false when no records exist in range', async () => {
      (database.collections.get as jest.Mock).mockReturnValue({
        query: jest.fn().mockReturnValue({
          fetchCount: jest.fn().mockResolvedValue(0),
        }),
      });

      const result = await HistoryService.hasHistoryInRange(new Date(2026, 0, 1), new Date(2026, 0, 7));
      expect(result).toBe(false);
    });

    it('returns false when an error occurs', async () => {
      (database.collections.get as jest.Mock).mockReturnValue({
        query: jest.fn().mockReturnValue({
          fetchCount: jest.fn().mockRejectedValue(new Error('DB error')),
        }),
      });

      const result = await HistoryService.hasHistoryInRange(new Date(2026, 0, 1), new Date(2026, 0, 7));
      expect(result).toBe(false);
    });
  });

  describe('getPeriodRange', () => {
    it('calculates boundaries for day, week, month, year, and all', () => {
      const allRange = HistoryService.getPeriodRange('all');
      expect(allRange.from).toBeNull();
      expect(allRange.to).toBeInstanceOf(Date);

      const dayRange = HistoryService.getPeriodRange('day');
      expect(dayRange.from).toBeInstanceOf(Date);
      expect(dayRange.from?.getHours()).toBe(0);

      const weekRange = HistoryService.getPeriodRange('week');
      expect(weekRange.from).toBeInstanceOf(Date);
      expect(weekRange.to).toBeInstanceOf(Date);
      expect(weekRange.from!.getTime()).toBeLessThan(weekRange.to.getTime());

      const monthRange = HistoryService.getPeriodRange('month');
      expect(monthRange.from?.getDate()).toBe(1);

      const yearRange = HistoryService.getPeriodRange('year');
      expect(yearRange.from?.getMonth()).toBe(0);
      expect(yearRange.from?.getDate()).toBe(1);
    });
  });

  describe('Stats calculations with history records', () => {
    const mockHistoryRecords = [
      { itemId: 'track-1', durationPlayed: 200 },
      { itemId: 'track-1', durationPlayed: 100 },
      { itemId: 'track-2', durationPlayed: 50 },
    ];

    const mockArtist = { id: 'artist-1', name: 'Rock Band', imageUrl: 'https://art.jpg' };
    const mockAlbum = { id: 'album-1', title: 'Great Album', coverUrl: 'https://cover.jpg' };

    const mockTracks = [
      {
        id: 'track-1',
        title: 'Song One',
        artist: { fetch: jest.fn().mockResolvedValue(mockArtist) },
        album: { fetch: jest.fn().mockResolvedValue(mockAlbum) },
      },
      {
        id: 'track-2',
        title: 'Song Two',
        artist: { fetch: jest.fn().mockResolvedValue(mockArtist) },
        album: { fetch: jest.fn().mockResolvedValue(mockAlbum) },
      },
    ];

    beforeEach(() => {
      (database.collections.get as jest.Mock).mockImplementation((collectionName: string) => {
        if (collectionName === 'playback_history') {
          return {
            query: jest.fn().mockReturnValue({
              fetch: jest.fn().mockResolvedValue(mockHistoryRecords),
            }),
          };
        }
        if (collectionName === 'tracks') {
          return {
            query: jest.fn().mockReturnValue({
              fetch: jest.fn().mockResolvedValue(mockTracks),
            }),
          };
        }
        return {
          query: jest.fn().mockReturnValue({ fetch: jest.fn().mockResolvedValue([]) }),
        };
      });
    });

    it('getStatsForPeriod calculates top artist, album, and song by duration', async () => {
      const stats = await HistoryService.getStatsForPeriod('week', 'duration');
      expect(stats.totalHours).toBeCloseTo(350 / 3600);
      expect(stats.totalPlays).toBe(3);
      expect(stats.topSong).toBe('Song One');
      expect(stats.topArtist).toBe('Rock Band');
      expect(stats.topAlbum).toBe('Great Album');
    });

    it('getStatsForPeriod calculates top items by plays metric', async () => {
      const stats = await HistoryService.getStatsForPeriod('month', 'plays');
      expect(stats.totalPlays).toBe(3);
      expect(stats.topSong).toBe('Song One');
      expect(stats.topSongPlays).toBe(2);
    });

    it('getDetailedStatsForPeriod returns ranked lists of songs, albums, and artists', async () => {
      const detailed = await HistoryService.getDetailedStatsForPeriod('week', 'duration');
      expect(detailed.topSongs).toHaveLength(2);
      expect(detailed.topSongs[0].title).toBe('Song One');
      expect(detailed.topSongs[0].duration).toBe(300);
      expect(detailed.topAlbums).toHaveLength(1);
      expect(detailed.topAlbums[0].title).toBe('Great Album');
      expect(detailed.topArtists).toHaveLength(1);
      expect(detailed.topArtists[0].name).toBe('Rock Band');
    });
  });

  describe('getDetailedStatsForPeriod edge cases', () => {
    it('returns empty lists and zero totals when no history records exist', async () => {
      (database.collections.get as jest.Mock).mockReturnValue({
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue([]),
        }),
      });

      const stats = await HistoryService.getDetailedStatsForPeriod('week', 'duration');
      expect(stats).toEqual({
        totalHours: 0,
        totalPlays: 0,
        topSongs: [],
        topAlbums: [],
        topArtists: [],
      });
    });

    it('clamps custom date ranges correctly when customTo is in the future or customFrom > customTo', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() + 5);

      const stats = await HistoryService.getDetailedStatsForPeriod('custom', 'plays', fromDate, futureDate);
      expect(stats.topSongs).toEqual([]);
      expect(stats.totalHours).toBe(0);
      expect(stats.totalPlays).toBe(0);
    });

    it('clamps customFrom to first history date if earlier', async () => {
      const firstDate = new Date('2026-01-15T12:00:00Z');
      jest.spyOn(HistoryService, 'getFirstHistoryDate').mockResolvedValueOnce(firstDate);

      const veryOldDate = new Date('2020-01-01T00:00:00Z');
      const toDate = new Date('2026-01-20T00:00:00Z');

      const stats = await HistoryService.getDetailedStatsForPeriod('custom', 'duration', veryOldDate, toDate);
      expect(stats.totalHours).toBe(0);
      expect(stats.topArtists).toEqual([]);
    });
  });
});
