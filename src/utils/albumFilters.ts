export interface AlbumFilters {
  minTracks: number | null;
  maxTracks: number | null;
  minYear: number | null;
  maxYear: number | null;
  minDuration: number | null;
  maxDuration: number | null;
  minRating: number | null;
  withoutCover: boolean;
}

export const EMPTY_ALBUM_FILTERS: AlbumFilters = { minTracks: null, maxTracks: null, minYear: null, maxYear: null, minDuration: null, maxDuration: null, minRating: null, withoutCover: false };

export type NumericAlbumFilter = Exclude<keyof AlbumFilters, 'withoutCover'>;
export type AlbumFilterDraft = Record<NumericAlbumFilter, string> & { withoutCover: boolean };
export function createAlbumFilterDraft(filters: AlbumFilters): AlbumFilterDraft {
  return {
    minTracks: filters.minTracks?.toString() ?? '', maxTracks: filters.maxTracks?.toString() ?? '',
    minYear: filters.minYear?.toString() ?? '', maxYear: filters.maxYear?.toString() ?? '',
    minDuration: filters.minDuration?.toString() ?? '', maxDuration: filters.maxDuration?.toString() ?? '',
    minRating: filters.minRating?.toString() ?? '', withoutCover: filters.withoutCover ?? false,
  };
}
export function parseFilterNumber(key: string, value: string): number | null {
  const decimal = /Duration|Rating|Size/.test(key);
  const pattern = decimal ? /^\d+(?:[.,]\d+)?$/ : /^\d+$/;
  if (!pattern.test(value)) return null;
  const number = Number(value.replace(',', '.'));
  if (!Number.isFinite(number) || number > Number.MAX_SAFE_INTEGER || (!decimal && !Number.isSafeInteger(number))) return null;
  if (key.endsWith('Year') && (number < 1 || number > 9999)) return null;
  if (key.endsWith('Rating') && number > 5) return null;
  return number;
}

export function validFilterRange(min: number | null, max: number | null): boolean {
  return !(min !== null && max !== null && min > max);
}

export function parseAlbumFilterDraft(draft: AlbumFilterDraft): AlbumFilters | null {
  const result = { ...EMPTY_ALBUM_FILTERS, withoutCover: draft.withoutCover };
  for (const key of Object.keys(result).filter(key => key !== 'withoutCover') as NumericAlbumFilter[]) {
    const value = draft[key].trim();
    if (!value) continue;
    const number = parseFilterNumber(key, value);
    if (number === null) return null;
    result[key] = number;
  }
  const ranges = [[result.minTracks, result.maxTracks], [result.minYear, result.maxYear], [result.minDuration, result.maxDuration]];
  return ranges.every(([min, max]) => validFilterRange(min, max)) ? result : null;
}

export function hasAlbumFilters(filters: AlbumFilters): boolean {
  return Object.values(filters).some(value => value !== null && value !== false);
}

export interface AlbumTrackStats { count: number; duration: number; ratingSum: number; ratedCount: number }
export function summarizeAlbumTracks(tracks: readonly { album: { id: string }; duration: number; rating: number | null }[]): Map<string, AlbumTrackStats> {
  const stats = new Map<string, AlbumTrackStats>();
  for (const track of tracks) {
    const item = stats.get(track.album.id) ?? { count: 0, duration: 0, ratingSum: 0, ratedCount: 0 };
    item.count++;
    if (Number.isFinite(track.duration) && track.duration > 0) item.duration += track.duration;
    if (track.rating !== null && Number.isFinite(track.rating) && track.rating > 0 && track.rating <= 5) {
      item.ratingSum += track.rating; item.ratedCount++;
    }
    stats.set(track.album.id, item);
  }
  return stats;
}

export function needsAlbumTrackStats(filters: AlbumFilters): boolean {
  return [filters.minTracks, filters.maxTracks, filters.minDuration, filters.maxDuration, filters.minRating].some(value => value !== null);
}

export function hasAlbumCover(uri?: string | null): boolean {
  return !!uri?.trim() && uri.trim() !== 'null' && !/nullcover(?:[._-]|$)/i.test(uri);
}

export function albumYear(year: number | null): number | null {
  return typeof year === 'number' && Number.isInteger(year) && year > 0 ? year : null;
}

function matchesBounds(value: number, min: number | null, max: number | null, scale = 1): boolean {
  return !((min !== null && value < min * scale) || (max !== null && value > max * scale));
}

function matchesYear(year: number | null, filters: AlbumFilters): boolean {
  if (year === null) return filters.minYear === null && filters.maxYear === null;
  return matchesBounds(year, filters.minYear, filters.maxYear);
}

function matchesAlbumRating(stats: AlbumTrackStats | undefined, minimum: number | null): boolean {
  if (minimum === null) return true;
  if (!stats || stats.ratedCount === 0) return false;
  return !(stats.ratingSum / stats.ratedCount < minimum);
}

export function matchesAlbumFilters(album: { id: string; year: number | null; coverUrl?: string | null }, counts: ReadonlyMap<string, AlbumTrackStats>, filters: AlbumFilters): boolean {
  const stats = counts.get(album.id);
  return matchesBounds(stats?.count ?? 0, filters.minTracks, filters.maxTracks)
    && matchesYear(albumYear(album.year), filters)
    && matchesBounds(stats?.duration ?? 0, filters.minDuration, filters.maxDuration, 60)
    && matchesAlbumRating(stats, filters.minRating)
    && !(filters.withoutCover && hasAlbumCover(album.coverUrl));
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
function compareAlbumYears(a: number | null, b: number | null, order: string): number {
  const ay = albumYear(a), by = albumYear(b);
  if (ay === null) return by === null ? 0 : 1;
  if (by === null) return -1;
  return order === 'year_asc' ? ay - by : by - ay;
}
export function sortLibraryAlbums<T extends { title: string; year: number | null; isPinned: boolean; id: string }>(albums: readonly T[], order: string): T[] {
  return [...albums].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    if (order === 'year_asc' || order === 'year_desc') {
      const yearComparison = compareAlbumYears(a.year, b.year, order);
      if (yearComparison !== 0) return yearComparison;
    }
    const name = collator.compare(a.title || '', b.title || '') || a.id.localeCompare(b.id);
    return order === 'name_desc' ? -name : name;
  });
}
