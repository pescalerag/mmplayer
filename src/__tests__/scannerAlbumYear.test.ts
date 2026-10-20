import { ScannerService } from '../services/ScannerService';
import { database } from '../database';
import { getAudioFiles } from '../../modules/native-audio-scanner';
import { useSyncStore } from '../store/useSyncStore';
import { useSettingsStore } from '../store/useSettingsStore';
import i18n from '../constants/i18n';

jest.mock('../../modules/native-audio-scanner', () => ({ getAudioFiles: jest.fn(), getReplayGainMetadata: jest.fn(), readMetadata: jest.fn(), findAndScanUnindexedAudioFiles: jest.fn() }));
jest.mock('../services/PermissionService', () => ({ PermissionService: { requestAudioPermission: async () => 'granted' } }));
jest.mock('react-native', () => ({ Platform: { OS: 'android' }, Image: { resolveAssetSource: () => ({ uri: 'file:///nullcover.png' }) } }));
jest.mock('../assets/images/nullcover.png', () => 1);
jest.mock('../services/ArtistImageService', () => ({ ArtistImageService: { processMissingArtistImages: jest.fn() } }));
jest.mock('../services/MediaAssetService', () => ({ MediaAssetService: { migrateLegacyCacheAssets: jest.fn(), runGarbageCollector: jest.fn() } }));
jest.mock('../store/usePlayerStore', () => ({ usePlayerStore: { getState: () => ({ refreshRecentsFromDatabase: async () => {}, updateTrackMetadata: async () => {} }) } }));

async function rescan(year: number | null, options: { created?: boolean; pending?: boolean; coverChanged?: boolean; fail?: boolean; legacyFallback?: boolean; onCreate?: (table: string) => void } = {}) {
  const artist = { id: 'artist', name: options.legacyFallback ? i18n.t('metadata.unknown_artist') : 'Artist',
    storedName: options.legacyFallback ? 'Artista Desconocido' : 'Artist', _raw: { id: 'artist' } };
  const raw = { id: 'album', year: 2000, artist_id: 'artist' };
  const album: any = { id: 'album', title: 'Album', coverUrl: 'file:///cover.jpg', _raw: raw, _status: options.created ? 'created' : 'synced', artist: { set: jest.fn() } };
  if (options.legacyFallback) { album.storedTitle = 'Álbum Desconocido'; album.title = i18n.t('metadata.unknown_album'); }
  Object.defineProperty(album, 'year', { get: () => raw.year, set: value => { raw.year = value; } });
  album.prepareUpdate = jest.fn(callback => {
    if (options.pending) throw new Error('Cannot update record with pending changes');
    if (options.fail) throw new Error('Database write failed');
    callback(album); return { kind: 'album', year: raw.year };
  });
  const track: any = { id: 'song', title: 'Song', fileUrl: 'file:///music/song.mp3', lastModified: 1, genre: 'Rock', replayGain: null, replayPeak: null,
    album: { set: jest.fn() }, artist: { set: jest.fn() }, _raw: { id: 'song', album_id: 'album', artist_id: 'artist' } };
  track.prepareUpdate = jest.fn(callback => { callback(track); return { kind: 'track' }; });
  const records: Record<string, any[]> = { tracks: [track], albums: [album], artists: [artist] };
  (database.collections.get as jest.Mock).mockImplementation(table => ({
    query: (...clauses: any[]) => ({
      fetch: async () => clauses.length ? [] : records[table] ?? [],
      unsafeFetchRaw: async () => (records[table] ?? []).map(record => record._raw),
    }),
    prepareCreate: (callback: (record: any) => void) => { options.onCreate?.(table); const record = { track: { set: jest.fn() }, artist: { set: jest.fn() } }; callback(record); return record; },
  }));
  (getAudioFiles as jest.Mock).mockResolvedValue([{ uri: track.fileUrl, filename: 'song.mp3', title: 'Song',
    artist: options.legacyFallback ? null : 'Artist', album: options.legacyFallback ? null : 'Album',
    year, coverUrl: options.coverChanged ? 'file:///new-cover.jpg' : album.coverUrl, duration: 120, genre: 'Rock', lastModified: 1 }]);
  await ScannerService.syncLibrary(undefined, true, new Set([track.fileUrl]));
  return album;
}

beforeEach(() => {
  jest.clearAllMocks(); useSyncStore.setState({ isScanning: false });
  useSettingsStore.setState({ excludedFolders: [], excludedSongs: [] });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('updates an existing album year after rescanning edited file metadata', async () => {
  const album = await rescan(2020);
  expect(album.year).toBe(2020);
  expect(database.batch).toHaveBeenCalledWith(expect.arrayContaining([{ kind: 'album', year: 2020 }]));
  expect(console.error).not.toHaveBeenCalled();
});

it.each([null, 0, 2000])('preserves the album year when metadata supplies %s while updating its cover', async year => {
  const album = await rescan(year, { coverChanged: true });
  expect(album.year).toBe(2000);
  expect(album.coverUrl).toBe('file:///new-cover.jpg');
  expect(console.error).not.toHaveBeenCalled();
});

it('updates a newly created cached album without preparing a second update', async () => {
  const album = await rescan(2020, { created: true });
  expect(album.year).toBe(2020); expect(album.prepareUpdate).not.toHaveBeenCalled();
});

it('keeps the cached year when a newly created album receives no year metadata', async () => {
  const album = await rescan(null, { created: true, coverChanged: true });
  expect(album.year).toBe(2000); expect(album.coverUrl).toBe('file:///new-cover.jpg');
  expect(album.prepareUpdate).not.toHaveBeenCalled();
});

it('does not prepare an album update when year and cover are unchanged', async () => {
  const album = await rescan(2000);
  expect(album.year).toBe(2000); expect(album.prepareUpdate).not.toHaveBeenCalled();
});

it.each([2020, null])('keeps pending album updates usable when the incoming year is %s', async year => {
  const album = await rescan(year, { pending: true, coverChanged: true });
  expect(album.year).toBe(year ?? 2000);
  expect(console.error).not.toHaveBeenCalled();
});

it('reports real write errors and releases the scanning state', async () => {
  const album = await rescan(2020, { fail: true });
  expect(album.year).toBe(2000); expect(console.error).toHaveBeenCalled();
  expect(useSyncStore.getState().isScanning).toBe(false);
});

it.each(['en', 'pt', 'es'])('reuses legacy missing-metadata records while scanning in %s', async language => {
  const previousLanguage = i18n.language;
  await i18n.changeLanguage(language);
  const created: string[] = [];
  try {
    const album = await rescan(2000, { legacyFallback: true, onCreate: table => created.push(table) });
    expect(created).not.toContain('artists');
    expect(created).not.toContain('albums');
    expect(album.prepareUpdate).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  } finally {
    await i18n.changeLanguage(previousLanguage);
  }
});
