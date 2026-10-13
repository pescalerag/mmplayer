import { ScannerService } from '../services/ScannerService';
import { database } from '../database';
import { useSyncStore } from '../store/useSyncStore';
import { usePlayerStore } from '../store/usePlayerStore';

jest.mock('../store/usePlayerStore', () => {
  const state = { handleDeletedEntities: jest.fn().mockResolvedValue(undefined) };
  return { usePlayerStore: { getState: () => state } };
});

beforeEach(() => { jest.clearAllMocks(); useSyncStore.setState({ isScanning: false }); });
afterEach(() => jest.restoreAllMocks());

it('deletes only the exact folder and informs the player and targeted orphan cleanup', async () => {
  const model = (id: string, fileUrl: string) => ({ id, fileUrl, _raw: { album_id: 'album', artist_id: 'artist' }, prepareDestroyPermanently: () => ({ deleted: id }) });
  const song = model('song', 'file:///music/song.mp3');
  const nested = model('nested', 'file:///music/sub/song.mp3');
  const invalid = model('invalid', 'no-slash');
  const query = jest.fn((...clauses: any[]) => ({ fetch: async () => {
    const ids = clauses[0]?.comparison?.right?.values;
    return ids ? [song].filter(track => ids.includes(track.id)) : [song, nested, invalid];
  } }));
  (database.collections.get as jest.Mock).mockImplementation(table => table === 'tracks' ? { query } : { query: () => ({ fetch: async () => [] }) });
  const cleanup = jest.spyOn(ScannerService, 'cleanDeletedFiles').mockResolvedValue(undefined);
  const progress = jest.fn();
  await ScannerService.deleteFolderContents('file:///music', progress);
  expect(database.batch).toHaveBeenCalledWith([{ deleted: 'song' }]);
  expect(usePlayerStore.getState().handleDeletedEntities).toHaveBeenCalledWith(['song'], [], []);
  expect(cleanup).toHaveBeenCalledWith({ targetAlbumIds: ['album'], targetArtistIds: ['artist'], skipFileCheck: true }, progress);
  expect(useSyncStore.getState().isScanning).toBe(false);
});

it('does not start a second deletion during an active scan', async () => {
  useSyncStore.setState({ isScanning: true });
  await ScannerService.deleteFolderContents('file:///music');
  await ScannerService.deleteSongContents('file:///music/song');
  await ScannerService.deleteMultipleSongsContents(['file:///music/song']);
  expect(database.collections.get).not.toHaveBeenCalled();
  useSyncStore.setState({ isScanning: false });
});

it.each(['deleteFolderContents', 'deleteSongContents', 'deleteMultipleSongsContents'] as const)('releases scanning state after %s fails', async method => {
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  (database.collections.get as jest.Mock).mockImplementation(() => { throw Error('Database unavailable'); });
  const call = ScannerService[method] as (path: any) => Promise<void>;
  await expect(call(method === 'deleteMultipleSongsContents' ? ['file:///music/song'] : 'file:///music/song')).resolves.toBeUndefined();
  expect(useSyncStore.getState().isScanning).toBe(false);
  expect(errors).toHaveBeenCalled();
});
