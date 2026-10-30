import { combineLatest, map, shareReplay } from 'rxjs';
import { libraryAlbums, ratingTracks } from './LibraryDataSources';
import { calculateAlbumRatings } from '../utils/albumRanking';

// Both screens share the queries while subscribed; release them when no screen needs the ranking.
const rankings = combineLatest([libraryAlbums, ratingTracks]).pipe(
  map(([albums, tracks]) => calculateAlbumRatings(albums, tracks.map(track => ({ albumId: track.album.id, rating: track.rating })))),
  shareReplay({ bufferSize: 1, refCount: true }),
);

export const AlbumRankingService = {
  observe: () => rankings,
};
