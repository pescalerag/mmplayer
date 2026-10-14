import { combineLatest, defer, map, of, shareReplay, switchMap } from 'rxjs';
import * as FileSystem from 'expo-file-system/legacy';
import { resolveAudioUriInfo } from '../../modules/native-audio-scanner';
import { database } from '../database';
import Track from '../database/models/Track';
import Album from '../database/models/Album';
import PlaylistTrack from '../database/models/PlaylistTrack';
import TrackCollaborator from '../database/models/TrackCollaborator';
import PlaybackHistory from '../database/models/PlaybackHistory';
import { buildLibraryFilterIndex, emptyLibraryFilterIndex, FilterSection, FilterTrack, hasSectionFilters, SectionFilters } from '../utils/libraryFilters';

const tracks = defer(() => database.get<Track>('tracks').query().observeWithColumns(['album_id', 'artist_id', 'file_url', 'last_modified', 'duration', 'rating', 'genre', 'is_favorite', 'lyrics_lrc'])).pipe(shareReplay({ bufferSize: 1, refCount: true }));
const albums = defer(() => database.get<Album>('albums').query().observeWithColumns(['artist_id'])).pipe(shareReplay({ bufferSize: 1, refCount: true }));
const memberships = defer(() => database.get<PlaylistTrack>('playlist_tracks').query().observeWithColumns(['playlist_id', 'track_id'])).pipe(shareReplay({ bufferSize: 1, refCount: true }));
const collaborators = defer(() => database.get<TrackCollaborator>('track_collaborators').query().observeWithColumns(['artist_id', 'track_id'])).pipe(shareReplay({ bufferSize: 1, refCount: true }));
const history = defer(() => database.get<PlaybackHistory>('playback_history').query().observeWithColumns(['item_id', 'item_type', 'played_at'])).pipe(shareReplay({ bufferSize: 1, refCount: true }));
const sizes = new Map<string, Promise<number | null>>();

function readSize(track: FilterTrack): Promise<number | null> {
  const key = `${track.fileUrl}:${track.lastModified}`;
  const cached = sizes.get(key);
  if (cached) return cached;
  const request = (async () => {
    const info = await FileSystem.getInfoAsync(track.fileUrl).catch(() => null);
    if (info?.exists && 'size' in info && Number.isFinite(info.size) && info.size >= 0) return info.size;
    if (track.fileUrl.startsWith('content://')) {
      const resolved = await resolveAudioUriInfo(track.fileUrl);
      if (resolved?.size !== undefined && Number.isFinite(resolved.size) && resolved.size >= 0) return resolved.size;
    }
    return null;
  })().then(value => {
    if (value === null) sizes.delete(key);
    return value;
  });
  if (sizes.size >= 4000) sizes.delete(sizes.keys().next().value!);
  sizes.set(key, request);
  return request;
}

export async function readLibraryFileSizes(tracks: readonly FilterTrack[]): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>();
  let cursor = 0;
  const readNext = (): Promise<void> => {
    if (cursor >= tracks.length) return Promise.resolve();
    const track = tracks[cursor++];
    return readSize(track).then(size => {
      result.set(track.id, size);
      return readNext();
    });
  };
  await Promise.all(Array.from({ length: Math.min(8, tracks.length) }, () => readNext()));
  return result;
}

export const LibraryFilterService = {
  observe(section: FilterSection, filters: SectionFilters) {
    if (!hasSectionFilters(filters)) return of(emptyLibraryFilterIndex());
    const artistStats = section === 'artists' && [filters.minAlbums, filters.maxAlbums, filters.minTracks, filters.maxTracks, filters.minPlays, filters.maxPlays].some(value => value !== null);
    const artistHistory = section === 'artists' && (filters.minPlays !== null || filters.maxPlays !== null || !!filters.playedFrom || !!filters.playedTo);
    const playlistStats = section === 'playlists' && [filters.minTracks, filters.maxTracks, filters.minDuration, filters.maxDuration].some(value => value !== null);
    const folderSizes = section === 'folders' && (filters.minSize !== null || filters.maxSize !== null);
    return combineLatest([
      artistStats || artistHistory || playlistStats || folderSizes ? tracks : of([]),
      artistStats || artistHistory ? albums : of([]),
      playlistStats ? memberships : of([]),
      artistStats || artistHistory ? collaborators : of([]),
      artistHistory || (section === 'tracks' && filters.neverPlayed) ? history : of([]),
    ]).pipe(
      map(([songs, albumList, playlistTracks, credits, listens]) => buildLibraryFilterIndex(songs, albumList, playlistTracks, credits, listens, filters)),
      switchMap(index => folderSizes ? defer(async () => ({ ...index, sizes: await readLibraryFileSizes([...index.tracks.values()]) })) : of(index)),
    );
  },
};
