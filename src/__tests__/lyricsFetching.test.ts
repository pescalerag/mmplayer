import { LyricsService, parseLRC } from '../services/LyricsService';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { usePlayerStore } from '../store/usePlayerStore';

jest.mock('expo-file-system/legacy', () => ({ readAsStringAsync: jest.fn() }));

jest.mock('../store/usePlayerStore', () => {
  const state = { setIsFetchingLyrics: jest.fn() };
  return { usePlayerStore: { getState: () => state } };
});

function track(id = 'song'): any {
  const model: any = { id, title: 'Canción & Song', lyricsLRC: null, lyricsFetchFailed: false,
    artist: Promise.resolve({ name: 'Artist' }), queryCollaborators: { fetch: jest.fn().mockResolvedValue([]) } };
  model.update = jest.fn(async update => update(model));
  return model;
}

function namedError(name: string) {
  const error = new Error('Unavailable');
  error.name = name;
  return error;
}

beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

it('parses multiple timestamps, centiseconds, milliseconds and untimed metadata', () => {
  expect(parseLRC('')).toEqual([]);
  expect(parseLRC('[ar:Artist]\n[01:02.3]invalid\n[00:03.125]Third\n[00:02.50][00:01] First ')).toEqual([
    { time: 1, text: 'First' }, { time: 2.5, text: 'First' }, { time: 3.125, text: 'Third' },
  ]);
});

it('uses cached lyrics and suppresses previously failed requests', async () => {
  const fetch = jest.spyOn(globalThis, 'fetch'); const model = track();
  model.lyricsLRC = '[00:01]Cached';
  expect(await LyricsService.fetchLyrics(model)).toBe(model.lyricsLRC);
  model.lyricsLRC = null; model.lyricsFetchFailed = true;
  expect(await LyricsService.fetchLyrics(model)).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

it.each([
  [{ syncedLyrics: '[00:01]Synced', plainLyrics: 'Plain' }, '[00:01]Synced'],
  [{ plainLyrics: 'Plain' }, 'Plain'],
  [{}, null],
] as const)('stores lyrics from successful responses: %j', async (data, expected) => {
  const model = track(); model.lyricsFetchFailed = true;
  model.queryCollaborators.fetch.mockResolvedValue([{ name: 'Primary & Artist' }]);
  const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => data } as Response);
  expect(await LyricsService.fetchLyrics(model, true)).toBe(expected);
  expect(model.lyricsFetchFailed).toBe(!expected);
  if (expected) expect(model.lyricsLRC).toBe(expected);
  expect(fetch.mock.calls[0][0]).toContain('artist_name=Primary%20%26%20Artist');
  expect(LyricsService.isFetching()).toBe(false);
  expect(usePlayerStore.getState().setIsFetchingLyrics).toHaveBeenLastCalledWith(false);
});

it('prevents duplicate in-flight requests and resets loading after a missing response', async () => {
  let resolve!: (response: Response) => void;
  const fetch = jest.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(done => { resolve = done; }));
  const model = track();
  const pending = LyricsService.fetchLyrics(model);
  for (let i = 0; i < 5; i++) await Promise.resolve();
  expect(LyricsService.isFetching()).toBe(true);
  expect(await LyricsService.fetchLyrics(model)).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(1);
  resolve({ ok: false, status: 404 } as Response);
  expect(await pending).toBeNull();
  expect(model.lyricsFetchFailed).toBe(true);
  expect(LyricsService.isFetching()).toBe(false);
});

it.each(['network', 'AbortError'])('resets loading after %s errors without marking lyrics as absent', async reason => {
  const model = track(); model.queryCollaborators.fetch.mockRejectedValueOnce(Error('Deleted artist'));
  const error = namedError(reason);
  jest.spyOn(globalThis, 'fetch').mockRejectedValueOnce(error);
  expect(await LyricsService.fetchLyrics(model)).toBeNull();
  expect(model.lyricsFetchFailed).toBe(false);
  expect(LyricsService.isFetching()).toBe(false);
});

it('aborts a stalled request at the timeout and cleans up fetching state', async () => {
  const fetch = jest.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => new Promise((_resolve, reject) => {
    init!.signal!.addEventListener('abort', () => reject(namedError('AbortError')));
  }));
  const pending = LyricsService.fetchLyrics(track());
  for (let i = 0; i < 5; i++) await Promise.resolve();
  expect(fetch).toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(10000);
  expect(await pending).toBeNull();
  expect(LyricsService.isFetching()).toBe(false);
});

it('imports custom lyrics, saves edits and suppresses fetching after deletion', async () => {
  const model = track();
  (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///lyrics.lrc' }] });
  (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValueOnce('[00:01]Imported');
  expect(await LyricsService.importCustomLyrics(model)).toBe('[00:01]Imported');
  expect(model.lyricsLRC).toBe('[00:01]Imported');
  await LyricsService.saveLyrics(model, 'Edited');
  expect(model.lyricsLRC).toBe('Edited');
  await LyricsService.saveLyrics(model, '  ');
  expect(model.lyricsLRC).toBeNull();
  expect(model.lyricsFetchFailed).toBe(true);
  await LyricsService.deleteLyrics(model);
  expect(model.lyricsLRC).toBeNull();
});

it('ignores canceled or empty imports and propagates file access errors', async () => {
  const picker = DocumentPicker.getDocumentAsync as jest.Mock;
  for (const result of [{ canceled: true }, { canceled: false }, { canceled: false, assets: [] }]) {
    picker.mockResolvedValueOnce(result);
    expect(await LyricsService.importCustomLyrics(track())).toBeNull();
  }
  picker.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///lyrics' }] });
  (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValueOnce('');
  expect(await LyricsService.importCustomLyrics(track())).toBeNull();
  (FileSystem.readAsStringAsync as jest.Mock).mockRejectedValueOnce(Error('Denied'));
  await expect(LyricsService.importCustomLyrics(track())).rejects.toThrow('Denied');
});
