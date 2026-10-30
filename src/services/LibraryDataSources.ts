import { combineLatest, defer, distinctUntilChanged, map, Observable, shareReplay } from 'rxjs';
import { database } from '../database';
import Album from '../database/models/Album';
import Track from '../database/models/Track';
import TrackCollaborator from '../database/models/TrackCollaborator';
import { useSettingsStore } from '../store/useSettingsStore';

// Rankings, filters and album counts share these queries. Release DB observers when unused.
export const libraryTracks = defer(() => database.get<Track>('tracks').query().observeWithColumns([
  'album_id', 'artist_id', 'file_url', 'last_modified', 'duration', 'rating', 'genre', 'is_favorite', 'lyrics_lrc',
])).pipe(shareReplay({ bufferSize: 1, refCount: true }));
export const libraryAlbums = defer(() => database.get<Album>('albums').query().observeWithColumns([
  'title', 'year', 'is_pinned', 'cover_url', 'artist_id',
])).pipe(shareReplay({ bufferSize: 1, refCount: true }));
export const libraryCredits = defer(() => database.get<TrackCollaborator>('track_collaborators').query().observeWithColumns([
  'artist_id', 'track_id',
])).pipe(shareReplay({ bufferSize: 1, refCount: true }));

const exclusions = new Observable<readonly string[]>(subscriber => {
  subscriber.next(useSettingsStore.getState().excludedSongs);
  return useSettingsStore.subscribe((state, previous) => {
    if (state.excludedSongs !== previous.excludedSongs) subscriber.next(state.excludedSongs);
  });
}).pipe(distinctUntilChanged());

const ratingInputs = libraryTracks.pipe(
  map(tracks => ({ tracks, signature: JSON.stringify(tracks.map(track => [track.id, track.rating, track.album.id, track.artist?.id, track.fileUrl])) })),
  distinctUntilChanged((previous, next) => previous.signature === next.signature),
  map(value => value.tracks),
);

export const ratingTracks = combineLatest([ratingInputs, exclusions]).pipe(
  map(([tracks, paths]) => {
    const excluded = new Set(paths);
    return tracks.filter(track => !excluded.has(track.fileUrl));
  }),
  shareReplay({ bufferSize: 1, refCount: true }),
);
