import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import Track from '../database/models/Track';
import { PlaylistService } from '../services/PlaylistService';
import { useMultiSelectStore } from '../store/useMultiSelectStore';

const song = (id: string) => ({ id } as Track);
const selection = () => useMultiSelectStore.getState();

beforeEach(() => {
    jest.clearAllMocks();
    selection().exitSelectionMode();
});

it('enables removal for a single playlist and restores it after deselecting a different origin', () => {
    selection().enterSelectionMode(song('a'), 'playlist-a');
    selection().toggleTrack(song('b'), 'playlist-a');
    expect(selection().selectionPlaylistId).toBe('playlist-a');
    selection().toggleTrack(song('c'), 'playlist-b');
    expect(selection().selectionPlaylistId).toBeNull();
    selection().toggleTrack(song('c'), 'playlist-b');
    expect(selection().selectionPlaylistId).toBe('playlist-a');
    selection().toggleTrack(song('d'));
    expect(selection().selectionPlaylistId).toBeNull();
    selection().toggleTrack(song('d'));
    expect(selection().selectionPlaylistId).toBe('playlist-a');
});

it('deduplicates select-all and never assigns another origin to existing selected songs', () => {
    selection().selectMultipleTracks([song('a'), song('a'), song('b')], 'playlist-a');
    expect(selection().selectedTracks.map(track => track.id)).toEqual(['a', 'b']);
    selection().selectMultipleTracks([song('a'), song('c')], 'playlist-b');
    expect(selection().selectionPlaylistId).toBeNull();
    selection().toggleTrack(song('c'), 'playlist-b');
    expect(selection().selectionPlaylistId).toBe('playlist-a');
    selection().exitSelectionMode();
    selection().enterSelectionMode(song('a'));
    selection().selectMultipleTracks([song('a')], 'playlist-a');
    expect(selection().selectionPlaylistId).toBeNull();
});

it('clears playlist provenance when clearing, exiting or deselecting the final song', () => {
    for (const clear of [() => selection().clearSelection(), () => selection().exitSelectionMode(), () => selection().toggleTrack(song('a'))]) {
        selection().enterSelectionMode(song('a'), 'playlist-a');
        clear();
        expect(selection().selectedTracks).toEqual([]);
        expect(selection().selectedPlaylistIds).toEqual({});
        expect(selection().selectionPlaylistId).toBeNull();
    }
});

it('removes selected playlist links including repeated songs in one query and one batch', async () => {
    const operations = ['a-first', 'a-duplicate', 'b'].map(id => ({ id }));
    const links = operations.map(operation => ({ prepareDestroyPermanently: jest.fn(() => operation) }));
    const fetch = jest.fn().mockResolvedValue(links);
    const query = jest.fn(() => ({ fetch }));
    (database.collections.get as jest.Mock).mockReturnValue({ query });
    (database.write as jest.Mock).mockImplementation(callback => callback());
    await PlaylistService.removeMultipleTracksFromPlaylist('playlist-a', ['a', 'b', 'a']);
    expect(database.collections.get).toHaveBeenCalledWith('playlist_tracks');
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(Q.where('playlist_id', 'playlist-a'), Q.where('track_id', Q.oneOf(['a', 'b'])));
    expect(database.write).toHaveBeenCalledTimes(1);
    expect(database.batch).toHaveBeenCalledTimes(1);
    expect(database.batch).toHaveBeenCalledWith(...operations);
});

it('does no work for an empty selection and no write batch when links have already been removed', async () => {
    await PlaylistService.removeMultipleTracksFromPlaylist('playlist-a', []);
    expect(database.write).not.toHaveBeenCalled();
    (database.collections.get as jest.Mock).mockReturnValue({ query: () => ({ fetch: async () => [] }) });
    (database.write as jest.Mock).mockImplementation(callback => callback());
    await PlaylistService.removeMultipleTracksFromPlaylist('playlist-a', ['gone']);
    expect(database.batch).not.toHaveBeenCalled();
});
