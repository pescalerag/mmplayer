import { database } from '../database';
import { AndroidAutoCatalog, autoTracks } from '../services/AndroidAutoCatalog';
import { useSettingsStore } from '../store/useSettingsStore';
import { useMultipleQueuesStore } from '../store/useMultipleQueuesStore';
import { splitAutoId } from '../utils/androidAuto';
import { Q } from '@nozbe/watermelondb';

const tables: Record<string, any[]> = {};
beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(tables)) delete tables[key];
    (database.get as jest.Mock).mockImplementation(name => ({
        query: jest.fn(() => ({ fetch: async () => tables[name] || [] })),
        find: async (id: string) => (tables[name] || []).find(row => row.id === id),
    }));
    useSettingsStore.setState({ excludedSongs: [] });
});

it('provides four browsable root categories without reading the database', async () => {
    const root = await AndroidAutoCatalog.children('root');
    expect(root.map(item => item.id)).toEqual(['home', 'library', 'playlists', 'queues']);
    expect(root.every(item => !item.playable)).toBe(true);
    expect(database.get).not.toHaveBeenCalled();
});

it('keeps playlist order, duplicates and occurrence IDs while removing excluded tracks', async () => {
    tables.tracks = [{ id: 'a', fileUrl: 'file:///a' }, { id: 'b', fileUrl: 'file:///b' }];
    tables.playlist_tracks = [
        { id: 'row1', _raw: { track_id: 'b' } }, { id: 'row2', _raw: { track_id: 'a' } },
        { id: 'row3', _raw: { track_id: 'b' } },
    ];
    useSettingsStore.setState({ excludedSongs: ['file:///a'] });
    const context = await autoTracks('playlist:mix');
    expect(context.tracks.map(track => track.id)).toEqual(['b', 'b']);
    expect(context.instances).toEqual(['row1', 'row3']);
});

it('rejects invalid categories instead of falling back to the entire library', async () => {
    await expect(autoTracks('invalid:abc')).rejects.toThrow('Unknown media category');
});

it('shows all saved queues using their custom names', async () => {
    const slots = useMultipleQueuesStore.getState().slots.map((slot, index) => ({ ...slot, name: index === 2 ? 'Road trip' : '' }));
    useMultipleQueuesStore.setState({ slots });
    const queues = await AndroidAutoCatalog.children('queues');
    expect(queues).toHaveLength(5);
    expect(queues[2]).toMatchObject({ id: 'queue:2', title: 'Road trip', playable: true });
});

it('groups album lists without discarding entries or fetching track metadata', async () => {
    tables.albums = Array.from({ length: 100 }, (_, index) => ({ id: String(index), title: `Album ${index}` }));
    const items = await AndroidAutoCatalog.children('albums');
    expect(items).toHaveLength(2);
    expect(splitAutoId(items[0].id)[0]).toBe('group');
    const group = await AndroidAutoCatalog.children(items[0].id);
    expect(group).toHaveLength(80);
    expect(group[79].id).toBe('album:79');
});

it('rejects malformed groups and tolerates a collection shrinking after browsing', async () => {
    await expect(AndroidAutoCatalog.children('group:%5B%22albums%22,-1,80%5D')).rejects.toThrow('Invalid media group');
    expect(await AndroidAutoCatalog.children('group:%5B%22albums%22,80,160%5D')).toEqual([]);
});

it.each(['Zelda', 'Final Fantasy'])('finds the %s tag and prioritizes it over partial song and album matches', async name => {
    tables.tags = [{ id: 'other', name: 'Rock' }, { id: 'saga', name }];
    tables.tracks = [{ id: 'song', title: `${name} theme`, fileUrl: 'file:///theme' }];
    tables.albums = [{ id: 'album', title: `${name} soundtrack` }];
    const results = await AndroidAutoCatalog.search(name.toUpperCase());
    expect(results[0]).toEqual({ id: 'tag:saga', title: name, playable: true });
    expect(results.map(item => item.id)).toEqual(['tag:saga', 'track:song', 'album:album']);
});

it('matches tag names without accents and keeps exact matches ahead of the result limit', async () => {
    tables.tags = [...Array.from({ length: 45 }, (_, index) => ({ id: `partial${index}`, name: `Música ${index}` })),
        { id: 'exact', name: 'Música' }];
    const results = await AndroidAutoCatalog.search('MUSICA');
    expect(results).toHaveLength(40);
    expect(results[0].id).toBe('tag:exact');
    expect(await AndroidAutoCatalog.search('   ')).toEqual([]);
});

it.each([
    ['album', 'albums', 'title'], ['artist', 'artists', 'name'], ['playlist', 'playlists', 'name'], ['audio', 'tracks', 'title'],
])('does not use tags when Assistant explicitly requests %s', async (focus, table, property) => {
    tables.tags = [{ id: 'saga', name: 'Zelda' }];
    tables[table] = [{ id: 'specific', [property]: 'Zelda', fileUrl: 'file:///song' }];
    const results = await AndroidAutoCatalog.search('Zelda', { 'android.intent.extra.focus': `vnd.android.cursor.item/${focus}` });
    expect(results.map(item => item.id)).toEqual([`${focus === 'audio' ? 'track' : focus}:specific`]);
});

it('falls back to a tag when Assistant interprets its name as a genre with no matching tracks', async () => {
    tables.tags = [{ id: 'saga', name: 'Final Fantasy' }];
    expect(await AndroidAutoCatalog.search('', { 'android.intent.extra.genre': 'final fantasy' }))
        .toEqual([{ id: 'tag:saga', title: 'Final Fantasy', playable: true }]);
});

it('keeps actual genre matches ahead of the tag fallback', async () => {
    tables.tags = [{ id: 'saga', name: 'Jazz' }];
    tables.tracks = [{ id: 'song', fileUrl: 'file:///jazz' }];
    expect(await AndroidAutoCatalog.search('', { 'android.intent.extra.genre': 'Jazz' }))
        .toEqual([{ id: 'genre:Jazz', title: 'Jazz', playable: true }]);
});

it('loads tagged tracks and tagged album tracks together, excluding hidden songs', async () => {
    tables.track_tags = [{ _raw: { track_id: 'direct' } }];
    tables.album_tags = [{ _raw: { album_id: 'album' } }];
    tables.tracks = [{ id: 'direct', fileUrl: 'file:///direct' }, { id: 'inAlbum', fileUrl: 'file:///album' },
        { id: 'hidden', fileUrl: 'file:///hidden' }];
    useSettingsStore.setState({ excludedSongs: ['file:///hidden'] });
    const context = await autoTracks('tag:saga');
    expect(context.tracks.map(track => track.id)).toEqual(['direct', 'inAlbum']);
    const trackQuery = (database.get as jest.Mock).mock.results.find((_, index) =>
        (database.get as jest.Mock).mock.calls[index][0] === 'tracks')!.value.query;
    expect(trackQuery).toHaveBeenCalledWith(Q.or(Q.where('id', Q.oneOf(['direct'])), Q.where('album_id', Q.oneOf(['album']))),
        Q.sortBy('normalized_title', Q.asc));
});
