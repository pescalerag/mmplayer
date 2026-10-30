import { BehaviorSubject, firstValueFrom } from 'rxjs';
import * as FileSystem from 'expo-file-system/legacy';
import { database } from '../database';
import { LibraryFilterService, readLibraryFileSizes } from '../services/LibraryFilterService';
import { EMPTY_SECTION_FILTERS, FilterTrack } from '../utils/libraryFilters';
import { resolveAudioUriInfo } from '../../modules/native-audio-scanner';

jest.mock('../../modules/native-audio-scanner', () => ({ resolveAudioUriInfo: jest.fn() }));

const track = (id: string): FilterTrack => ({ id, fileUrl: `file:///filter-tests/${id}.mp3`, duration: 120, lastModified: 1, rating: 4, genre: 'Rock', isFavorite: true, lyricsLRC: null, album: { id: 'album' }, artist: { id: 'artist' } });
let sources: Record<string, BehaviorSubject<any[]>>;
beforeEach(() => {
  jest.clearAllMocks();
  sources = Object.fromEntries(['tracks', 'albums', 'playlist_tracks', 'track_collaborators', 'playback_history'].map(table => [table, new BehaviorSubject<any[]>([])]));
  (database.get as jest.Mock).mockImplementation(table => ({ query: () => ({ observeWithColumns: () => sources[table] }) }));
  (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 1024 });
});

it('does not query the database for simple filters or when no filters are active', async () => {
  await firstValueFrom(LibraryFilterService.observe('tracks', { ...EMPTY_SECTION_FILTERS, genre: 'Rock' }));
  await firstValueFrom(LibraryFilterService.observe('artists', { ...EMPTY_SECTION_FILTERS, image: 'no' }));
  await firstValueFrom(LibraryFilterService.observe('folders', EMPTY_SECTION_FILTERS));
  expect(database.get).not.toHaveBeenCalled();
  expect(FileSystem.getInfoAsync).not.toHaveBeenCalled();
});

it('shares track queries across artist and playlist filters, updates membership and releases subscriptions', () => {
  sources.tracks.next([track('a')]);
  sources.albums.next([{ id: 'album', artist: { id: 'artist' } }]);
  sources.playlist_tracks.next([{ playlist: { id: 'playlist' }, track: { id: 'a' } }]);
  const artist = jest.fn(), playlist = jest.fn();
  const a = LibraryFilterService.observe('artists', { ...EMPTY_SECTION_FILTERS, minTracks: 1 }).subscribe(artist);
  const b = LibraryFilterService.observe('playlists', { ...EMPTY_SECTION_FILTERS, minTracks: 1 }).subscribe(playlist);
  expect((database.get as jest.Mock).mock.calls.filter(([table]) => table === 'tracks')).toHaveLength(1);
  sources.tracks.next([track('a'), track('b')]);
  expect(artist.mock.lastCall[0].artists.get('artist').tracks.size).toBe(2);
  sources.playlist_tracks.next([]);
  expect(playlist.mock.lastCall[0].playlists.size).toBe(0);
  a.unsubscribe(); expect(sources.tracks.observed).toBe(true);
  b.unsubscribe(); expect(sources.tracks.observed).toBe(false);
  expect(sources.track_collaborators.observed).toBe(false);
});

it('reacts to new or removed history for the never-played filter', () => {
  const next = jest.fn();
  const subscription = LibraryFilterService.observe('tracks', { ...EMPTY_SECTION_FILTERS, neverPlayed: true }).subscribe(next);
  sources.playback_history.next([{ itemType: 'track', itemId: 'a', playedAt: new Date() }]);
  expect(next.mock.lastCall[0].played.has('a')).toBe(true);
  sources.playback_history.next([]);
  expect(next.mock.lastCall[0].played.size).toBe(0);
  subscription.unsubscribe();
});

it('only reads file sizes for size filters, caches them and refreshes changed files', async () => {
  const songs = [track('size-cache-a'), track('size-cache-b')];
  sources.tracks.next(songs);
  const filters = { ...EMPTY_SECTION_FILTERS, minSize: 1 };
  const first = await firstValueFrom(LibraryFilterService.observe('folders', filters));
  expect(first.sizes.get(songs[0].id)).toBe(1024);
  expect(FileSystem.getInfoAsync).toHaveBeenCalledTimes(2);
  await firstValueFrom(LibraryFilterService.observe('folders', filters));
  expect(FileSystem.getInfoAsync).toHaveBeenCalledTimes(2);
  sources.tracks.next([{ ...songs[0], lastModified: 2 }, songs[1]]);
  await firstValueFrom(LibraryFilterService.observe('folders', filters));
  expect(FileSystem.getInfoAsync).toHaveBeenCalledTimes(3);
});

it('keeps unavailable sizes unknown, retries them and supports content URIs', async () => {
  (FileSystem.getInfoAsync as jest.Mock).mockRejectedValue(new Error('unavailable'));
  const unknown = track('unknown-size');
  const content = { ...track('content-size'), fileUrl: 'content://audio/123' };
  (resolveAudioUriInfo as jest.Mock).mockResolvedValue({ size: 4096 });
  const sizes = await readLibraryFileSizes([unknown, content]);
  expect(sizes.get(unknown.id)).toBeNull();
  expect(sizes.get(content.id)).toBe(4096);
  expect(resolveAudioUriInfo).toHaveBeenCalledWith(content.fileUrl);
  (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 2048 });
  expect((await readLibraryFileSizes([unknown])).get(unknown.id)).toBe(2048);
});

it('limits simultaneous file reads to eight', async () => {
  let running = 0, maximum = 0;
  (FileSystem.getInfoAsync as jest.Mock).mockImplementation(async () => {
    running++; maximum = Math.max(maximum, running);
    await Promise.resolve(); running--;
    return { exists: true, size: 2048 };
  });
  const sizes = await readLibraryFileSizes(Array.from({ length: 25 }, (_, index) => track(`pool-${index}`)));
  expect(sizes.size).toBe(25);
  expect(maximum).toBe(8);
});
