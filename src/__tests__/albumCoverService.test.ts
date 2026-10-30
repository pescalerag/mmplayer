import { AlbumCoverService, isMissingAlbumCover, selectAlbumCover } from '../services/AlbumCoverService';
import { useSyncStore } from '../store/useSyncStore';

const mockAlbums: any[] = [];
let mockBackground = false;
const mockQuery = jest.fn();
const mockWrite = jest.fn(async (callback: () => any) => callback());
const mockDownload = jest.fn();
const mockDelete = jest.fn();
const mockSave = jest.fn();
const mockRefresh = jest.fn(async () => {});
const mockUpdateTrack = jest.fn(async () => {});
jest.mock('../store/usePlayerStore', () => ({ usePlayerStore: { getState: () => ({ activeTrack: { id: 'song1' }, refreshRecentsFromDatabase: mockRefresh, updateTrackMetadata: mockUpdateTrack }) } }));
jest.mock('../database', () => ({ database: { collections: { get: () => ({ query: () => ({ fetch: mockQuery }) }) }, write: (callback: any) => mockWrite(callback) } }));
jest.mock('../store/useSettingsStore', () => ({ useSettingsStore: { getState: () => ({ albumCoverBackgroundDownload: mockBackground }) } }));
jest.mock('../services/MediaAssetService', () => ({ MediaAssetService: { saveAlbumCover: (...args: any[]) => mockSave(...args) } }));
jest.mock('react-native', () => ({ Image: { resolveAssetSource: () => ({ uri: 'file:///nullcover.png' }) } }));
jest.mock('../assets/images/nullcover.png', () => 1);
jest.mock('expo-file-system/legacy', () => ({ cacheDirectory: 'file:///cache/', downloadAsync: (...args: any[]) => mockDownload(...args), deleteAsync: (...args: any[]) => mockDelete(...args) }));

const result = (artist = 'Daft Punk', title = 'Discovery') => ({ title, artist: { name: artist }, cover_xl: 'https://cdn.example/cover.jpg' });
const album = (coverUrl: string | null = null) => {
    const record: any = { id: 'album1', title: 'Discovery', coverUrl, artist: { fetch: async () => ({ name: 'Daft Punk' }) } };
    record.update = jest.fn(async (callback: any) => callback(record));
    return record;
};
beforeEach(() => {
    jest.clearAllMocks(); mockAlbums.length = 0; mockBackground = false;
    mockQuery.mockImplementation(async () => mockAlbums);
    mockDownload.mockImplementation(async (_url: string, uri: string) => ({ status: 200, uri, headers: { 'Content-Type': 'image/jpeg' } }));
    mockSave.mockResolvedValue('file:///documents/media_assets/album_covers/album_album1.jpg?t=1');
    mockDelete.mockResolvedValue(undefined);
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ data: [result()] }) } as Response);
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('recognizes missing covers including the bundled placeholder', () => {
    expect(isMissingAlbumCover(null)).toBe(true);
    expect(isMissingAlbumCover('')).toBe(true);
    expect(isMissingAlbumCover('file:///nullcover.png')).toBe(true);
    expect(isMissingAlbumCover('file:///cover.jpg')).toBe(false);
});

it('requires matching artist and album and prefers the exact edition', () => {
    const deluxe = { ...result('Daft Punk', 'Discovery (Deluxe Edition)'), cover_xl: 'https://cdn.example/deluxe.jpg' };
    expect(selectAlbumCover([result('Data Punk'), deluxe, result()], 'Discovery', 'Daft Punk')).toBe('https://cdn.example/cover.jpg');
    expect(selectAlbumCover([deluxe], 'Discovery', 'Daft Punk')).toBe(deluxe.cover_xl);
    expect(selectAlbumCover([result('Other')], 'Discovery', 'Daft Punk')).toBeNull();
    expect(selectAlbumCover([result()], 'Random album', 'Daft Punk')).toBeNull();
    expect(selectAlbumCover([{ ...result(), cover_xl: 'http://insecure' }], 'Discovery', 'Daft Punk')).toBeNull();
});

it('matches punctuation and accents without guessing a different artist', () => {
    expect(selectAlbumCover([result('Beyoncé', 'Renaissance')], 'RENAISSANCE', 'Beyonce')).not.toBeNull();
});

it('downloads and persists only missing artwork, leaving existing covers intact', async () => {
    const missing = album('file:///nullcover.png'); const existing = album('file:///my-cover.jpg');
    mockAlbums.push(missing, existing);
    expect(await AlbumCoverService.processMissingAlbumCovers()).toEqual({ downloaded: 1, notFound: 0, failed: 0, skipped: 0 });
    expect(missing.coverUrl).toContain('media_assets/album_covers');
    expect(existing.coverUrl).toBe('file:///my-cover.jpg');
    expect(existing.update).not.toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalledWith('album1', expect.stringContaining('file:///cache/'));
    expect(useSyncStore.getState().isDownloadingAlbumCovers).toBe(false);
    expect(useSyncStore.getState().albumCoverProgress).toEqual({ current: 1, total: 1 });
    expect(mockDelete).toHaveBeenCalled();
    expect(mockUpdateTrack).toHaveBeenCalledWith('song1');
});

it('preserves a cover supplied while the request was running', async () => {
    const missing = album(); mockAlbums.push(missing);
    mockDownload.mockImplementation(async (_url: string, uri: string) => { missing.coverUrl = 'file:///user-cover.jpg'; return { status: 200, uri }; });
    expect((await AlbumCoverService.processMissingAlbumCovers()).skipped).toBe(1);
    expect(mockSave).not.toHaveBeenCalled();
    expect(missing.coverUrl).toBe('file:///user-cover.jpg');
});

it('does not store an unrelated search result', async () => {
    mockAlbums.push(album());
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ data: [result('Data Punk')] }) });
    expect((await AlbumCoverService.processMissingAlbumCovers()).notFound).toBe(1);
    expect(mockDownload).not.toHaveBeenCalled();
});

it('cleans failed downloads and reports errors without changing the album', async () => {
    const missing = album(); mockAlbums.push(missing);
    mockDownload.mockResolvedValue({ status: 404, uri: 'file:///cache/error.jpg' });
    expect((await AlbumCoverService.processMissingAlbumCovers()).failed).toBe(1);
    expect(missing.coverUrl).toBeNull();
    expect(mockDelete).toHaveBeenCalled();
    expect(useSyncStore.getState().isDownloadingAlbumCovers).toBe(false);
});

it('only runs background downloads when enabled, while manual downloads remain available', async () => {
    mockAlbums.push(album());
    await AlbumCoverService.processMissingAlbumCovers({ isBackground: true });
    expect(global.fetch).not.toHaveBeenCalled();
    mockBackground = true;
    expect((await AlbumCoverService.processMissingAlbumCovers({ isBackground: true })).downloaded).toBe(1);
});

it('shares concurrent work and clears the busy flag if the database query fails', async () => {
    mockQuery.mockRejectedValueOnce(new Error('Database unavailable'));
    const first = AlbumCoverService.processMissingAlbumCovers();
    expect(AlbumCoverService.processMissingAlbumCovers()).toBe(first);
    await expect(first).rejects.toThrow('Database unavailable');
    expect(useSyncStore.getState().isDownloadingAlbumCovers).toBe(false);
    expect(await AlbumCoverService.processMissingAlbumCovers()).toEqual({ downloaded: 0, notFound: 0, failed: 0, skipped: 0 });
});

it('rejects network errors and non-image content in individual downloads', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(AlbumCoverService.downloadCover('Discovery', 'Daft Punk')).rejects.toThrow('503');
    mockDownload.mockResolvedValueOnce({ status: 200, headers: { 'content-type': 'text/html' } });
    await expect(AlbumCoverService.downloadCover('Discovery', 'Daft Punk')).rejects.toThrow('Invalid cover');
    expect(mockDelete).toHaveBeenCalled();
    expect(await AlbumCoverService.downloadCover('', '')).toBeNull();
});


it('checks covers without the native asset resolver on desktop web', () => {
    const { Image } = require('react-native');
    const resolve = Image.resolveAssetSource;
    Image.resolveAssetSource = undefined;
    try {
        expect(isMissingAlbumCover(null)).toBe(true);
        expect(isMissingAlbumCover('')).toBe(true);
        expect(isMissingAlbumCover('https://example.test/cover.jpg')).toBe(false);
    } finally { Image.resolveAssetSource = resolve; }
});
