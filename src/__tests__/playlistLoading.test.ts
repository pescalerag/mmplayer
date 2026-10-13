import { database } from '../database';
import { PlaylistService } from '../services/PlaylistService';
import { getStoredPlaylistCover } from '../services/PlaylistCoverService';
import { mySchema } from '../database/schema';
import { myMigrations } from '../database/migrations';
import PlaylistTrack from '../database/models/PlaylistTrack';

describe('stable playlist covers and batched track loading', () => {
    let playlist: any;
    let links: any[];
    let tracks: any[];
    const albumFetch = jest.fn();
    const trackFind = jest.fn();
    const trackQuery = jest.fn();
    const firstQuery = jest.fn();

    const link = (id: string, trackId: string, order: number) => ({
        id, track: { id: trackId }, playlist: { id: 'playlist' }, order,
        prepareDestroyPermanently: () => ({ kind: 'delete', id }),
        prepareUpdate: jest.fn(function (this: any, callback) { callback(this); return this; }),
    });
    beforeEach(() => {
        jest.clearAllMocks();
        links = [];
        albumFetch.mockResolvedValue({ coverUrl: 'file:///first.jpg' });
        tracks = [{ id: 'first', album: { fetch: albumFetch } }, { id: 'second', album: { fetch: jest.fn().mockResolvedValue({ coverUrl: 'file:///second.jpg' }) } }];
        playlist = {
            id: 'playlist', coverUrl: null, coverInitialized: false, coverCustomUrl: null,
            update: jest.fn(async callback => { callback(playlist); return playlist; }),
            prepareUpdate: jest.fn(callback => { callback(playlist); return playlist; }),
        };
        trackFind.mockImplementation(async id => tracks.find(track => track.id === id) ?? null);
        trackQuery.mockReturnValue({ fetch: async () => tracks });
        firstQuery.mockReturnValue({ fetch: async () => [...links].sort((a, b) => a.order - b.order).slice(0, 1) });
        const collections: Record<string, any> = {
            playlists: { find: async () => playlist, query: () => ({ fetch: async () => [playlist] }) },
            tracks: { find: trackFind, query: trackQuery },
            playlist_tracks: { query: firstQuery },
        };
        (database.get as jest.Mock).mockImplementation((table: string) => collections[table]);
        (database.collections.get as jest.Mock).mockImplementation(() => ({
            query: () => ({ fetch: async () => links }),
            prepareCreate: (callback: (record: any) => void) => {
                const record: any = { ...link(`link-${links.length}`, '', 0), playlist: {}, track: {} };
                callback(record);
                links.push(record);
                return record;
            },
        }));
        (database.write as jest.Mock).mockImplementation(callback => callback());
        (database.batch as jest.Mock).mockImplementation(async (...operations) => {
            const removed = operations.flat().filter(op => op.kind === 'delete').map(op => op.id);
            links = links.filter(item => !removed.includes(item.id));
        });
    });

    it('saves the first added cover in the same batch and retains it after removal and later additions', async () => {
        await PlaylistService.addMultipleTracksToPlaylist('playlist', ['first', 'second']);
        expect(playlist.coverUrl).toBe('file:///first.jpg');
        expect(playlist.coverInitialized).toBe(true);
        expect(albumFetch).toHaveBeenCalledTimes(1);
        expect(database.batch).toHaveBeenCalledWith(...links, playlist);
        await PlaylistService.removeTrackFromPlaylist('playlist', 'first');
        await PlaylistService.addTrackToPlaylist('playlist', 'second');
        expect(playlist.coverUrl).toBe('file:///first.jpg');
        expect(albumFetch).toHaveBeenCalledTimes(1);
    });

    it('initializes an existing playlist once from its first ordered entry without overwriting a custom cover', async () => {
        links = [link('later', 'second', 2), link('earlier', 'first', 1)];
        playlist.coverCustomUrl = 'file:///custom.jpg';
        expect(await getStoredPlaylistCover('playlist')).toBe('file:///custom.jpg');
        expect(playlist.coverUrl).toBe('file:///first.jpg');
        await PlaylistService.reorderPlaylistTracks(links);
        await getStoredPlaylistCover('playlist');
        expect(firstQuery).toHaveBeenCalledTimes(1);
        expect(albumFetch).toHaveBeenCalledTimes(1);
        expect(playlist.coverCustomUrl).toBe('file:///custom.jpg');
        expect(playlist.coverUrl).toBe('file:///first.jpg');
    });

    it('keeps an empty playlist eligible and does not substitute another song if the first has no cover', async () => {
        expect(await getStoredPlaylistCover('playlist')).toBeNull();
        expect(playlist.coverInitialized).toBe(false);
        albumFetch.mockResolvedValue(null);
        await PlaylistService.addMultipleTracksToPlaylist('playlist', ['first', 'second']);
        expect(playlist.coverInitialized).toBe(true);
        expect(playlist.coverUrl).toBeNull();
        await getStoredPlaylistCover('playlist');
        expect(tracks[1].album.fetch).not.toHaveBeenCalled();
    });

    it('shares concurrent legacy cover requests', async () => {
        links = [link('entry', 'first', 1)];
        const first = getStoredPlaylistCover('playlist');
        const second = getStoredPlaylistCover('playlist');
        expect(first).toBe(second);
        await first;
        expect(albumFetch).toHaveBeenCalledTimes(1);
    });

    it('loads tracks in one query while preserving order, duplicates and instance IDs and skipping orphans', async () => {
        links = [link('a', 'second', 1), link('b', 'first', 2), link('c', 'second', 3), link('d', 'missing', 4)];
        const result = await PlaylistService.resolvePlaylistTracks(links as PlaylistTrack[]);
        expect(result.map(item => [item.track.id, item.playlistTrackId])).toEqual([['second', 'a'], ['first', 'b'], ['second', 'c']]);
        expect(trackQuery).toHaveBeenCalledTimes(1);
        expect(trackFind).not.toHaveBeenCalled();
        expect(await PlaylistService.resolvePlaylistTracks([])).toEqual([]);
        expect(trackQuery).toHaveBeenCalledTimes(1);
    });

    it('adds optional cover fields without replacing playlist data during migration', () => {
        const migration = myMigrations.sortedMigrations.find(item => item.toVersion === 21)!;
        expect(migration.steps).toEqual([{
            type: 'add_columns', table: 'playlists', columns: [
                { name: 'cover_url', type: 'string', isOptional: true },
                { name: 'cover_initialized', type: 'boolean', isOptional: true },
            ],
        }]);
        expect(mySchema.tables.playlists.columns.cover_url.isOptional).toBe(true);
        expect(mySchema.tables.playlists.columns.cover_custom_url).toBeDefined();
    });
});
