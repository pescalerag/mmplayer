export interface RatingSummary {
  readonly average: number | null;
  readonly ratedCount: number;
  readonly totalCount: number;
}

export interface RatedTrack {
  readonly id: string;
  readonly rating: number | null;
  readonly fileUrl?: string;
}

export function isValidRating(rating: number | null): rating is number {
  return (
    rating !== null && Number.isFinite(rating) && rating > 0 && rating <= 5
  );
}

export function summarizeTrackRatings(
  tracks: readonly RatedTrack[],
  excludedPaths: readonly string[] = [],
): RatingSummary {
  const excluded = new Set(excludedPaths);
  const seen = new Set<string>();
  let sum = 0;
  let ratedCount = 0;
  for (const track of tracks) {
    if (seen.has(track.id) || (track.fileUrl && excluded.has(track.fileUrl)))
      continue;
    seen.add(track.id);
    if (isValidRating(track.rating)) {
      sum += track.rating;
      ratedCount++;
    }
  }
  return {
    average: ratedCount ? sum / ratedCount : null,
    ratedCount,
    totalCount: seen.size,
  };
}

export interface ArtistRatingTrack extends RatedTrack {
  readonly artistId: string | null;
}

export function calculateArtistRatings(
  tracks: readonly ArtistRatingTrack[],
  credits: readonly { trackId: string; artistId: string }[],
): Map<string, RatingSummary> {
  const byId = new Map(tracks.map((track) => [track.id, track]));
  const members = new Map<string, Set<string>>();
  const associate = (artistId: string | null, trackId: string) => {
    if (!artistId || !byId.has(trackId)) return;
    const songs = members.get(artistId) ?? new Set<string>();
    songs.add(trackId);
    members.set(artistId, songs);
  };
  tracks.forEach((track) => associate(track.artistId, track.id));
  credits.forEach((credit) => associate(credit.artistId, credit.trackId));
  return new Map(
    [...members].map(([id, songs]) => [
      id,
      summarizeTrackRatings([...songs].map((song) => byId.get(song)!)),
    ]),
  );
}
