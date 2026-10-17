import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import Track from '../database/models/Track';
import { useSettingsStore } from '../store/useSettingsStore';
import { useMultipleQueuesStore } from '../store/useMultipleQueuesStore';
import { AutoItem, autoId, groupAutoItems, normalizeAutoQuery, splitAutoId } from '../utils/androidAuto';
import { SmartListService } from './SmartListService';
import i18n from '../constants/i18n';
import { getAlbumDisplayTitle, getArtistDisplayName } from '../utils/libraryMetadata';

const label = (key: string) => i18n.t(`android_auto.${key}`);
const collection = (name: string) => database.get<any>(name);
const visible = (tracks: Track[]) => {
    const excluded = new Set(useSettingsStore.getState().excludedSongs);
    return tracks.filter(track => !excluded.has(track.fileUrl));
};

async function searchTags(query: string): Promise<AutoItem[]> {
    const term = normalizeAutoQuery(query);
    if (!term) return [];
    const tags = await collection('tags').query().fetch();
    const matches = tags.filter((tag: any) => normalizeAutoQuery(tag.name).includes(term))
        .map((tag: any) => ({ id: autoId('tag', tag.id), title: tag.name, playable: true }));
    return rankSearchResults(matches, term).slice(0, 40);
}

function rankSearchResults(items: AutoItem[], term: string): AutoItem[] {
    return items.sort((a, b) => Number(normalizeAutoQuery(b.title) === term) - Number(normalizeAutoQuery(a.title) === term));
}

export async function autoTracks(parent: string): Promise<{ tracks: Track[]; instances?: string[] }> {
    const [kind, value] = splitAutoId(parent);
    if (kind === 'album') return { tracks: visible(await collection('tracks').query(Q.where('album_id', value),
        Q.sortBy('disc_number', Q.asc), Q.sortBy('track_number', Q.asc)).fetch()) };
    if (kind === 'artist') {
        const links = await collection('track_collaborators').query(Q.where('artist_id', value)).fetch();
        const ids = links.map((link: any) => link.trackId ?? link._raw.track_id);
        return { tracks: visible(await collection('tracks').query(Q.or(Q.where('artist_id', value), Q.where('id', Q.oneOf(ids))),
            Q.sortBy('normalized_title', Q.asc)).fetch()) };
    }
    if (kind === 'playlist') {
        const links = await collection('playlist_tracks').query(Q.where('playlist_id', value), Q.sortBy('order', Q.asc)).fetch();
        const ids = links.map((link: any) => link._raw.track_id);
        const tracks = await collection('tracks').query(Q.where('id', Q.oneOf(ids))).fetch();
        const byId = new Map<string, Track>(tracks.map((track: Track) => [track.id, track]));
        const rows = links.filter((link: any) => byId.has(link._raw.track_id));
        const excluded = new Set(useSettingsStore.getState().excludedSongs);
        const kept = rows.filter((link: any) => !excluded.has(byId.get(link._raw.track_id)!.fileUrl));
        return { tracks: kept.map((link: any) => byId.get(link._raw.track_id)!), instances: kept.map((link: any) => link.id) };
    }
    if (kind === 'tag') {
        const [links, albums] = await Promise.all([
            collection('track_tags').query(Q.where('tag_id', value)).fetch(),
            collection('album_tags').query(Q.where('tag_id', value)).fetch(),
        ]);
        return { tracks: visible(await collection('tracks').query(Q.or(
            Q.where('id', Q.oneOf(links.map((link: any) => link._raw.track_id))),
            Q.where('album_id', Q.oneOf(albums.map((link: any) => link._raw.album_id)))), Q.sortBy('normalized_title', Q.asc)).fetch()) };
    }
    if (kind === 'smart') {
        const list = SmartListService.getSmartLists().find(item => item.id === value);
        return { tracks: list ? visible(await list.getTracks()) : [] };
    }
    if (kind === 'track') return { tracks: visible([await collection('tracks').find(value)]) };
    if (kind === 'genre') return { tracks: visible(await collection('tracks').query(Q.where('genre', Q.like(`%${Q.sanitizeLikeString(value)}%`)), Q.sortBy('normalized_title', Q.asc)).fetch()) };
    if (parent !== 'favorites' && parent !== 'tracks' && kind !== 'folder') throw new Error('Unknown media category');
    const clauses = parent === 'favorites' ? [Q.where('is_favorite', true)] : [];
    const tracks = visible(await collection('tracks').query(...clauses, Q.sortBy('normalized_title', Q.asc)).fetch());
    return { tracks: kind === 'folder' ? tracks.filter(track => track.fileUrl.slice(0, track.fileUrl.lastIndexOf('/')) === value) : tracks };
}

async function trackItems(parent: string): Promise<AutoItem[]> {
    const { tracks, instances } = await autoTracks(parent);
    // Artwork and artist relations are resolved only for the requested, bounded group.
    return tracks.map((track, index) => ({ id: autoId('entry', JSON.stringify([parent, track.id, instances?.[index] ?? null])),
        title: track.title, playable: true }));
}

async function rawChildren(parent: string): Promise<AutoItem[]> {
    if (parent === 'root') return ['home', 'library', 'playlists', 'queues'].map(id => ({ id, title: label(id) }));
    if (parent === 'home') return ['continue', 'favorites', 'recents', 'smart'].map(id => ({ id, title: label(id), playable: id === 'continue' }));
    if (parent === 'library') return ['albums', 'artists', 'tracks', 'tags', 'folders'].map(id => ({ id, title: label(id) }));
    if (parent === 'queues') return useMultipleQueuesStore.getState().slots.map(slot => ({ id: autoId('queue', String(slot.id)),
        title: slot.name || i18n.t('android_auto.queue_name', { number: slot.id + 1 }), playable: true }));
    if (parent === 'smart') return SmartListService.getSmartLists().map(list => ({ id: autoId('smart', list.id), title: list.name }));
    if (parent === 'recents') {
        const history = await collection('playback_history').query(Q.where('item_type', 'track'), Q.sortBy('played_at', Q.desc), Q.take(80)).fetch();
        const ids = [...new Set<string>(history.map((row: any) => row._raw.item_id.split('-')[0]))];
        const tracks = visible(await collection('tracks').query(Q.where('id', Q.oneOf(ids))).fetch());
        const byId = new Map(tracks.map(track => [track.id, track]));
        return ids.flatMap(id => byId.has(id) ? [{ id: autoId('track', id), title: byId.get(id)!.title, playable: true }] : []);
    }
    if (parent === 'folders') {
        const { tracks } = await autoTracks('tracks');
        return [...new Set(tracks.map(track => track.fileUrl.slice(0, track.fileUrl.lastIndexOf('/'))))].sort((a, b) => a.localeCompare(b))
            .map(path => ({ id: autoId('folder', path), title: decodeURIComponent(path.slice(path.lastIndexOf('/') + 1)) || path }));
    }
    const definitions: Record<string, [string, string, string]> = {
        albums: ['albums', 'album', 'normalized_title'], artists: ['artists', 'artist', 'normalized_name'],
        playlists: ['playlists', 'playlist', 'name'], tags: ['tags', 'tag', 'normalized_name'],
    };
    if (definitions[parent]) {
        const [table, kind, order] = definitions[parent];
        const rows = await collection(table).query(Q.sortBy(order, Q.asc)).fetch();
        return rows.map((row: any) => ({ id: autoId(kind, row.id), title: kind === 'album' ? getAlbumDisplayTitle(row.title) : kind === 'artist' ? getArtistDisplayName(row.name) : row.title ?? row.name,
            artwork: row.coverCustomUrl || row.coverUrl || row.imageUrl || undefined }));
    }
    return trackItems(parent);
}

export const AndroidAutoCatalog = {
    async item(id: string): Promise<AutoItem | undefined> {
        const [kind, value] = splitAutoId(id);
        if (kind === 'track' || kind === 'entry') {
            const trackId = kind === 'entry' ? JSON.parse(value)[1] : value;
            const { tracks } = await autoTracks(autoId('track', trackId));
            return tracks[0] ? { id, title: tracks[0].title, playable: true } : undefined;
        }
        const tables: Record<string, string> = { album: 'albums', artist: 'artists', playlist: 'playlists', tag: 'tags' };
        if (tables[kind]) {
            const model = await collection(tables[kind]).find(value).catch(() => null);
            return model ? { id, title: model.title ?? model.name, artwork: model.coverCustomUrl || model.coverUrl || model.imageUrl || undefined } : undefined;
        }
        if (kind === 'queue') return (await rawChildren('queues')).find(item => item.id === id);
        if (kind === 'smart') return (await rawChildren('smart')).find(item => item.id === id);
        if (kind === 'folder') return { id, title: value.slice(value.lastIndexOf('/') + 1) };
        if (kind === 'genre') return { id, title: value, playable: true };
        if (kind === 'group') return { id, title: label('library') };
        if (['root', 'home', 'library', 'playlists', 'queues', 'continue', 'favorites', 'recents', 'smart', 'albums', 'artists', 'tracks', 'tags', 'folders'].includes(id)) {
            return { id, title: id === 'root' ? 'MMPlayer' : label(id), playable: id === 'continue' };
        }
        return undefined;
    },
    async children(parent: string): Promise<AutoItem[]> {
        let source = parent, start = 0, end: number | undefined;
        if (splitAutoId(parent)[0] === 'group') {
            [source, start, end] = JSON.parse(splitAutoId(parent)[1]);
            if (typeof source !== 'string' || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end! <= start) throw new Error('Invalid media group');
        }
        const items = await rawChildren(source);
        const result = groupAutoItems(source, items, Math.min(start, items.length), Math.min(end ?? items.length, items.length));
        const trackIds = result.flatMap(item => {
            const [kind, value] = splitAutoId(item.id);
            return kind === 'entry' ? [JSON.parse(value)[1]] : kind === 'track' ? [value] : [];
        });
        if (!trackIds.length) return result;
        const tracks = await collection('tracks').query(Q.where('id', Q.oneOf(trackIds))).fetch();
        const [albums, artists] = await Promise.all([
            collection('albums').query(Q.where('id', Q.oneOf([...new Set<string>(tracks.map((track: any) => track._raw.album_id))]))).fetch(),
            collection('artists').query(Q.where('id', Q.oneOf([...new Set<string>(tracks.map((track: any) => track._raw.artist_id))]))).fetch(),
        ]);
        const byTrack = new Map<string, any>(tracks.map((track: any) => [track.id, track]));
        const byAlbum = new Map<string, any>(albums.map((album: any) => [album.id, album]));
        const byArtist = new Map<string, any>(artists.map((artist: any) => [artist.id, artist]));
        return result.map(item => {
            const [kind, value] = splitAutoId(item.id);
            const id = kind === 'entry' ? JSON.parse(value)[1] : value;
            const track = byTrack.get(id);
            if (!track) return item;
            const album = byAlbum.get(track._raw.album_id), artist = byArtist.get(track._raw.artist_id);
            return { ...item, subtitle: artist ? getArtistDisplayName(artist.name) : undefined, artwork: album?.coverUrl || undefined };
        });
    },
    async search(query: string, extras: Record<string, string> = {}): Promise<AutoItem[]> {
        if (extras['android.intent.extra.genre']) {
            const genre = extras['android.intent.extra.genre'];
            const { tracks } = await autoTracks(autoId('genre', genre));
            if (tracks.length) return [{ id: autoId('genre', genre), title: genre, playable: true }];
            // Assistant may classify a custom musical category as a genre.
            return searchTags(genre);
        }
        const term = normalizeAutoQuery(extras['android.intent.extra.title'] || extras['android.intent.extra.album'] || extras['android.intent.extra.artist'] || extras['android.intent.extra.playlist'] || query);
        if (!term) return [];
        const result: AutoItem[] = [];
        const category = extras['android.intent.extra.focus']?.match(/artist|album|playlist|audio|track/)?.[0];
        for (const [table, kind, column, property] of [
            ['tracks', 'track', 'normalized_title', 'title'], ['albums', 'album', 'normalized_title', 'title'],
            ['artists', 'artist', 'normalized_name', 'name'], ['playlists', 'playlist', 'name', 'name'],
        ]) {
            if (category && category !== kind && !(kind === 'track' && category === 'audio')) continue;
            const pattern = `%${Q.sanitizeLikeString(term)}%`;
            const clauses: Q.Clause[] = table === 'playlists' ? [] : [Q.where(column, Q.like(pattern))];
            if (kind === 'track' && extras['android.intent.extra.artist']) {
                const artists = await collection('artists').query(Q.where('normalized_name', Q.like(`%${Q.sanitizeLikeString(normalizeAutoQuery(extras['android.intent.extra.artist']))}%`))).fetch();
                const artistIds = artists.map((artist: any) => artist.id);
                const links = await collection('track_collaborators').query(Q.where('artist_id', Q.oneOf(artistIds))).fetch();
                clauses.push(Q.or(Q.where('artist_id', Q.oneOf(artistIds)), Q.where('id', Q.oneOf(links.map((link: any) => link._raw.track_id)))));
            }
            const fetched = await collection(table).query(...clauses, ...(table === 'playlists' ? [] : [Q.take(40)])).fetch();
            const rows = table === 'playlists' ? fetched.filter((row: any) => normalizeAutoQuery(row.name).includes(term)).slice(0, 40) : fetched;
            const excluded = new Set(useSettingsStore.getState().excludedSongs);
            for (const row of rows) {
                if (kind === 'track' && excluded.has(row.fileUrl)) continue;
                result.push({ id: autoId(kind, row.id), title: row[property], playable: true, artwork: row.coverUrl || row.coverCustomUrl || undefined });
            }
        }
        if (!category) result.push(...await searchTags(term));
        return rankSearchResults(result, term).slice(0, 80);
    },
};
