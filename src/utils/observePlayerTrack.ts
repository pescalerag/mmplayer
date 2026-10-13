import { of } from 'rxjs';
import type { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import type Artist from '../database/models/Artist';
import type Tag from '../database/models/Tag';
import type Track from '../database/models/Track';

export function observePlayerTrack(track: Track) {
    // Wait for actual metadata before publishing a new song. Synthetic empty
    // relations flash the add-tag button and an incomplete artist name.
    return {
        track: track.observe(),
        album: track.album.observe().pipe(catchError(() => of(null))),
        artist: track.artist.observe().pipe(catchError(() => of(null))),
        artists: track.queryCollaborators.observe() as Observable<Artist[]>,
        tags: track.queryTags.observe() as Observable<Tag[]>,
    };
}
