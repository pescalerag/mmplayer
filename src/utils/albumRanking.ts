export interface RatingTrack {
  readonly albumId: string | null;
  readonly rating: number | null;
}

export interface RankableAlbum {
  readonly id: string;
  readonly title: string;
  readonly isPinned: boolean;
}

export interface RankedAlbum<T extends RankableAlbum = RankableAlbum> {
  readonly album: T;
  readonly average: number | null;
  readonly ratedCount: number;
  readonly totalCount: number;
}

export type AlbumRatingOrder = 'rating_desc' | 'rating_asc';

export function calculateAlbumRatings<T extends RankableAlbum>(albums: readonly T[], tracks: readonly RatingTrack[]): RankedAlbum<T>[] {
  const totals = new Map<string, { sum: number; rated: number; total: number }>();
  for (const track of tracks) {
    if (!track.albumId) continue;
    const value = totals.get(track.albumId) ?? { sum: 0, rated: 0, total: 0 };
    value.total++;
    if (track.rating !== null && Number.isFinite(track.rating) && track.rating > 0 && track.rating <= 5) {
      value.sum += track.rating;
      value.rated++;
    }
    totals.set(track.albumId, value);
  }
  return albums.map(album => {
    const value = totals.get(album.id) ?? { sum: 0, rated: 0, total: 0 };
    return { album, average: value.rated === 0 ? null : value.sum / value.rated, ratedCount: value.rated, totalCount: value.total };
  });
}

function compareRatings<T extends RankableAlbum>(a: RankedAlbum<T>, b: RankedAlbum<T>, order: AlbumRatingOrder): number {
  if (a.average === null && b.average !== null) return 1;
  if (b.average === null && a.average !== null) return -1;
  const difference = (a.average ?? 0) - (b.average ?? 0);
  if (difference !== 0) return order === 'rating_asc' ? difference : -difference;
  return b.ratedCount - a.ratedCount || a.album.title.localeCompare(b.album.title) || a.album.id.localeCompare(b.album.id);
}

export function sortAlbumRatings<T extends RankableAlbum>(ratings: readonly RankedAlbum<T>[], order: AlbumRatingOrder, pinnedFirst = false): RankedAlbum<T>[] {
  return [...ratings].sort((a, b) => {
    if (pinnedFirst && a.album.isPinned !== b.album.isPinned) return a.album.isPinned ? -1 : 1;
    return compareRatings(a, b, order);
  });
}

export function getTopRatedAlbums<T extends RankableAlbum>(ratings: readonly RankedAlbum<T>[]): RankedAlbum<T>[] {
  return sortAlbumRatings(ratings.filter(item => item.average !== null), 'rating_desc').slice(0, 10);
}
