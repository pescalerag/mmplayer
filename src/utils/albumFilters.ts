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
export function parseAlbumFilterDraft(draft: AlbumFilterDraft): AlbumFilters | null {
  const result = { ...EMPTY_ALBUM_FILTERS, withoutCover: draft.withoutCover };
  for (const key of Object.keys(result).filter(key => key !== 'withoutCover') as NumericAlbumFilter[]) {
    const value = draft[key].trim();
    if (!value) continue;
    const decimal = key === 'minRating' || key.endsWith('Duration');
    if (!(decimal ? /^\d+(?:[.,]\d+)?$/ : /^\d+$/).test(value)) return null;
    const number = Number(value.replace(',', '.'));
    if (!Number.isFinite(number) || number > Number.MAX_SAFE_INTEGER || (!decimal && !Number.isSafeInteger(number))) return null;
    if (key.endsWith('Year') && (number < 1 || number > 9999)) return null;
    if (key === 'minRating' && number > 5) return null;
    result[key] = number;
  }
  if (result.minTracks !== null && result.maxTracks !== null && result.minTracks > result.maxTracks) return null;
  if (result.minYear !== null && result.maxYear !== null && result.minYear > result.maxYear) return null;
  if (result.minDuration !== null && result.maxDuration !== null && result.minDuration > result.maxDuration) return null;
  return result;
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

export function matchesAlbumFilters(album: { id: string; year: number | null; coverUrl?: string | null }, counts: ReadonlyMap<string, AlbumTrackStats>, filters: AlbumFilters): boolean {
  const stats = counts.get(album.id);
  const count = stats?.count ?? 0;
  if (filters.minTracks !== null && count < filters.minTracks) return false;
  if (filters.maxTracks !== null && count > filters.maxTracks) return false;
  const year = albumYear(album.year);
  if (filters.minYear !== null && (year === null || year < filters.minYear)) return false;
  if (filters.maxYear !== null && (year === null || year > filters.maxYear)) return false;
  const duration = stats?.duration ?? 0;
  if (filters.minDuration !== null && duration < filters.minDuration * 60) return false;
  if (filters.maxDuration !== null && duration > filters.maxDuration * 60) return false;
  if (filters.minRating !== null) {
    if (!stats || stats.ratedCount === 0 || stats.ratingSum / stats.ratedCount < filters.minRating) return false;
  }
  if (filters.withoutCover && hasAlbumCover(album.coverUrl)) return false;
  return true;
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
export function sortLibraryAlbums<T extends { title: string; year: number | null; isPinned: boolean; id: string }>(albums: readonly T[], order: string): T[] {
  return [...albums].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    if (order === 'year_asc' || order === 'year_desc') {
      const ay = albumYear(a.year), by = albumYear(b.year);
      if (ay === null && by !== null) return 1;
      if (by === null && ay !== null) return -1;
      if (ay !== null && by !== null && ay !== by) return order === 'year_asc' ? ay - by : by - ay;
    }
    const name = collator.compare(a.title || '', b.title || '') || a.id.localeCompare(b.id);
    return order === 'name_desc' ? -name : name;
  });
}
