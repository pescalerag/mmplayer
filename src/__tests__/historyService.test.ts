import { HistoryService } from '../services/HistoryService';

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

  describe('getDetailedStatsForPeriod', () => {
    it('returns empty lists and zero totals when no history records exist', async () => {
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

