import { Period } from './activityDateUtils';

export type Metric = 'duration' | 'plays';
export type ActivityOption = 'highlights' | 'songs' | 'albums' | 'artists';

export interface DetailedStats {
  totalHours: number;
  totalPlays: number;
  topSongs: any[];
  topAlbums: any[];
  topArtists: any[];
}

export interface DisplayStats {
  totalHours: number;
  totalPlays: number;
  topSong: string;
  topSongId: string;
  topSongImg: string | null;
  topSongArtist: string;
  topSongDuration: number;
  topSongPlays: number;
  topAlbum: string;
  topAlbumId: string;
  topAlbumImg: string | null;
  topAlbumDuration: number;
  topAlbumPlays: number;
  topArtist: string;
  topArtistId: string;
  topArtistImg: string | null;
  topArtistDuration: number;
  topArtistPlays: number;
}

export interface SmartListItem {
  id: string;
  name: string;
  placeholderIcon: string;
  trackCount: number;
}

export const EMPTY_DETAILED_STATS: DetailedStats = {
  totalHours: 0,
  totalPlays: 0,
  topSongs: [],
  topAlbums: [],
  topArtists: [],
};

export const TUTORIAL_MOCK_STATS: DisplayStats = {
  totalHours: 14.5,
  totalPlays: 128,
  topSong: 'Midnight City',
  topSongId: '',
  topSongImg: null,
  topSongArtist: 'M83',
  topSongDuration: 245,
  topSongPlays: 42,
  topAlbum: "Hurry Up, We're Dreaming",
  topAlbumId: '',
  topAlbumImg: null,
  topAlbumDuration: 3600,
  topAlbumPlays: 65,
  topArtist: 'M83',
  topArtistId: '',
  topArtistImg: null,
  topArtistDuration: 7200,
  topArtistPlays: 110,
};

export function formatDuration(seconds: number, t: (key: string) => string): string {
  if (!seconds || seconds <= 0) return `0 ${t('activity.min_suffix')}`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} ${t('activity.min_suffix')}`;
  const hours = (seconds / 3600).toFixed(1);
  return `${hours} ${t('activity.hour_suffix')}`;
}

export function getSectionLabel(
  period: Period,
  dateOffset: number,
  rangeLabel: string,
  t: (key: string) => string
): string {
  if (period === 'all' || period === 'custom') {
    return t('activity.global_highlights');
  }

  if (dateOffset !== 0) {
    const highlights = t('activity.options.highlights') || 'Destacados';
    return `${highlights} · ${rangeLabel}`;
  }

  const periodHighlightKeys: Record<string, string> = {
    day: 'activity.today_highlights',
    week: 'activity.week_highlights',
    month: 'activity.month_highlights',
    year: 'activity.year_highlights',
  };

  const key = periodHighlightKeys[period];
  return key ? t(key) : t('activity.global_highlights');
}

export function getHighlightStatLabel(
  metric: Metric,
  duration: number,
  plays: number,
  t: (key: string, opts?: any) => string
): string {
  if (metric === 'duration') {
    return t('activity.listening_time', { time: formatDuration(duration, t) });
  }
  const key = plays === 1 ? 'activity.reproduction_singular' : 'activity.reproduction_plural';
  return t(key, { count: plays });
}

export function getSongHighlightStatLabel(
  metric: Metric,
  artistName: string | undefined,
  duration: number,
  plays: number,
  t: (key: string, opts?: any) => string
): string {
  const artist = artistName || t('activity.unknown_artist');
  if (metric === 'duration') {
    return `${artist} · ${formatDuration(duration, t)}`;
  }
  const key = plays === 1 ? 'activity.reproduction_singular' : 'activity.reproduction_plural';
  const stat = t(key, { count: plays });

  return `${artist} · ${stat}`;
}

export function getItemStatLabel(
  metric: Metric,
  duration: number,
  plays: number,
  t: (key: string, opts?: any) => string
): string {
  if (metric === 'duration') {
    return formatDuration(duration, t);
  }
  const key = plays === 1 ? 'activity.reproduction_singular' : 'activity.reproduction_plural';
  return t(key, { count: plays });
}

export function getDisplayStats(
  detailedStats: DetailedStats,
  hasRealActivity: boolean,
  isTutorialVisible: boolean
): DisplayStats {
  if (!hasRealActivity && isTutorialVisible) {
    return TUTORIAL_MOCK_STATS;
  }
  const topSong = detailedStats.topSongs[0];
  const topAlbum = detailedStats.topAlbums[0];
  const topArtist = detailedStats.topArtists[0];
  return {
    totalHours: detailedStats.totalHours,
    totalPlays: detailedStats.totalPlays,
    topSong: topSong?.title || '',
    topSongId: topSong?.id || '',
    topSongImg: topSong?.coverUrl || null,
    topSongArtist: topSong?.artistName || '',
    topSongDuration: topSong?.duration || 0,
    topSongPlays: topSong?.plays || 0,
    topAlbum: topAlbum?.title || '',
    topAlbumId: topAlbum?.id || '',
    topAlbumImg: topAlbum?.coverUrl || null,
    topAlbumDuration: topAlbum?.duration || 0,
    topAlbumPlays: topAlbum?.plays || 0,
    topArtist: topArtist?.name || '',
    topArtistId: topArtist?.id || '',
    topArtistImg: topArtist?.imageUrl || null,
    topArtistDuration: topArtist?.duration || 0,
    topArtistPlays: topArtist?.plays || 0,
  };
}

export function getVisibleSmartLists(
  smartLists: SmartListItem[],
  period: Period,
  dateOffset: number,
  isTutorialVisible: boolean
): SmartListItem[] {
  const nonKeys = smartLists.filter((l) => l.trackCount > 0);
  if (nonKeys.length === 0 && isTutorialVisible) {
    return [
      { id: 'top_50_week', name: 'Top 50 Semanal', placeholderIcon: 'trending-up', trackCount: 50 },
      { id: 'top_50', name: 'Top 50 Global', placeholderIcon: 'star', trackCount: 50 },
    ];
  }
  if (period === 'week' && dateOffset === 0) {
    return nonKeys.filter((l) => l.id === 'top_50_week' || l.id === 'top_50');
  }
  if (period === 'month' && dateOffset === 0) {
    return nonKeys.filter((l) => l.id === 'top_50_month' || l.id === 'top_50');
  }
  return nonKeys.filter((l) => l.id === 'top_50');
}
