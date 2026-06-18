import { createMMKV } from "react-native-mmkv";
import TrackPlayer, { RepeatMode, Track as TPTrack } from "react-native-track-player";
import { create } from "zustand";
import { database } from "../database";
import Artist from "../database/models/Artist";
import Track from "../database/models/Track";
import { navigationRef } from '../navigation/navigationRef';

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
    id: `${track.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => Promise<void>;
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
  clearUserQueue: () => Promise<void>;
  savePlaybackState: () => Promise<void>;
  restorePlaybackState: () => Promise<void>;
  saveRecentsState: () => Promise<void>;
  restoreRecentsState: () => Promise<void>;
  recentMedia: RecentItem[];
  recentPlaylists: RecentPlaylist[];
  addMediaToRecents: (item: Omit<RecentItem, "timestamp">) => void;
  addPlaylistToRecents: (item: Omit<RecentPlaylist, "timestamp">) => void;
  updatePlaylistCoverInRecents: (playlistId: string, imageUrl: string | null) => void;
  removePlaylistFromRecents: (playlistId: string) => void;
  updateMediaImageInRecents: (id: string, type: RecentItem["type"], imageUrl: string | null) => void;
  handleDeletedEntities: (trackIds: string[], albumIds: string[], artistIds: string[]) => Promise<void>;
}

export type RecentItem = {
  id: string;
  type: "track" | "album" | "artist";
  title: string;
  subtitle: string;
  imageUrl: string | null;
  timestamp: number;
};

export type RecentPlaylist = {
  id: string;
  name: string;
  description: string | null;
  imageUrl?: string | null;
  timestamp: number;
};

async function flushCurrentTrackToHistory() {
  try {
    const { HistoryService } = require("../services/HistoryService");
    const { PlaybackTimeTracker } = require("../services/PlaybackService");

    const state = usePlayerStore.getState();
    const activeTrack = state.activeTrack;

    if (activeTrack && activeTrack.id) {
      PlaybackTimeTracker.onStateNotPlaying();

      const activeIndex = await TrackPlayer.getActiveTrackIndex();
      const queue = await TrackPlayer.getQueue();
      const activeTPTrack = activeIndex !== undefined && activeIndex !== null ? queue[activeIndex] : null;

      const trackingId = activeTPTrack?.id ? activeTPTrack.id.toString() : activeTrack.id.toString();

      const durationPlayed = PlaybackTimeTracker.getAccumulatedSeconds(trackingId);

      if (durationPlayed >= 20) {
        console.log(`[Historial] Guardando en historial. Canción: ${activeTrack.id.toString()}, Duración: ${Math.floor(durationPlayed)}s.`);
        await HistoryService.logToDatabase(activeTrack.id.toString(), durationPlayed, "manual");
      } else {
        console.log(`[Historial] Canción descartada (escuchada ${Math.floor(durationPlayed)}s, requiere 20s).`);
      }

      PlaybackTimeTracker.clearAccumulated(trackingId);
    }
  } catch (e) {
    console.error("Error flushing history before reset:", e);
  }
}

let currentLoadId = 0;

export const usePlayerStore = create<PlayerState>((set, get) => ({
  activeTrack: null,
  playbackContext: null,
  hasNext: false,
  hasPrevious: false,
  isShuffleEnabled: false,
  shuffleOriginalQueue: [],
  userQueueSize: 0,
  playbackSpeed: 1.0,
  recentMedia: [],
  recentPlaylists: [],

  loadQueue: async (tracks, index, context = "unknown") => {
    const loadId = ++currentLoadId;
    try {
      const CHUNK_SIZE = 50;

      const initialChunk = tracks.slice(index, index + CHUNK_SIZE);
      const initialTpTracks = await Promise.all(initialChunk.map(mapToTPTrack));

      if (currentLoadId !== loadId) return;

      await flushCurrentTrackToHistory();
      await TrackPlayer.reset();
      await TrackPlayer.add(initialTpTracks);
      await TrackPlayer.setRate(get().playbackSpeed);
      await TrackPlayer.play();

      set({
        activeTrack: tracks[index],
        playbackContext: context,
        isShuffleEnabled: false,
        shuffleOriginalQueue: [],
        userQueueSize: 0,
      });

      const previousTracks = tracks.slice(0, index);
      const remainingNextTracks = tracks.slice(index + CHUNK_SIZE);

      if (previousTracks.length > 0 || remainingNextTracks.length > 0) {
        (async () => {
          try {
            // 1. Cargar pistas anteriores y colocarlas al inicio de la cola
            let insertIndex = 0;
            for (let i = 0; i < previousTracks.length; i += CHUNK_SIZE) {
              if (currentLoadId !== loadId) break;
              const chunk = previousTracks.slice(i, i + CHUNK_SIZE);
              const tpChunk = await Promise.all(chunk.map(mapToTPTrack));
              if (currentLoadId !== loadId) break;
              await TrackPlayer.add(tpChunk, insertIndex);
              insertIndex += chunk.length;
              await get().updateQueueStatus();
              await new Promise(resolve => setTimeout(resolve, 50));
            }

            // 2. Cargar pistas posteriores restantes y agregarlas al final
            for (let i = 0; i < remainingNextTracks.length; i += CHUNK_SIZE) {
              if (currentLoadId !== loadId) break;
              const chunk = remainingNextTracks.slice(i, i + CHUNK_SIZE);
              const tpChunk = await Promise.all(chunk.map(mapToTPTrack));
              if (currentLoadId !== loadId) break;
              await TrackPlayer.add(tpChunk);
              await get().updateQueueStatus();
              await new Promise(resolve => setTimeout(resolve, 50));
            }

            if (currentLoadId === loadId) {
              await get().savePlaybackState();
            }
          } catch (bgError) {
            console.error("Background queue loading error:", bgError);
          }
        })();
      }
    } catch (error) {
      console.error("Error loading queue:", error);
    }
  },

  startShuffled: async (tracks, context = "unknown") => {
    const loadId = ++currentLoadId;
    try {
      const CHUNK_SIZE = 50;

      const indices = Array.from({ length: tracks.length }, (_, i) => i);
      const shuffledIndices = indices.sort(() => Math.random() - 0.5);
      const shuffledTracks = shuffledIndices.map((i) => tracks[i]);

      const initialChunk = shuffledTracks.slice(0, CHUNK_SIZE);
      const remainingTracks = shuffledTracks.slice(CHUNK_SIZE);

      const initialTpTracks = await Promise.all(initialChunk.map(mapToTPTrack));

      if (currentLoadId !== loadId) return;

      await flushCurrentTrackToHistory();
      await TrackPlayer.reset();
      await TrackPlayer.add(initialTpTracks);
      await TrackPlayer.setRate(get().playbackSpeed);
      await TrackPlayer.play();

      set({
        activeTrack: initialChunk[0],
        playbackContext: context,
        isShuffleEnabled: true,
        shuffleOriginalQueue: [],
        userQueueSize: 0,
        hasPrevious: false,
        hasNext: shuffledTracks.length > 1,
      });

      // Carga diferida de la cola original (en orden original) para permitir desactivar shuffle correctamente
      (async () => {
        try {
          const originalTpTracks = await Promise.all(tracks.map(mapToTPTrack));
          if (currentLoadId === loadId) {
            set({ shuffleOriginalQueue: originalTpTracks });
            await get().savePlaybackState();
          }
        } catch (bgError) {
          console.error("Background original queue mapping error:", bgError);
        }
      })();

      // Carga diferida en segundo plano de las pistas mezcladas en el reproductor nativo
      if (remainingTracks.length > 0) {
        (async () => {
          try {
            for (let i = 0; i < remainingTracks.length; i += CHUNK_SIZE) {
              if (currentLoadId !== loadId) break;
              const chunk = remainingTracks.slice(i, i + CHUNK_SIZE);
              const tpChunk = await Promise.all(chunk.map(mapToTPTrack));
              if (currentLoadId !== loadId) break;
              await TrackPlayer.add(tpChunk);

              await get().updateQueueStatus();
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          } catch (bgError) {
            console.error("Background shuffle loading error:", bgError);
          }
        })();
      }
    } catch (error) {
      console.error("Error starting shuffled queue:", error);
    }
  },

  playSingleTrack: async (track, context = "unknown") => {
    const loadId = ++currentLoadId;
    try {
      const tpTrack = await mapToTPTrack(track);
      if (currentLoadId !== loadId) return;
      await flushCurrentTrackToHistory();
      await TrackPlayer.reset();
      await TrackPlayer.add([tpTrack]);
      await TrackPlayer.setRate(get().playbackSpeed);
      await TrackPlayer.play();
      set({ activeTrack: track, playbackContext: context, userQueueSize: 0 });
      await get().updateQueueStatus();
      await get().savePlaybackState();
    } catch (error) {
      console.error("Error playing single track:", error);
    }
  },

  setActiveTrackById: async (trackId) => {
    try {
      const cleanId = trackId.split('-')[0];
      const track = await database.get<Track>("tracks").find(cleanId);
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
      await flushCurrentTrackToHistory();
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

      // Cerrar el PlayerScreen si está abierto
      if (navigationRef.isReady()) {
        const currentRoute = navigationRef.getCurrentRoute();
        const rootState = navigationRef.getRootState();

        if (
          currentRoute?.name === 'PlayerHome' ||
          (rootState && rootState.routes[rootState.index]?.name === 'Player')
        ) {
          navigationRef.navigate('Main');
        }
      }

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

  setPlaybackSpeed: async (speed) => {
    try {
      await TrackPlayer.setRate(speed);
      set({ playbackSpeed: speed });
      await get().savePlaybackState();
    } catch (e) {
      console.error("Error setting playback speed:", e);
    }
  },

  clearUserQueue: async () => {
    try {
      const queue = await TrackPlayer.getQueue();
      const activeIndex = await TrackPlayer.getActiveTrackIndex();

      if (activeIndex === undefined || activeIndex === null) return;

      const indicesToRemove = queue
        .map((track, index) => index > activeIndex && (track as any).isManual ? index : -1)
        .filter(index => index !== -1);

      if (indicesToRemove.length > 0) {
        // Ordenamos los índices de mayor a menor para que al borrar desde el final
        // no afecte a los índices de las posiciones anteriores.
        indicesToRemove.sort((a, b) => b - a);

        const CHUNK_SIZE = 50;
        for (let i = 0; i < indicesToRemove.length; i += CHUNK_SIZE) {
          const chunk = indicesToRemove.slice(i, i + CHUNK_SIZE);
          await TrackPlayer.remove(chunk);
          // Pausa corta para liberar el hilo de UI
          await new Promise((resolve) => setTimeout(resolve, 16));
        }
      }

      set({ userQueueSize: 0 });
      await get().updateQueueStatus();
      await get().savePlaybackState();
    } catch (e) {
      console.error("Error clearing user queue:", e);
    }
  },

  // ── Persistencia en disco ──
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
        playbackSpeed,
      } = get();

      if (queue.length === 0) {
        storage.remove(PERSISTENCE_KEY);
        storage.remove("@player_position");
        storage.remove("@player_accumulated");
        return;
      }

      // Guardar el estado general sin position y accumulatedTime en el JSON de la cola
      const payload = JSON.stringify({
        queue,
        index,
        playbackContext,
        isShuffleEnabled,
        shuffleOriginalQueue,
        userQueueSize,
        playbackSpeed,
      });
      storage.set(PERSISTENCE_KEY, payload);

      // Guardar minutaje y acumulado en claves separadas (primitivas numéricas) para micro-optimizar
      try {
        const progress = await TrackPlayer.getProgress();
        storage.set("@player_position", progress.position);
      } catch (pe) {
        console.error("Error obteniendo posición del track:", pe);
      }

      if (index !== undefined && index !== null && index >= 0 && index < queue.length) {
        const activeTPTrack = queue[index];
        if (activeTPTrack?.id) {
          try {
            const { PlaybackTimeTracker } = require("../services/PlaybackService");
            const accumulatedTime = PlaybackTimeTracker.getAccumulatedSeconds(activeTPTrack.id.toString());
            storage.set("@player_accumulated", accumulatedTime);
          } catch (te) {
            console.error("Error obteniendo acumulado del tracker:", te);
          }
        }
      }
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
        playbackSpeed,
      } = JSON.parse(savedData);

      if (!queue || queue.length === 0) return;

      // Obtener posición y acumulado de sus claves primitivas (evita parsear el JSON de la cola cada segundo)
      const position = storage.getNumber("@player_position") || 0;
      const accumulatedTime = storage.getNumber("@player_accumulated") || 0;

      // 1. Rehidratar el motor nativo de TrackPlayer
      await TrackPlayer.reset();
      await TrackPlayer.add(queue);
      await TrackPlayer.setRate(playbackSpeed ?? 1.0);

      const safeIndex =
        index !== undefined && index !== null && index < queue.length
          ? index
          : 0;
      await TrackPlayer.skip(safeIndex);

      if (position > 0) {
        await TrackPlayer.seekTo(position);
        console.log(`[Store] Restaurado minutaje a la posición: ${position}s`);
      }

      // Iniciamos pausado para no sorprender al usuario al abrir la app
      await TrackPlayer.pause();

      // 2. Rehidratar el modelo WatermelonDB por ID
      const activeTPTrack = queue[safeIndex];
      let trackModel: Track | null = null;
      if (activeTPTrack?.id) {
        try {
          const cleanId = activeTPTrack.id.split('-')[0];
          trackModel = await database
            .get<Track>("tracks")
            .find(cleanId);

          if (accumulatedTime > 0) {
            const { PlaybackTimeTracker } = require("../services/PlaybackService");
            PlaybackTimeTracker.setAccumulatedSeconds(activeTPTrack.id.toString(), accumulatedTime);
            console.log(`[Store] Restaurado tracker con ${accumulatedTime}s acumulados para track: ${activeTPTrack.id}`);
          }
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
        playbackSpeed: playbackSpeed ?? 1.0,
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

      const repeatMode = await TrackPlayer.getRepeatMode();

      if (index !== undefined && index !== null && queue.length > 0) {
        const hasPrev = index > 0 || repeatMode !== RepeatMode.Off;
        const hasNxt = index < queue.length - 1 || repeatMode !== RepeatMode.Off;
        set({
          hasPrevious: hasPrev,
          hasNext: hasNxt,
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
  },

  updatePlaylistCoverInRecents: (playlistId, imageUrl) => {
    const current = get().recentPlaylists;
    let modified = false;
    const updated = current.map((p) => {
      if (p.id === playlistId && (p as any).imageUrl !== imageUrl) {
        modified = true;
        return { ...p, imageUrl };
      }
      return p;
    });
    if (modified) {
      set({ recentPlaylists: updated });
      get().saveRecentsState().catch((err) => console.error("Error saving recents:", err));
    }
  },

  removePlaylistFromRecents: (playlistId) => {
    const current = get().recentPlaylists;
    const updated = current.filter((p) => p.id !== playlistId);
    if (updated.length !== current.length) {
      set({ recentPlaylists: updated });
      get().saveRecentsState().catch((err) => console.error("Error saving recents:", err));
    }
  },

  updateMediaImageInRecents: (id, type, imageUrl) => {
    const current = get().recentMedia;
    let modified = false;
    const updated = current.map((item) => {
      if (item.id === id && item.type === type && item.imageUrl !== imageUrl) {
        modified = true;
        return { ...item, imageUrl };
      }
      return item;
    });
    if (modified) {
      set({ recentMedia: updated });
      get().saveRecentsState().catch((err) => console.error("Error saving recents:", err));
    }
  },

  handleDeletedEntities: async (trackIds, albumIds, artistIds) => {
    try {
      const state = get();
      let shouldUpdateRecents = false;
      const newRecentMedia = state.recentMedia.filter(item => {
        if (item.type === 'track' && trackIds.includes(item.id)) return false;
        if (item.type === 'album' && albumIds.includes(item.id)) return false;
        if (item.type === 'artist' && artistIds.includes(item.id)) return false;
        return true;
      });

      if (newRecentMedia.length !== state.recentMedia.length) {
        set({ recentMedia: newRecentMedia });
        shouldUpdateRecents = true;
      }

      if (shouldUpdateRecents) {
        await get().saveRecentsState();
      }

      // Handle queue
      const activeTrack = state.activeTrack;
      if (activeTrack && trackIds.includes(activeTrack.id)) {
        // Current track deleted -> clear queue and stop
        await get().clearPlayer();
      } else if (trackIds.length > 0) {
        const queue = await TrackPlayer.getQueue();
        const indicesToRemove: number[] = [];
        queue.forEach((track, index) => {
          if (track.id) {
            const originalId = (track.id as string).split('-')[0];
            if (trackIds.includes(originalId)) {
              indicesToRemove.push(index);
            }
          }
        });

        if (indicesToRemove.length > 0) {
          await TrackPlayer.remove(indicesToRemove);
          await get().updateQueueStatus();
          await get().savePlaybackState();
        }
      }
    } catch (error) {
      console.error("Error handling deleted entities in player store:", error);
    }
  }
}));
