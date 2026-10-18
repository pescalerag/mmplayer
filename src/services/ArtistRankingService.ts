import { combineLatest, map, shareReplay } from 'rxjs';
import { libraryCredits, ratingTracks } from './LibraryDataSources';
import { calculateArtistRatings } from '../utils/trackRatings';

const rankings = combineLatest([ratingTracks, libraryCredits]).pipe(
  map(([tracks, credits]) => calculateArtistRatings(
    tracks.map(track => ({ id: track.id, artistId: track.artist.id, rating: track.rating })),
    credits.map(credit => ({ artistId: credit.artist.id, trackId: credit.track.id })),
  )),
  shareReplay({ bufferSize: 1, refCount: true }),
);

export const ArtistRankingService = { observe: () => rankings };
