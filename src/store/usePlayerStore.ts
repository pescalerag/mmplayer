import { createMMKV } from "react-native-mmkv";
import TrackPlayer, { Track as TPTrack } from "react-native-track-player";
import { create } from "zustand";
import { database } from "../database";
import Artist from "../database/models/Artist";
import Track from "../database/models/Track";

const storage = createMMKV();
const PERSISTENCE_KEY = "@player_persistence";
const RECENTS_KEY = "@player_recents";

async function mapToTPTrack(track: Track): Promise<TPTrack> {
  const album = await track.album.fetch();
  const artists = (await track.queryCollaborators.fetch()) as Artist[];
  const artistNames =
    artists.length > 0
      ? artists.map((a) => a.name).join(", ")
      : "Artista desconocido";

  return {
    id: track.id,
    url: track.fileUrl,
    title: track.title,
    artist: artistNames,
    album: album?.title || "Álbum desconocido",
    artwork: album?.coverUrl || undefined,
    duration: track.duration,
  };
}

interface PlayerState {
  activeTrack: Track | null;
  playbackContext: string | null;
  hasNext: boolean;
  hasPrevious: boolean;
  isShuffleEnabled: boolean;
  shuffleOriginalQueue: TPTrack[];
  userQueueSize: number;
  loadQueue: (
    tracks: Track[],
    index: number,
    context?: string,
  ) => Promise<void>;
  startShuffled: (tracks: Track[], context?: string) => Promise<void>;
  playSingleTrack: (track: Track, context?: string) => Promise<void>;
  setActiveTrackById: (trackId: string) => Promise<void>;
  addToQueueNext: (track: Track) => Promise<void>;
  addToQueueEnd: (track: Track) => Promise<void>;
  addMultipleToQueueNext: (tracks: Track[]) => Promise<void>;
  addMultipleToQueueEnd: (tracks: Track[]) => Promise<void>;
  updateQueueStatus: (currentIndex?: number) => Promise<void>;
  clearPlayer: () => Promise<void>;
  setShuffleState: (enabled: boolean, queue: TPTrack[]) => void;
  decrementUserQueue: () => void;
  savePlaybackState: () => Promise<void>;
  restorePlaybackState: () => Promise<void>;
  saveRecentsState: () => Promise<void>;
  restoreRecentsState: () => Promise<void>;
  recentMedia: RecentItem[];
  recentPlaylists: RecentPlaylist[];
  addMediaToRecents: (item: Omit<RecentItem, "timestamp">) => void;
  addPlaylistToRecents: (item: Omit<RecentPlaylist, "timestamp">) => void;
}

export type RecentItem = {
  id: string;
  type: "track" | "album";
  title: string;
  subtitle: string;
  imageUrl: string | null;
  timestamp: number;
};

export type RecentPlaylist = {
  id: string;
  name: string;
  description: string | null;
  timestamp: number;
};

export const usePlayerStore = create<PlayerState>((set, get) => ({
  activeTrack: null,
  playbackContext: null,
  hasNext: false,
  hasPrevious: false,
  isShuffleEnabled: false,
  shuffleOriginalQueue: [],
  userQueueSize: 0,
  recentMedia: [],
  recentPlaylists: [],

  loadQueue: async (tracks, index, context = "unknown") => {
    try {
      const tpTracks = await Promise.all(tracks.map(mapToTPTrack));

      await TrackPlayer.reset();
      await TrackPlayer.add(tpTracks);
      await TrackPlayer.skip(index);
      await TrackPlayer.play();
      // Al cargar una nueva cola se resetea el shuffle y la cola manual
      set({
        activeTrack: tracks[index],
        playbackContext: context,
        isShuffleEnabled: false,
        shuffleOriginalQueue: [],
        userQueueSize: 0,
      });
    } catch (error) {
      console.error("Error loading queue:", error);
    }
  },

  startShuffled: async (tracks, context = "unknown") => {
    try {
      const tpTracks = await Promise.all(tracks.map(mapToTPTrack));

      // 1. Crear un arreglo de índices y barajarlo
      const indices = Array.from({ length: tracks.length }, (_, i) => i);
      const shuffledIndices = indices.sort(() => Math.random() - 0.5);

      const shuffledTracks = shuffledIndices.map((i) => tracks[i]);
      const shuffledTpTracks = shuffledIndices.map((i) => tpTracks[i]);

      // 2. Cargar la cola barajada completa
      await TrackPlayer.reset();
      await TrackPlayer.add(shuffledTpTracks);
      await TrackPlayer.play();

      // 3. Guardar estado: shuffle activo, cola original guardada
      set({
        activeTrack: shuffledTracks[0],
        playbackContext: context,
        isShuffleEnabled: true,
        shuffleOriginalQueue: tpTracks,
        userQueueSize: 0,
        hasPrevious: false,
        hasNext: shuffledTracks.length > 1,
      });
    } catch (error) {
      console.error("Error starting shuffled queue:", error);
    }
  },

  playSingleTrack: async (track, context = "unknown") => {
    try {
      const tpTrack = await mapToTPTrack(track);
      await TrackPlayer.reset();
      await TrackPlayer.add([tpTrack]);
      await TrackPlayer.play();
      set({ activeTrack: track, playbackContext: context, userQueueSize: 0 });
    } catch (error) {
      console.error("Error playing single track:", error);
    }
  },

  setActiveTrackById: async (trackId) => {
    try {
      const track = await database.get<Track>("tracks").find(trackId);
      set({ activeTrack: track });
    } catch (error) {
      console.error("Error setting active track by ID:", error);
    }
  },

  addToQueueNext: async (track) => {
    try {
      const tpTrack = await mapToTPTrack(track);
      (tpTrack as any).isManual = true;
      const currentIndex = await TrackPlayer.getActiveTrackIndex();

      if (currentIndex !== undefined && currentIndex !== null) {
        // Insertar justo después de la canción actual (primer slot de la user queue)
        await TrackPlayer.add([tpTrack], currentIndex + 1);
      } else {
        await TrackPlayer.add([tpTrack]);
      }
      // Incrementar el tamaño de la cola manual
      set((state) => ({ userQueueSize: state.userQueueSize + 1 }));
      await get().updateQueueStatus();
      await get().savePlaybackState();
    } catch (error) {
      console.error("Error adding to queue next:", error);
    }
  },

  addToQueueEnd: async (track) => {
    try {
      const tpTrack = await mapToTPTrack(track);
      (tpTrack as any).isManual = true;
      await TrackPlayer.add([tpTrack]);
      await get().updateQueueStatus();
      await get().savePlaybackState();
    } catch (error) {
      console.error("Error adding to queue end:", error);
    }
  },

  addMultipleToQueueNext: async (tracks) => {
    try {
      if (tracks.length === 0) return;
      const tpTracks = await Promise.all(tracks.map(mapToTPTrack));
      tpTracks.forEach((t) => ((t as any).isManual = true));
      const currentIndex = await TrackPlayer.getActiveTrackIndex();

      if (currentIndex !== undefined && currentIndex !== null) {
        // Insertar justo después de la canción actual
        await TrackPlayer.add(tpTracks, currentIndex + 1);
      } else {
        await TrackPlayer.add(tpTracks);
      }
      // Incrementar el tamaño de la cola manual
      set((state) => ({ userQueueSize: state.userQueueSize + tracks.length }));
      await get().updateQueueStatus();
      await get().savePlaybackState();
    } catch (error) {
      console.error("Error adding multiple to queue next:", error);
    }
  },

  addMultipleToQueueEnd: async (tracks) => {
    try {
      if (tracks.length === 0) return;
      const tpTracks = await Promise.all(tracks.map(mapToTPTrack));
      tpTracks.forEach((t) => ((t as any).isManual = true));
      await TrackPlayer.add(tpTracks);
      await get().updateQueueStatus();
      await get().savePlaybackState();
    } catch (error) {
      console.error("Error adding multiple to queue end:", error);
    }
  },

  clearPlayer: async () => {
    try {
      await TrackPlayer.reset();
      storage.remove(PERSISTENCE_KEY);
      set({
        activeTrack: null,
        playbackContext: null,
        hasNext: false,
        hasPrevious: false,
        isShuffleEnabled: false,
        shuffleOriginalQueue: [],
        userQueueSize: 0,
      });
    } catch (error) {
      console.error("Error in clearPlayer:", error);
    }
  },

  setShuffleState: (enabled, queue) =>
    set({
      isShuffleEnabled: enabled,
      shuffleOriginalQueue: queue,
    }),

  // Llamado por TrackPlayerSync cuando el track avanza hacia adelante
  // y hay tracks de la user queue pendientes
  decrementUserQueue: () => {
    set((state) => ({ userQueueSize: Math.max(0, state.userQueueSize - 1) }));
  },

  // ── Persistencia en disco ──
  savePlaybackState: async () => {
    try {
      const queue = await TrackPlayer.getQueue();
      const index = await TrackPlayer.getActiveTrackIndex();
      const {
        playbackContext,
        isShuffleEnabled,
        shuffleOriginalQueue,
        userQueueSize,
      } = get();

      if (queue.length === 0) {
        storage.remove(PERSISTENCE_KEY);
        return;
      }

      const payload = JSON.stringify({
        queue,
        index,
        playbackContext,
        isShuffleEnabled,
        shuffleOriginalQueue,
        userQueueSize,
      });
      storage.set(PERSISTENCE_KEY, payload);
    } catch (error) {
      console.error("Error guardando estado de reproducción:", error);
    }
  },

  restorePlaybackState: async () => {
    try {
      const savedData = storage.getString(PERSISTENCE_KEY);
      if (!savedData) {
        return;
      }

      const {
        queue,
        index,
        playbackContext,
        isShuffleEnabled,
        shuffleOriginalQueue,
        userQueueSize,
      } = JSON.parse(savedData);

      if (!queue || queue.length === 0) return;

      // 1. Rehidratar el motor nativo de TrackPlayer
      await TrackPlayer.reset();
      await TrackPlayer.add(queue);

      const safeIndex =
        index !== undefined && index !== null && index < queue.length
          ? index
          : 0;
      await TrackPlayer.skip(safeIndex);

      // Iniciamos pausado para no sorprender al usuario al abrir la app
      await TrackPlayer.pause();

      // 2. Rehidratar el modelo WatermelonDB por ID
      const activeTPTrack = queue[safeIndex];
      let trackModel: Track | null = null;
      if (activeTPTrack?.id) {
        try {
          trackModel = await database
            .get<Track>("tracks")
            .find(activeTPTrack.id);
        } catch (dbError) {
          console.warn(
            "[Store] No se encontró el modelo en WatermelonDB:",
            dbError,
          );
        }
      }

      // 3. Rehidratar Zustand
      set({
        activeTrack: trackModel,
        playbackContext: playbackContext ?? null,
        isShuffleEnabled: isShuffleEnabled ?? false,
        shuffleOriginalQueue: shuffleOriginalQueue ?? [],
        userQueueSize: userQueueSize ?? 0,
      });

      // 4. Actualizar hasPrevious / hasNext
      await get().updateQueueStatus(safeIndex);
    } catch (error) {
      console.error("Error restaurando estado de reproducción:", error);
    }
  },

  updateQueueStatus: async (currentIndex?: number) => {
    try {
      const queue = await TrackPlayer.getQueue();
      const index =
        currentIndex !== undefined
          ? currentIndex
          : await TrackPlayer.getActiveTrackIndex();

      if (index !== undefined && index !== null) {
        set({
          hasPrevious: index > 0,
          hasNext: index < queue.length - 1,
        });
      } else {
        set({ hasPrevious: false, hasNext: false });
      }
    } catch (error) {
      console.error("❌ [Store] Error actualizando status de la cola:", error);
    }
  },
  saveRecentsState: async () => {
    try {
      const { recentMedia, recentPlaylists } = get();
      const payload = JSON.stringify({ recentMedia, recentPlaylists });
      storage.set(RECENTS_KEY, payload);
    } catch (error) {
      console.error("Error guardando recientes:", error);
    }
  },

  restoreRecentsState: async () => {
    try {
      const savedData = storage.getString(RECENTS_KEY);
      if (!savedData) return;

      const { recentMedia, recentPlaylists } = JSON.parse(savedData);
      set({
        recentMedia: recentMedia || [],
        recentPlaylists: recentPlaylists || [],
      });
    } catch (error) {
      console.error("Error restaurando recientes:", error);
    }
  },

  addMediaToRecents: (item) => {
    const current = get().recentMedia;
    const filtered = current.filter(
      (i) => !(i.id === item.id && i.type === item.type),
    );
    const updated = [{ ...item, timestamp: Date.now() }, ...filtered].slice(
      0,
      6,
    );
    set({ recentMedia: updated });
    get().saveRecentsState().catch((err) => console.error("Error saving recents:", err));
  },

  addPlaylistToRecents: (playlist) => {
    const current = get().recentPlaylists;
    const filtered = current.filter((p) => p.id !== playlist.id);
    const updated = [{ ...playlist, timestamp: Date.now() }, ...filtered].slice(
      0,
      3,
    );
    set({ recentPlaylists: updated });
    get().saveRecentsState().catch((err) => console.error("Error saving recents:", err));
  }
}));
