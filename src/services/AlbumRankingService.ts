import { combineLatest, defer, map, shareReplay } from 'rxjs';
import { database } from '../database';
import Album from '../database/models/Album';
import Track from '../database/models/Track';
import { calculateAlbumRatings } from '../utils/albumRanking';

// Both screens share the queries while subscribed; release them when no screen needs the ranking.
const rankings = defer(() => combineLatest([
  database.get<Album>('albums').query().observeWithColumns(['title', 'year', 'is_pinned', 'cover_url']),
  database.get<Track>('tracks').query().observeWithColumns(['rating', 'album_id']),
])).pipe(
  map(([albums, tracks]) => calculateAlbumRatings(albums, tracks.map(track => ({ albumId: track.album.id, rating: track.rating })))),
  shareReplay({ bufferSize: 1, refCount: true }),
);

export const AlbumRankingService = {
  observe: () => rankings,
};
