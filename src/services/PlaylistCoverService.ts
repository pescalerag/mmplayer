import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import Playlist from '../database/models/Playlist';
import PlaylistTrack from '../database/models/PlaylistTrack';
import Track from '../database/models/Track';

const pending = new Map<string, Promise<string | null>>();

export async function readInitialPlaylistCover(trackId: string): Promise<string | null> {
    const track = await database.get<Track>('tracks').find(trackId).catch(() => null);
    const album = await track?.album.fetch().catch(() => null);
    const url = album?.coverUrl;
    return typeof url === 'string' && url.trim() && url !== 'null' ? url : null;
}

async function initializeCover(playlistId: string): Promise<string | null> {
    const playlist = await database.get<Playlist>('playlists').find(playlistId);
    if (playlist.coverInitialized) return playlist.coverCustomUrl || playlist.coverUrl || null;
    const first = await database.get<PlaylistTrack>('playlist_tracks')
        .query(Q.where('playlist_id', playlistId), Q.sortBy('order', Q.asc), Q.take(1)).fetch();
    // An empty playlist must remain eligible for its first addition.
    if (!first.length) return playlist.coverCustomUrl || null;
    const cover = await readInitialPlaylistCover(first[0].track.id);
    await database.write(async () => {
        if (!playlist.coverInitialized) {
            await playlist.update(p => { p.coverUrl = cover; p.coverInitialized = true; });
        }
    });
    return playlist.coverCustomUrl || playlist.coverUrl || null;
}

export function getStoredPlaylistCover(playlistId: string): Promise<string | null> {
    const existing = pending.get(playlistId);
    if (existing) return existing;
    const request = initializeCover(playlistId).finally(() => { pending.delete(playlistId); });
    pending.set(playlistId, request);
    return request;
}

export async function initializeExistingPlaylistCovers() {
    const playlists = await database.get<Playlist>('playlists').query().fetch();
    for (const playlist of playlists) {
        if (playlist.coverInitialized) continue;
        await getStoredPlaylistCover(playlist.id).catch(error => {
            console.warn('Could not initialize playlist cover:', error);
        });
    }
}
