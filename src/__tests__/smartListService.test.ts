import { SmartListService } from '../services/SmartListService';
import { HistoryService } from '../services/HistoryService';
import { database } from '../database';
import i18n from '../constants/i18n';

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

it.each(['en', 'es', 'pt', ''])('builds localized lists for %s and queries each rating group', async language => {
  const results = [{ id: 'song' }];
  const query = jest.fn(() => ({ fetch: jest.fn().mockResolvedValue(results) }));
  (database.collections.get as jest.Mock).mockReturnValue({ query });
  const fixed = jest.spyOn(i18n, 'getFixedT');
  const range = jest.spyOn(HistoryService, 'getPeriodRange').mockReturnValue({ from: new Date(1000), to: new Date(2000) });
  const top = jest.spyOn(SmartListService, 'getTopTracksByDuration').mockResolvedValue(results as any);
  const lists = SmartListService.getSmartLists(language);
  expect(fixed).toHaveBeenCalledWith(language || 'es');
  expect(lists.every(list => list.name && list.description)).toBe(true);
  for (const list of lists) expect(await list.getTracks()).toEqual(results);
  expect(range).toHaveBeenCalledWith('week');
  expect(range).toHaveBeenCalledWith('month');
  expect(range).toHaveBeenCalledWith('year');
  expect(top).toHaveBeenCalledWith(50, new Date(1000));
  expect(top).toHaveBeenCalledWith(50);
  expect(query).toHaveBeenCalledTimes(lists.filter(list => list.group === 'rating').length);
});

it('uses the current calendar year and rolls over its title and listening range in January', async () => {
  jest.useFakeTimers();
  try {
    const top = jest.spyOn(SmartListService, 'getTopTracksByDuration').mockResolvedValue([]);
    for (const year of [2026, 2027]) {
      jest.setSystemTime(new Date(year, 0, 1, 12));
      const list = SmartListService.getSmartLists('es').find(item => item.id === 'top_50_year')!;
      expect(list.name).toBe(`Tu ${year}`);
      expect(list.description).toContain(String(year));
      expect(list.group).toBe('listening');
      await list.getTracks();
      expect(top).toHaveBeenLastCalledWith(50, new Date(year, 0, 1));
    }
  } finally {
    jest.useRealTimers();
  }
});

it('ranks by cumulative listening time and skips deleted tracks', async () => {
  const history = [{ itemId: 'a', durationPlayed: 10 }, { itemId: 'b', durationPlayed: 20 },
    { itemId: 'a', durationPlayed: 15 }, { itemId: 'deleted', durationPlayed: 50 }, { itemId: 'b', durationPlayed: null }];
  const historyQuery = jest.fn(() => ({ fetch: async () => history }));
  const tracksQuery = jest.fn(() => ({ fetch: async () => [{ id: 'b' }, { id: 'a' }] }));
  (database.collections.get as jest.Mock).mockImplementation(table => ({ query: table === 'tracks' ? tracksQuery : historyQuery }));
  expect(await SmartListService.getTopTracksByDuration(3, new Date(1000))).toEqual([{ id: 'a' }, { id: 'b' }]);
  expect(historyQuery.mock.calls[0]).toHaveLength(1);
  await SmartListService.getTopTracksByDuration();
  expect(historyQuery).toHaveBeenLastCalledWith();
});

it('returns no tracks when history is empty or cannot be read', async () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const fetch = jest.fn().mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('Database unavailable'));
  (database.collections.get as jest.Mock).mockReturnValue({ query: () => ({ fetch }) });
  expect(await SmartListService.getTopTracksByDuration()).toEqual([]);
  expect(await SmartListService.getTopTracksByDuration()).toEqual([]);
  expect(error).toHaveBeenCalled();
});

it('deduplicates and sorts genres, ignoring whitespace and absent metadata', async () => {
  const fetch = jest.fn().mockResolvedValueOnce([{ genre: ' Rock ' }, { genre: 'Jazz' }, { genre: 'Rock' }, { genre: ' ' }, {}])
    .mockResolvedValueOnce([{ id: 'jazz-song' }]);
  const query = jest.fn(() => ({ fetch }));
  (database.collections.get as jest.Mock).mockReturnValue({ query });
  const lists = await SmartListService.getGenreSmartLists();
  expect(lists.map(list => list.name)).toEqual(['Jazz', 'Rock']);
  expect(lists[0]).toMatchObject({ id: 'genre_Jazz', group: 'genre', genre: 'Jazz' });
  expect(await lists[0].getTracks()).toEqual([{ id: 'jazz-song' }]);
  expect(query.mock.calls[1]).toHaveLength(2);
});

it('returns no genre lists when the database is unavailable', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  (database.collections.get as jest.Mock).mockReturnValue({ query: () => ({ fetch: async () => { throw Error('Unavailable'); } }) });
  expect(await SmartListService.getGenreSmartLists()).toEqual([]);
});
