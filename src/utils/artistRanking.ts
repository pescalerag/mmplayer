import { AlbumRatingOrder, sortAlbumRatings } from './albumRanking';
import { RatingSummary } from './trackRatings';

interface RankableArtist {
  readonly id: string;
  readonly name: string;
  readonly isPinned: boolean;
}

export function sortRatedArtists<T extends RankableArtist>(artists: readonly T[], ratings: ReadonlyMap<string, RatingSummary>, order: AlbumRatingOrder): T[] {
  const byId = new Map(artists.map(artist => [artist.id, artist]));
  const ranked = artists.map(artist => ({
    album: { id: artist.id, title: artist.name, isPinned: artist.isPinned },
    ...(ratings.get(artist.id) ?? { average: null, ratedCount: 0, totalCount: 0 }),
  }));
  // Keep exactly the album ranking's pinned, unrated and tie-breaking rules.
  return sortAlbumRatings(ranked, order, true).map(item => byId.get(item.album.id)!);
}
