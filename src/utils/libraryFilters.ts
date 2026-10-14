import { hasAlbumCover, parseFilterNumber, validFilterRange } from './albumFilters';

export type FilterSection = 'tracks' | 'playlists' | 'artists' | 'folders';
export type FilterChoice = 'any' | 'yes' | 'no';
export interface SectionFilters {
  minTracks: number | null; maxTracks: number | null;
  minAlbums: number | null; maxAlbums: number | null;
  minDuration: number | null; maxDuration: number | null;
  minRating: number | null; maxRating: number | null;
  minSize: number | null; maxSize: number | null;
  minPlays: number | null; maxPlays: number | null;
  favorite: FilterChoice; lyrics: FilterChoice; image: FilterChoice; customCover: FilterChoice;
  genre: string; formats: string; neverPlayed: boolean;
  playedFrom: string; playedTo: string; createdFrom: string; createdTo: string;
}
export const EMPTY_SECTION_FILTERS: SectionFilters = {
  minTracks: null, maxTracks: null, minAlbums: null, maxAlbums: null, minDuration: null, maxDuration: null,
  minRating: null, maxRating: null, minSize: null, maxSize: null, minPlays: null, maxPlays: null,
  favorite: 'any', lyrics: 'any', image: 'any', customCover: 'any', genre: '', formats: '', neverPlayed: false,
  playedFrom: '', playedTo: '', createdFrom: '', createdTo: '',
};
export const SECTION_FIELDS: Record<FilterSection, (keyof SectionFilters)[]> = {
  tracks: ['favorite', 'minRating', 'maxRating', 'minDuration', 'maxDuration', 'lyrics', 'genre', 'formats', 'neverPlayed'],
  playlists: ['minTracks', 'maxTracks', 'minDuration', 'maxDuration', 'customCover', 'createdFrom', 'createdTo'],
  artists: ['minAlbums', 'maxAlbums', 'minTracks', 'maxTracks', 'image', 'minPlays', 'maxPlays', 'playedFrom', 'playedTo'],
  folders: ['minTracks', 'maxTracks', 'minSize', 'maxSize', 'formats'],
};
export function hasSectionFilters(filters: SectionFilters): boolean {
  return Object.values(filters).some(value => value !== null && value !== false && value !== '' && value !== 'any');
}
export function filteredTrackContext(filters: SectionFilters): string {
  return hasSectionFilters(filters) ? `library-all-tracks:${JSON.stringify(filters)}` : 'library-all-tracks';
}
export function dateBoundary(value: string, end = false): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1000) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  if (end) date.setHours(23, 59, 59, 999);
  return date.getTime();
}
export function inDateRange(time: number, from: string, to: string): boolean {
  const start = from ? dateBoundary(from) : null;
  const end = to ? dateBoundary(to, true) : null;
  if ((from && start === null) || (to && end === null)) return false;
  return Number.isFinite(time) && (start === null || time >= start) && (end === null || time <= end);
}
export type SectionFilterDraft = Record<keyof SectionFilters, string | boolean>;
function draftFieldValue(value: SectionFilters[keyof SectionFilters]): string | boolean {
  if (value === null) return '';
  if (typeof value === 'number') return String(value);
  return value;
}
export function createSectionDraft(filters: SectionFilters): SectionFilterDraft {
  return Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, draftFieldValue(value)])) as SectionFilterDraft;
}

function parseSectionField(key: keyof SectionFilters, value: string | boolean): SectionFilters[keyof SectionFilters] | undefined {
  if (key === 'neverPlayed') return value === true;
  const text = String(value ?? '').trim();
  if (key.startsWith('min') || key.startsWith('max')) {
    if (!text) return null;
    return parseFilterNumber(key, text) ?? undefined;
  }
  if (['favorite', 'lyrics', 'image', 'customCover'].includes(key)) {
    return ['any', 'yes', 'no'].includes(text) ? text : undefined;
  }
  if (/From|To/.test(key) && text && dateBoundary(text) === null) return undefined;
  return text;
}

function validSectionNumberRanges(filters: SectionFilters): boolean {
  return ['Tracks', 'Albums', 'Duration', 'Rating', 'Size', 'Plays'].every(suffix => {
    const min = filters[`min${suffix}` as keyof SectionFilters] as number | null;
    const max = filters[`max${suffix}` as keyof SectionFilters] as number | null;
    return validFilterRange(min, max);
  });
}

function validSectionDateRange(from: string, to: string): boolean {
  return !(from && to && from > to);
}

function normalizedFilterFormats(value: string): string | null {
  if (!value) return '';
  const list = formats(value);
  if (!list.length || list.some(format => !/^[a-z0-9]+$/.test(format))) return null;
  return list.join(', ');
}

export function parseSectionDraft(section: FilterSection, draft: SectionFilterDraft): SectionFilters | null {
  const result = { ...EMPTY_SECTION_FILTERS };
  for (const key of SECTION_FIELDS[section]) {
    const value = parseSectionField(key, draft[key]);
    if (value === undefined) return null;
    Object.assign(result, { [key]: value });
  }
  if (!validSectionNumberRanges(result)) return null;
  if (!validSectionDateRange(result.createdFrom, result.createdTo) || !validSectionDateRange(result.playedFrom, result.playedTo)) return null;
  const normalizedFormats = normalizedFilterFormats(result.formats);
  if (normalizedFormats === null) return null;
  result.formats = normalizedFormats;
  return result;
}

export interface FilterTrack {
  id: string; fileUrl: string; duration: number; rating: number | null; genre: string | null;
  isFavorite: boolean; lyricsLRC: string | null; lastModified: number;
  album: { id: string }; artist: { id: string };
}
export interface ArtistFilterStats { albums: Set<string>; tracks: Set<string>; plays: number }
export interface LibraryFilterIndex {
  tracks: Map<string, FilterTrack>; played: Set<string>;
  playlists: Map<string, { count: number; duration: number }>;
  artists: Map<string, ArtistFilterStats>; sizes: Map<string, number | null>;
}
export function emptyLibraryFilterIndex(): LibraryFilterIndex {
  return { tracks: new Map(), played: new Set(), playlists: new Map(), artists: new Map(), sizes: new Map() };
}
export function buildLibraryFilterIndex(
  tracks: readonly FilterTrack[], albums: readonly { id: string; artist: { id: string } }[],
  memberships: readonly { playlist: { id: string }; track: { id: string } }[],
  collaborators: readonly { artist: { id: string }; track: { id: string } }[],
  history: readonly { itemType: string; itemId: string; playedAt: Date }[], filters: SectionFilters,
): LibraryFilterIndex {
  const index = emptyLibraryFilterIndex();
  const artistStats = (id: string) => {
    let stats = index.artists.get(id);
    if (!stats) { stats = { albums: new Set(), tracks: new Set(), plays: 0 }; index.artists.set(id, stats); }
    return stats;
  };
  const artistsByTrack = new Map<string, Set<string>>();
  for (const album of albums) artistStats(album.artist.id).albums.add(album.id);
  const addArtist = (trackId: string, artistId: string) => {
    const track = index.tracks.get(trackId);
    if (!track) return;
    const ids = artistsByTrack.get(trackId) ?? new Set<string>(); ids.add(artistId); artistsByTrack.set(trackId, ids);
    const stats = artistStats(artistId); stats.tracks.add(trackId); stats.albums.add(track.album.id);
  };
  for (const track of tracks) { index.tracks.set(track.id, track); addArtist(track.id, track.artist.id); }
  for (const collaborator of collaborators) addArtist(collaborator.track.id, collaborator.artist.id);
  for (const entry of history) {
    if (entry.itemType !== 'track') continue;
    index.played.add(entry.itemId);
    if (!inDateRange(entry.playedAt.getTime(), filters.playedFrom, filters.playedTo)) continue;
    for (const artistId of artistsByTrack.get(entry.itemId) ?? []) artistStats(artistId).plays++;
  }
  for (const membership of memberships) {
    const track = index.tracks.get(membership.track.id);
    if (!track) continue;
    const stats = index.playlists.get(membership.playlist.id) ?? { count: 0, duration: 0 };
    stats.count++; stats.duration += Math.max(0, Number.isFinite(track.duration) ? track.duration : 0);
    index.playlists.set(membership.playlist.id, stats);
  }
  return index;
}

function bounded(value: number, min: number | null, max: number | null): boolean {
  return (min === null || value >= min) && (max === null || value <= max);
}
function choice(value: boolean, filter: FilterChoice): boolean { return filter === 'any' || value === (filter === 'yes'); }
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function fileFormat(uri: string): string {
  let path = uri.split('?')[0];
  try { path = decodeURIComponent(path); } catch {}
  return /\.([a-z0-9]+)$/i.exec(path)?.[1].toLowerCase() ?? '';
}
function formats(value: string): string[] { return value.split(',').map(item => item.trim().replace(/^\./, '').toLowerCase()).filter(Boolean); }
export function matchesTrackFilters(track: FilterTrack, filters: SectionFilters, index: LibraryFilterIndex): boolean {
  if (!choice(track.isFavorite, filters.favorite) || !choice(!!track.lyricsLRC?.trim(), filters.lyrics)) return false;
  if (!bounded(track.duration / 60, filters.minDuration, filters.maxDuration)) return false;
  if (filters.minRating !== null || filters.maxRating !== null) {
    if (track.rating === null || track.rating <= 0 || !bounded(track.rating, filters.minRating, filters.maxRating)) return false;
  }
  if (filters.genre && normalize(track.genre ?? '') !== normalize(filters.genre)) return false;
  if (filters.formats && !formats(filters.formats).includes(fileFormat(track.fileUrl))) return false;
  return !filters.neverPlayed || !index.played.has(track.id);
}
export function matchesPlaylistFilters(playlist: { id: string; coverCustomUrl?: string | null; createdAt?: number }, filters: SectionFilters, index: LibraryFilterIndex, tracks?: readonly FilterTrack[]): boolean {
  const stats = tracks ? { count: tracks.length, duration: tracks.reduce((sum, track) => sum + Math.max(0, track.duration), 0) } : index.playlists.get(playlist.id) ?? { count: 0, duration: 0 };
  if (!bounded(stats.count, filters.minTracks, filters.maxTracks) || !bounded(stats.duration / 60, filters.minDuration, filters.maxDuration)) return false;
  if (!choice(hasAlbumCover(playlist.coverCustomUrl), filters.customCover)) return false;
  if (filters.createdFrom || filters.createdTo) {
    if (playlist.createdAt === undefined || !inDateRange(playlist.createdAt, filters.createdFrom, filters.createdTo)) return false;
  }
  return true;
}
export function matchesArtistFilters(artist: { id: string; imageUrl: string | null }, filters: SectionFilters, index: LibraryFilterIndex): boolean {
  const stats = index.artists.get(artist.id) ?? { albums: new Set(), tracks: new Set(), plays: 0 };
  if (!choice(hasAlbumCover(artist.imageUrl), filters.image)) return false;
  if (!bounded(stats.albums.size, filters.minAlbums, filters.maxAlbums) || !bounded(stats.tracks.size, filters.minTracks, filters.maxTracks)) return false;
  const minPlays = filters.minPlays ?? ((filters.playedFrom || filters.playedTo) && filters.maxPlays === null ? 1 : null);
  return bounded(stats.plays, minPlays, filters.maxPlays);
}
export function matchesFolderFilters(tracks: readonly FilterTrack[], filters: SectionFilters, index: LibraryFilterIndex): boolean {
  if (!bounded(tracks.length, filters.minTracks, filters.maxTracks)) return false;
  if (filters.formats && !tracks.some(track => formats(filters.formats).includes(fileFormat(track.fileUrl)))) return false;
  if (filters.minSize !== null || filters.maxSize !== null) {
    let size = 0;
    for (const track of tracks) {
      const bytes = index.sizes.get(track.id);
      if (bytes === null || bytes === undefined) return false;
      size += bytes;
    }
    if (!bounded(size / (1024 * 1024), filters.minSize, filters.maxSize)) return false;
  }
  return true;
}
