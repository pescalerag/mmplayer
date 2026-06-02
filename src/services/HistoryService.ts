import { Q } from '@nozbe/watermelondb';
import { database } from "../database";
import PlaybackHistory from "../database/models/PlaybackHistory";
import Track from "../database/models/Track";
import Album from "../database/models/Album";
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
        const track = await database.get<Track>('tracks').find(item.id);
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
        id: item.id,
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
      //No guardar si la escuchó menos de 10 segundos
      if (durationPlayed < 10) return;

      await database.write(async () => {
        await database.collections
          .get<PlaybackHistory>("playback_history")
          .create((record) => {
            record.itemId = trackId;
            record.itemType = "track";
            record.playContext = context;
            record.durationPlayed = Math.floor(durationPlayed);
            record.playedAt = new Date();
          });
      });
      console.log(
        `[Historial] Canción ${trackId} guardada. Tiempo: ${Math.floor(durationPlayed)}s`,
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
            name: 'Tus Favoritos',
            description: 'Las canciones que más te gustan',
            timestamp: Date.now()
          }]
        });
      }
      await usePlayerStore.getState().saveRecentsState();
    } catch (error) {
      console.error('Error inicializando datos por defecto:', error);
    }
  },
};
