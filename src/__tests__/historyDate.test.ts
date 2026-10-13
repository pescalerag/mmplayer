import { HistoryService } from '../services/HistoryService';
import { database } from '../database';

afterEach(() => jest.restoreAllMocks());

it('returns the earliest playback date and ignores missing or empty dates', async () => {
  const fetch = jest.fn().mockResolvedValueOnce([{ playedAt: new Date(2026, 0, 3) }]).mockResolvedValueOnce([]).mockResolvedValueOnce([{}]);
  (database.collections.get as jest.Mock).mockReturnValue({ query: () => ({ fetch }) });
  expect(await HistoryService.getFirstHistoryDate()).toEqual(new Date(2026, 0, 3));
  expect(await HistoryService.getFirstHistoryDate()).toBeNull();
  expect(await HistoryService.getFirstHistoryDate()).toBeNull();
});

it('returns no history date after a database failure', async () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  (database.collections.get as jest.Mock).mockReturnValue({ query: () => ({ fetch: async () => { throw Error('Unavailable'); } }) });
  expect(await HistoryService.getFirstHistoryDate()).toBeNull();
  expect(error).toHaveBeenCalled();
});
