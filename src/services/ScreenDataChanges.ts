import { defer, merge, share, Observable, EMPTY, Subject } from 'rxjs';
import { database } from '../database';

const sources = new Map<string, Observable<unknown>>();
const resets = new Subject<void>();
export function notifyScreenDataReset() { resets.next(); }

/** Change notifications only: no query or model array is loaded by this service. */
export function observeTableChanges(tables: readonly string[]): Observable<unknown> {
    return merge(resets, ...tables.map(table => {
        let source = sources.get(table);
        if (!source) {
            source = defer(() => database.get(table).changes ?? EMPTY).pipe(share());
            sources.set(table, source);
        }
        return source;
    }));
}

export const STAT_TABLES = ['playback_history', 'playback_history_tags', 'tracks', 'albums', 'artists', 'track_collaborators', 'tags'] as const;
export const SEARCH_TABLES = ['tracks', 'albums', 'artists', 'tags', 'playlists', 'track_tags', 'album_tags', 'playlist_tracks', 'track_collaborators'] as const;
