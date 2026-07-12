import { Q } from '@nozbe/watermelondb';
import i18n from "../constants/i18n";
import { database } from "../database";
import Album from "../database/models/Album";
import PlaybackHistory from "../database/models/PlaybackHistory";
import Track from "../database/models/Track";
import { usePlayerStore } from "../store/usePlayerStore";

export type UIHistoryPayload = {
  id: string;
  type: "track" | "album" | "playlist" | "artist";
  context: "manual" | "queue";
  durationPlayed?: number;
  title?: string;
  subtitle?: string;
  imageUrl?: string | null;
};

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

      await database.write(async () => {
        await database.collections
          .get<PlaybackHistory>("playback_history")
          .create((record) => {
            record.itemId = cleanId;
            record.itemType = "track";
            record.playContext = context;
            record.durationPlayed = Math.floor(durationPlayed);
            record.playedAt = new Date();
          });
      });
      console.log(
        `[Historial] Canción ${cleanId} guardada. Tiempo: ${Math.floor(durationPlayed)}s`,
      );
    } catch (error) {
      console.error("Error guardando en base de datos:", error);
    }
  },

  async initializeDefaultsIfNeeded() {
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

        const initialMedia: any[] = [];

        for (const album of albums) {
          const artist = await album.artist.fetch();
          initialMedia.push({
            id: album.id,
            type: 'album',
            title: album.title,
            subtitle: artist?.name || 'Artista desconocido',
            imageUrl: album.coverUrl || null,
            timestamp: Date.now(),
          });
        }

        for (const track of tracks) {
          const artist = await track.artist.fetch();
          const album = await track.album.fetch();
          initialMedia.push({
            id: track.id,
            type: 'track',
            title: track.title,
            subtitle: artist?.name || 'Artista desconocido',
            imageUrl: album?.coverUrl || null,
            timestamp: Date.now(),
          });
        }

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

  async getWeeklyStats() {
    const from = new Date();
    const day = from.getDay();
    const diff = from.getDate() - day + (day === 0 ? -6 : 1);
    from.setDate(diff);
    from.setHours(0, 0, 0, 0);

    const historyRecords = await database.collections
      .get<PlaybackHistory>('playback_history')
      .query(Q.where('played_at', Q.gte(from.getTime())))
      .fetch();

    let totalSeconds = 0;
    const trackDurations: Record<string, number> = {};
    for (const record of historyRecords) {
      const seconds = record.durationPlayed || 0;
      totalSeconds += seconds;
      trackDurations[record.itemId] = (trackDurations[record.itemId] || 0) + seconds;
    }

    const totalHours = totalSeconds / 3600;
    const uniqueTrackIds = Object.keys(trackDurations);

    let topArtistObj = { id: '', name: '', imageUrl: null as string | null, duration: 0 };
    let topAlbumObj = { id: '', title: '', coverUrl: null as string | null, duration: 0 };
    let topSongObj = { id: '', title: '', coverUrl: null as string | null, artistName: '', duration: 0 };

    if (uniqueTrackIds.length > 0) {
      try {
        const tracks = await database.collections
          .get<Track>('tracks')
          .query(Q.where('id', Q.oneOf(uniqueTrackIds)))
          .fetch();

        const artistDurations: Record<string, { id: string; duration: number; name: string; imageUrl: string | null }> = {};
        const albumDurations: Record<string, { id: string; duration: number; title: string; coverUrl: string | null }> = {};
        const songDurations: Record<string, { id: string; duration: number; title: string; coverUrl: string | null; artistName: string }> = {};

        for (const track of tracks) {
          const dur = trackDurations[track.id] || 0;
          if (dur <= 0) continue;

          const artist = await track.artist.fetch();
          if (artist) {
            const artistId = artist.id;
            if (!artistDurations[artistId]) {
              artistDurations[artistId] = { id: artist.id, duration: 0, name: artist.name, imageUrl: artist.imageUrl || null };
            }
            artistDurations[artistId].duration += dur;
          }

          const album = await track.album.fetch();
          if (album) {
            const albumId = album.id;
            if (!albumDurations[albumId]) {
              albumDurations[albumId] = { id: album.id, duration: 0, title: album.title, coverUrl: album.coverUrl || null };
            }
            albumDurations[albumId].duration += dur;
          }

          const songId = track.id;
          if (!songDurations[songId]) {
            songDurations[songId] = {
              id: track.id,
              duration: 0,
              title: track.title,
              coverUrl: album?.coverUrl || null,
              artistName: artist?.name || 'Artista desconocido'
            };
          }
          songDurations[songId].duration += dur;
        }

        let maxArtistDuration = 0;
        for (const data of Object.values(artistDurations)) {
          if (data.duration > maxArtistDuration) {
            maxArtistDuration = data.duration;
            topArtistObj = data;
          }
        }

        let maxAlbumDuration = 0;
        for (const data of Object.values(albumDurations)) {
          if (data.duration > maxAlbumDuration) {
            maxAlbumDuration = data.duration;
            topAlbumObj = data;
          }
        }

        let maxSongDuration = 0;
        for (const data of Object.values(songDurations)) {
          if (data.duration > maxSongDuration) {
            maxSongDuration = data.duration;
            topSongObj = data;
          }
        }
      } catch (e) {
        console.warn("Error calculating weekly stats:", e);
      }
    }

    return {
      totalHours,
      topArtist: topArtistObj.name,
      topArtistId: topArtistObj.id,
      topArtistImg: topArtistObj.imageUrl,
      topArtistDuration: topArtistObj.duration,
      topAlbum: topAlbumObj.title,
      topAlbumId: topAlbumObj.id,
      topAlbumImg: topAlbumObj.coverUrl,
      topAlbumDuration: topAlbumObj.duration,
      topSong: topSongObj.title,
      topSongId: topSongObj.id,
      topSongImg: topSongObj.coverUrl,
      topSongArtist: topSongObj.artistName,
      topSongDuration: topSongObj.duration,
    };
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
    } else if (period === 'year') {
      from.setMonth(0, 1);
      from.setHours(0, 0, 0, 0);
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
    const { from } = this.getPeriodRange(period);

    const query = from
      ? database.collections
          .get<PlaybackHistory>('playback_history')
          .query(Q.where('played_at', Q.gte(from.getTime())))
      : database.collections
          .get<PlaybackHistory>('playback_history')
          .query();

    const historyRecords = await query.fetch();

    let totalSeconds = 0;
    let totalPlays = historyRecords.length;
    const trackDurations: Record<string, number> = {};
    const trackPlayCounts: Record<string, number> = {};

    for (const record of historyRecords) {
      const seconds = record.durationPlayed || 0;
      totalSeconds += seconds;
      trackDurations[record.itemId] = (trackDurations[record.itemId] || 0) + seconds;
      trackPlayCounts[record.itemId] = (trackPlayCounts[record.itemId] || 0) + 1;
    }

    const totalHours = totalSeconds / 3600;
    const uniqueTrackIds = Object.keys(trackDurations);

    let topArtistObj = { id: '', name: '', imageUrl: null as string | null, duration: 0, plays: 0 };
    let topAlbumObj = { id: '', title: '', coverUrl: null as string | null, duration: 0, plays: 0 };
    let topSongObj = { id: '', title: '', coverUrl: null as string | null, artistName: '', duration: 0, plays: 0 };

    if (uniqueTrackIds.length > 0) {
      try {
        const tracks = await database.collections
          .get<Track>('tracks')
          .query(Q.where('id', Q.oneOf(uniqueTrackIds)))
          .fetch();

        const artistData: Record<string, { id: string; name: string; imageUrl: string | null; duration: number; plays: number }> = {};
        const albumData: Record<string, { id: string; title: string; coverUrl: string | null; duration: number; plays: number }> = {};
        const songData: Record<string, { id: string; title: string; coverUrl: string | null; artistName: string; duration: number; plays: number }> = {};

        for (const track of tracks) {
          const dur = trackDurations[track.id] || 0;
          const cnt = trackPlayCounts[track.id] || 0;
          if (dur <= 0 && cnt <= 0) continue;

          const artist = await track.artist.fetch();
          if (artist) {
            if (!artistData[artist.id]) {
              artistData[artist.id] = { id: artist.id, name: artist.name, imageUrl: artist.imageUrl || null, duration: 0, plays: 0 };
            }
            artistData[artist.id].duration += dur;
            artistData[artist.id].plays += cnt;
          }

          const album = await track.album.fetch();
          if (album) {
            if (!albumData[album.id]) {
              albumData[album.id] = { id: album.id, title: album.title, coverUrl: album.coverUrl || null, duration: 0, plays: 0 };
            }
            albumData[album.id].duration += dur;
            albumData[album.id].plays += cnt;
          }

          if (!songData[track.id]) {
            songData[track.id] = {
              id: track.id,
              title: track.title,
              coverUrl: album?.coverUrl || null,
              artistName: artist?.name || '',
              duration: 0,
              plays: 0,
            };
          }
          songData[track.id].duration += dur;
          songData[track.id].plays += cnt;
        }

        const scoreOf = (d: { duration: number; plays: number }) =>
          metric === 'duration' ? d.duration : d.plays;

        let maxArtist = 0;
        for (const data of Object.values(artistData)) {
          if (scoreOf(data) > maxArtist) { maxArtist = scoreOf(data); topArtistObj = data; }
        }
        let maxAlbum = 0;
        for (const data of Object.values(albumData)) {
          if (scoreOf(data) > maxAlbum) { maxAlbum = scoreOf(data); topAlbumObj = data; }
        }
        let maxSong = 0;
        for (const data of Object.values(songData)) {
          if (scoreOf(data) > maxSong) { maxSong = scoreOf(data); topSongObj = data; }
        }
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
