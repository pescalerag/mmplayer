import { Q } from '@nozbe/watermelondb';
import i18n from "../constants/i18n";
import { database } from "../database";
import Album from "../database/models/Album";
import PlaybackHistory from "../database/models/PlaybackHistory";
import Track from "../database/models/Track";
import { usePlayerStore } from "../store/usePlayerStore";

export type UIHistoryPayload = {
  id: string;
  type: "track" | "album" | "playlist" | "artist" | "folder";
  context: "manual" | "queue";
  durationPlayed?: number;
  title?: string;
  subtitle?: string;
  imageUrl?: string | null;
};

type HistorySummary = {
  totalSeconds: number;
  totalPlays: number;
  trackDurations: Record<string, number>;
  trackPlayCounts: Record<string, number>;
};

type AggregatedArtist = { id: string; name: string; imageUrl: string | null; duration: number; plays: number };
type AggregatedAlbum = { id: string; title: string; coverUrl: string | null; artistName: string; duration: number; plays: number };
type AggregatedSong = { id: string; title: string; coverUrl: string | null; artistName: string; duration: number; plays: number };

function summarizeHistoryRecords(records: PlaybackHistory[]): HistorySummary {
  let totalSeconds = 0;
  const trackDurations: Record<string, number> = {};
  const trackPlayCounts: Record<string, number> = {};

  for (const record of records) {
    const seconds = record.durationPlayed || 0;
    totalSeconds += seconds;
    trackDurations[record.itemId] = (trackDurations[record.itemId] || 0) + seconds;
    trackPlayCounts[record.itemId] = (trackPlayCounts[record.itemId] || 0) + 1;
  }

  return {
    totalSeconds,
    totalPlays: records.length,
    trackDurations,
    trackPlayCounts,
  };
}

function updateArtistStat(
  artistData: Record<string, AggregatedArtist>,
  artist: { id: string; name: string; imageUrl?: string | null } | null,
  dur: number,
  cnt: number
) {
  if (!artist) return;
  const current = artistData[artist.id] || {
    id: artist.id,
    name: artist.name,
    imageUrl: artist.imageUrl || null,
    duration: 0,
    plays: 0,
  };
  current.duration += dur;
  current.plays += cnt;
  artistData[artist.id] = current;
}

function updateAlbumStat(
  albumData: Record<string, AggregatedAlbum>,
  album: { id: string; title: string; coverUrl?: string | null } | null,
  artistName: string,
  dur: number,
  cnt: number
) {
  if (!album) return;
  const current = albumData[album.id] || {
    id: album.id,
    title: album.title,
    coverUrl: album.coverUrl || null,
    artistName,
    duration: 0,
    plays: 0,
  };
  current.duration += dur;
  current.plays += cnt;
  albumData[album.id] = current;
}

function updateSongStat(
  songData: Record<string, AggregatedSong>,
  track: Track,
  coverUrl: string | null,
  artistName: string,
  dur: number,
  cnt: number
) {
  const current = songData[track.id] || {
    id: track.id,
    title: track.title,
    coverUrl,
    artistName,
    duration: 0,
    plays: 0,
  };
  current.duration += dur;
  current.plays += cnt;
  songData[track.id] = current;
}

async function buildMediaStats(
  tracks: Track[],
  trackDurations: Record<string, number>,
  trackPlayCounts: Record<string, number>
) {
  const artistData: Record<string, AggregatedArtist> = {};
  const albumData: Record<string, AggregatedAlbum> = {};
  const songData: Record<string, AggregatedSong> = {};

  const relevantTracks = tracks.filter((track) => {
    const dur = trackDurations[track.id] || 0;
    const cnt = trackPlayCounts[track.id] || 0;
    return dur > 0 || cnt > 0;
  });

  const resolvedTracks = await Promise.all(
    relevantTracks.map(async (track) => {
      const [artist, album] = await Promise.all([
        track.artist.fetch().catch(() => null),
        track.album.fetch().catch(() => null),
      ]);
      const dur = trackDurations[track.id] || 0;
      const cnt = trackPlayCounts[track.id] || 0;
      return { track, artist, album, dur, cnt };
    })
  );

  for (const { track, artist, album, dur, cnt } of resolvedTracks) {
    const artistName = artist?.name || '';
    const coverUrl = album?.coverUrl || null;

    updateArtistStat(artistData, artist, dur, cnt);
    updateAlbumStat(albumData, album, artistName, dur, cnt);
    updateSongStat(songData, track, coverUrl, artistName, dur, cnt);
  }

  return { artistData, albumData, songData };
}

function findTopItem<T extends { duration: number; plays: number }>(
  items: Record<string, T>,
  metric: 'duration' | 'plays'
): T | null {
  let topItem: T | null = null;
  let maxScore = 0;
  for (const item of Object.values(items)) {
    const score = metric === 'duration' ? item.duration : item.plays;
    if (score > maxScore) {
      maxScore = score;
      topItem = item;
    }
  }
  return topItem;
}

function clampCustomTo(customTo?: Date): Date {
  const to = customTo ? new Date(customTo) : new Date();
  const maxTo = new Date();
  maxTo.setHours(23, 59, 59, 999);
  return to.getTime() > maxTo.getTime() ? maxTo : to;
}

async function clampCustomFrom(
  customFrom: Date | null | undefined,
  getFirstHistoryDate: () => Promise<Date | null>
): Promise<Date | null> {
  if (!customFrom) return null;
  const from = new Date(customFrom);
  const firstDate = await getFirstHistoryDate();
  if (!firstDate) return from;

  const firstDayStart = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate(), 0, 0, 0, 0);
  return from.getTime() < firstDayStart.getTime() ? firstDayStart : from;
}

async function resolveCustomDateRange(
  customFrom: Date | null | undefined,
  customTo: Date | undefined,
  getFirstHistoryDate: () => Promise<Date | null>
): Promise<{ from: Date | null; to: Date }> {
  const to = clampCustomTo(customTo);
  let from = await clampCustomFrom(customFrom, getFirstHistoryDate);

  if (from && from.getTime() > to.getTime()) {
    from = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 0, 0, 0, 0);
  }

  return { from, to };
}

async function resolveDetailedStatsRange(
  period: 'day' | 'week' | 'month' | 'year' | 'all' | 'custom',
  customFrom: Date | null | undefined,
  customTo: Date | undefined,
  getPeriodRange: (period: any) => { from: Date | null; to: Date },
  getFirstHistoryDate: () => Promise<Date | null>
): Promise<{ from: Date | null; to: Date }> {
  const isCustom = period === 'custom' || (customFrom !== undefined && period !== 'all');
  if (isCustom) {
    return resolveCustomDateRange(customFrom, customTo, getFirstHistoryDate);
  }
  return getPeriodRange(period);
}

function queryHistoryInRange(from: Date | null, to: Date) {
  const collection = database.collections.get<PlaybackHistory>('playback_history');
  if (from) {
    return collection.query(
      Q.where('played_at', Q.gte(from.getTime())),
      Q.where('played_at', Q.lte(to.getTime()))
    );
  }
  return collection.query(
    Q.where('played_at', Q.lte(to.getTime()))
  );
}

async function fetchDetailedMediaStats(
  uniqueTrackIds: string[],
  trackDurations: Record<string, number>,
  trackPlayCounts: Record<string, number>,
  metric: 'duration' | 'plays',
  limit = 50
) {
  if (uniqueTrackIds.length === 0) {
    return { topSongs: [], topAlbums: [], topArtists: [] };
  }

  try {
    const tracks = await database.collections
      .get<Track>('tracks')
      .query(Q.where('id', Q.oneOf(uniqueTrackIds)))
      .fetch();

    const { artistData, albumData, songData } = await buildMediaStats(tracks, trackDurations, trackPlayCounts);

    const scoreOf = (d: { duration: number; plays: number }) =>
      metric === 'duration' ? d.duration : d.plays;

    const sortedSongs = Object.values(songData).sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, limit);
    const sortedAlbums = Object.values(albumData).sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, limit);
    const sortedArtists = Object.values(artistData).sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, limit);

    return {
      topSongs: sortedSongs,
      topAlbums: sortedAlbums,
      topArtists: sortedArtists,
    };
  } catch (e) {
    console.warn('[HistoryService] Error calculating detailed stats:', e);
    return { topSongs: [], topAlbums: [], topArtists: [] };
  }
}


export const HistoryService = {
  /**
   * 1. ACTUALIZA LA INTERFAZ AL INSTANTE (HomeScreen)
   * Al darle a los botones de "Play" de la app.
   */
  async updateUIRecents(item: UIHistoryPayload) {
    let finalTitle = item.title;
    let finalSubtitle = item.subtitle;
    let finalImageUrl = item.imageUrl;

    if (item.type === "track") {
      try {
        const cleanId = item.id.split('-')[0];
        const track = await database.get<Track>('tracks').find(cleanId);
        finalTitle = track.title;

        if (!finalImageUrl || finalImageUrl === 'null') {
          const album = await track.album.fetch();
          finalImageUrl = album?.coverUrl || null;
        }

        if (!finalSubtitle || finalSubtitle === 'Artista desconocido') {
          const artist = await track.artist.fetch();
          finalSubtitle = artist?.name || 'Artista desconocido';
        }
      } catch (error) {
        console.warn("No se pudo autocompletar la info del track:", error);
      }
    }

    if (item.type === "playlist") {
      usePlayerStore.getState().addPlaylistToRecents({
        id: item.id,
        name: finalTitle || "Lista de reproducción sin título",
        description: finalSubtitle || null,
        imageUrl: finalImageUrl || null,
      });
    } else {
      usePlayerStore.getState().addMediaToRecents({
        id: item.id.split('-')[0],
        type: item.type as "track" | "album" | "artist",
        title: finalTitle || "Sin título",
        subtitle: finalSubtitle || "Artista desconocido",
        imageUrl: finalImageUrl || null,
      });
    }
  },

  /**
   * 2. GUARDA EN WATERMELONDB CON DURACIÓN EXACTA
   * Esto se llamará automáticamente en segundo plano cuando la canción termine o cambie.
   */
  async logToDatabase(
    trackId: string,
    durationPlayed: number,
    context: "manual" | "queue" = "queue",
  ) {
    try {
      if (durationPlayed < 10) return;

      const cleanId = trackId.split('-')[0];

      // Límite de seguridad: ninguna reproducción individual puede superar la duración de la canción
      let cappedDuration = durationPlayed;
      try {
        const track = await database.get<Track>('tracks').find(cleanId);
        if (track?.duration && track.duration > 0) {
          cappedDuration = Math.min(durationPlayed, track.duration);
        } else {
          cappedDuration = Math.min(durationPlayed, 600);
        }
      } catch {
        cappedDuration = Math.min(durationPlayed, 600);
      }

      await database.write(async () => {
        await database.collections
          .get<PlaybackHistory>("playback_history")
          .create((record) => {
            record.itemId = cleanId;
            record.itemType = "track";
            record.playContext = context;
            record.durationPlayed = Math.floor(cappedDuration);
            record.playedAt = new Date();
          });
      });
      console.log(
        `[Historial] Canción ${cleanId} guardada. Tiempo: ${Math.floor(cappedDuration)}s`,
      );
    } catch (error) {
      console.error("Error guardando en base de datos:", error);
    }
  },

  /**
   * Sanea registros con duraciones anómalas previas (> 2 horas) producidas por suspensiones de Android Doze
   */
  async sanitizeCorruptedHistory() {
    try {
      const corrupted = await database.collections
        .get<PlaybackHistory>('playback_history')
        .query(Q.where('duration_played', Q.gt(7200)))
        .fetch();

      if (corrupted.length > 0) {
        await database.write(async () => {
          const ops = await Promise.all(
            corrupted.map(async (rec) => {
              try {
                const track = await database.get<Track>('tracks').find(rec.itemId);
                return rec.prepareUpdate(r => {
                  r.durationPlayed = track?.duration ? Math.floor(track.duration) : 300;
                });
              } catch {
                return rec.prepareDestroyPermanently();
              }
            })
          );
          await database.batch(...ops);
        });
        console.log(`[Historial] Sanitizados ${corrupted.length} registros con duraciones anómalas.`);
      }
    } catch (cleanErr) {
      console.warn('[Historial] Error sanitizando registros anómalos:', cleanErr);
    }
  },

  async initializeDefaultsIfNeeded() {
    this.sanitizeCorruptedHistory().catch(() => {});

    const state = usePlayerStore.getState();
    const hasMedia = state.recentMedia && state.recentMedia.length > 0;
    const hasPlaylists = state.recentPlaylists && state.recentPlaylists.length > 0;

    if (hasMedia && hasPlaylists) return;

    try {
      if (!hasMedia) {
        const [tracks, albums] = await Promise.all([
          database.collections.get<Track>('tracks').query(Q.take(3)).fetch(),
          database.collections.get<Album>('albums').query(Q.take(3)).fetch()
        ]);

        const albumMediaPromises = albums.map(async (album) => {
          const artist = await album.artist.fetch().catch(() => null);
          return {
            id: album.id,
            type: 'album' as const,
            title: album.title,
            subtitle: artist?.name || 'Artista desconocido',
            imageUrl: album.coverUrl || null,
            timestamp: Date.now(),
          };
        });

        const trackMediaPromises = tracks.map(async (track) => {
          const [artist, album] = await Promise.all([
            track.artist.fetch().catch(() => null),
            track.album.fetch().catch(() => null),
          ]);
          return {
            id: track.id,
            type: 'track' as const,
            title: track.title,
            subtitle: artist?.name || 'Artista desconocido',
            imageUrl: album?.coverUrl || null,
            timestamp: Date.now(),
          };
        });

        const [albumMedia, trackMedia] = await Promise.all([
          Promise.all(albumMediaPromises),
          Promise.all(trackMediaPromises),
        ]);

        const initialMedia = [...albumMedia, ...trackMedia];

        usePlayerStore.setState({ recentMedia: initialMedia.slice(0, 6) });
      }

      if (!hasPlaylists) {
        usePlayerStore.setState({
          recentPlaylists: [{
            id: 'favorites',
            name: i18n.t('home.your_favourites'),
            description: i18n.t('home.most_liked_songs'),
            timestamp: Date.now()
          }]
        });
      }
      await usePlayerStore.getState().saveRecentsState();
    } catch (error) {
      console.error('Error inicializando datos por defecto:', error);
    }
  },

  /**
   * Obtiene las estadísticas de la semana actual.
   * Delega en getStatsForPeriod('week', 'duration').
   */
  async getWeeklyStats() {
    return this.getStatsForPeriod('week', 'duration');
  },

  /**
   * Returns date range boundaries for a given period type.
   */
  getPeriodRange(period: 'day' | 'week' | 'month' | 'year' | 'all'): { from: Date | null; to: Date } {
    let to = new Date();
    to.setHours(23, 59, 59, 999);
    if (period === 'all') return { from: null, to };

    const from = new Date();
    if (period === 'day') {
      from.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      const day = from.getDay();
      const diff = from.getDate() - day + (day === 0 ? -6 : 1);
      from.setDate(diff);
      from.setHours(0, 0, 0, 0);

      to = new Date(from);
      to.setDate(from.getDate() + 6);
      to.setHours(23, 59, 59, 999);
    } else if (period === 'month') {
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      to = new Date(from.getFullYear(), from.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (period === 'year') {
      from.setMonth(0, 1);
      from.setHours(0, 0, 0, 0);
      to = new Date(from.getFullYear(), 11, 31, 23, 59, 59, 999);
    }
    return { from, to };
  },

  /**
   * Fetch stats for a period, ranked by either 'duration' or 'plays'.
   */
  async getStatsForPeriod(
    period: 'day' | 'week' | 'month' | 'year' | 'all',
    metric: 'duration' | 'plays'
  ) {
    const { from, to } = this.getPeriodRange(period);

    const query = from
      ? database.collections
          .get<PlaybackHistory>('playback_history')
          .query(
            Q.where('played_at', Q.gte(from.getTime())),
            Q.where('played_at', Q.lte(to.getTime()))
          )
      : database.collections
          .get<PlaybackHistory>('playback_history')
          .query();

    const historyRecords = await query.fetch();

    const { totalSeconds, totalPlays, trackDurations, trackPlayCounts } = summarizeHistoryRecords(historyRecords);
    const totalHours = totalSeconds / 3600;
    const uniqueTrackIds = Object.keys(trackDurations);

    let topArtistObj: AggregatedArtist = { id: '', name: '', imageUrl: null, duration: 0, plays: 0 };
    let topAlbumObj: AggregatedAlbum = { id: '', title: '', coverUrl: null, artistName: '', duration: 0, plays: 0 };
    let topSongObj: AggregatedSong = { id: '', title: '', coverUrl: null, artistName: '', duration: 0, plays: 0 };

    if (uniqueTrackIds.length > 0) {
      try {
        const tracks = await database.collections
          .get<Track>('tracks')
          .query(Q.where('id', Q.oneOf(uniqueTrackIds)))
          .fetch();

        const { artistData, albumData, songData } = await buildMediaStats(tracks, trackDurations, trackPlayCounts);

        topArtistObj = findTopItem(artistData, metric) || topArtistObj;
        topAlbumObj = findTopItem(albumData, metric) || topAlbumObj;
        topSongObj = findTopItem(songData, metric) || topSongObj;
      } catch (e) {
        console.warn('[HistoryService] Error calculating period stats:', e);
      }
    }

    return {
      totalHours,
      totalPlays,
      topArtist: topArtistObj.name,
      topArtistId: topArtistObj.id,
      topArtistImg: topArtistObj.imageUrl,
      topArtistDuration: topArtistObj.duration,
      topArtistPlays: topArtistObj.plays,
      topAlbum: topAlbumObj.title,
      topAlbumId: topAlbumObj.id,
      topAlbumImg: topAlbumObj.coverUrl,
      topAlbumDuration: topAlbumObj.duration,
      topAlbumPlays: topAlbumObj.plays,
      topSong: topSongObj.title,
      topSongId: topSongObj.id,
      topSongImg: topSongObj.coverUrl,
      topSongArtist: topSongObj.artistName,
      topSongDuration: topSongObj.duration,
      topSongPlays: topSongObj.plays,
    };
  },

  /**
   * Obtiene la fecha de la primera entrada (más antigua) registrada en el historial.
   */
  async getFirstHistoryDate(): Promise<Date | null> {
    try {
      const records = await database.collections
        .get<PlaybackHistory>('playback_history')
        .query(Q.sortBy('played_at', Q.asc), Q.take(1))
        .fetch();
      if (records.length > 0 && records[0].playedAt) {
        return new Date(records[0].playedAt);
      }
      return null;
    } catch (e) {
      console.error('[HistoryService] Error fetching first history date:', e);
      return null;
    }
  },

  /**
   * Comprueba si existen registros de reproducción en un rango de fechas.
   */
  async hasHistoryInRange(from: Date, to: Date): Promise<boolean> {
    try {
      const count = await database.collections
        .get<PlaybackHistory>('playback_history')
        .query(
          Q.where('played_at', Q.gte(from.getTime())),
          Q.where('played_at', Q.lte(to.getTime()))
        )
        .fetchCount();
      return count > 0;
    } catch (e) {
      console.error('[HistoryService] Error checking history in range:', e);
      return false;
    }
  },

  async getDetailedStatsForPeriod(
    period: 'day' | 'week' | 'month' | 'year' | 'all' | 'custom',
    metric: 'duration' | 'plays',
    customFrom?: Date | null,
    customTo?: Date
  ) {
    const { from, to } = await resolveDetailedStatsRange(
      period,
      customFrom,
      customTo,
      p => this.getPeriodRange(p),
      () => this.getFirstHistoryDate()
    );

    const historyRecords = await queryHistoryInRange(from, to).fetch();

    const { totalSeconds, totalPlays, trackDurations, trackPlayCounts } = summarizeHistoryRecords(historyRecords);

    const totalHours = totalSeconds / 3600;
    const uniqueTrackIds = Object.keys(trackDurations);

    const { topSongs, topAlbums, topArtists } = await fetchDetailedMediaStats(
      uniqueTrackIds,
      trackDurations,
      trackPlayCounts,
      metric
    );

    return {
      totalHours,
      totalPlays,
      topSongs,
      topAlbums,
      topArtists,
    };
  },

  async getMostPlayedTracks(limit = 10): Promise<Track[]> {
    try {
      const historyRecords = await database.collections
        .get<PlaybackHistory>('playback_history')
        .query()
        .fetch();

      const playCounts: Record<string, number> = {};
      for (const record of historyRecords) {
        playCounts[record.itemId] = (playCounts[record.itemId] || 0) + 1;
      }

      const sortedTrackIds = Object.entries(playCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(entry => entry[0]);

      if (sortedTrackIds.length === 0) return [];

      const tracks = await database.collections
        .get<Track>('tracks')
        .query(Q.where('id', Q.oneOf(sortedTrackIds)))
        .fetch();

      // Retain sorting order
      return sortedTrackIds
        .map(id => tracks.find(t => t.id === id))
        .filter((t): t is Track => !!t);
    } catch (e) {
      console.error("Error fetching most played tracks:", e);
      return [];
    }
  }
};
