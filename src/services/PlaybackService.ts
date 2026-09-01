import TrackPlayer, { Event, State, RemotePlaySearchEvent } from "react-native-track-player";
import { createMMKV } from "react-native-mmkv";
import { HistoryService } from "./HistoryService";
import { useSettingsStore } from "../store/useSettingsStore";
import { database } from "../database";
import Track from "../database/models/Track";
import { Q } from "@nozbe/watermelondb";
import { LyricsSyncService } from "./LyricsSyncService";
import { useCastStore } from "../store/useCastStore";
import { updateWidget } from "../../modules/native-audio-scanner";
import { useABRepeatStore } from "../store/useABRepeatStore";
import { usePlayerStore } from "../store/usePlayerStore";

const SKIP_PREVIOUS_THRESHOLD = 3;

const storage = createMMKV();

let lastPlayTimestamp: number | null = null;
let currentTrackId: string | null = null;
let accumulatedTimes: Record<string, number> = {};
let lastKnownPosition = 0;
let lastKnownDuration = 0;

export const PlaybackTimeTracker = {
  onStatePlaying(trackId: string) {
    if (currentTrackId !== trackId) {
      this.onStateNotPlaying();
      currentTrackId = trackId;
    }
    if (!lastPlayTimestamp) {
      lastPlayTimestamp = Date.now();
    }
    if (accumulatedTimes[trackId] === undefined) {
      accumulatedTimes[trackId] = 0;
    }
  },

  onStateNotPlaying() {
    if (lastPlayTimestamp && currentTrackId) {
      const elapsed = Date.now() - lastPlayTimestamp;
      accumulatedTimes[currentTrackId] = (accumulatedTimes[currentTrackId] || 0) + elapsed;
      lastPlayTimestamp = null;
    }
  },

  getAccumulatedSeconds(trackId: string) {
    let total = accumulatedTimes[trackId] || 0;
    if (lastPlayTimestamp && currentTrackId === trackId) {
      total += Date.now() - lastPlayTimestamp;
    }
    return total / 1000;
  },

  clearAccumulated(trackId: string) {
    delete accumulatedTimes[trackId];
  },

  getCurrentTrackId() {
    return currentTrackId;
  },

  isTimerRunning() {
    return lastPlayTimestamp !== null;
  },

  setAccumulatedSeconds(trackId: string, seconds: number) {
    accumulatedTimes[trackId] = seconds * 1000;
    currentTrackId = trackId;
  }
};

export async function syncWidgetState() {
  try {
    const activeTrack = await TrackPlayer.getActiveTrack();
    const playbackState = await TrackPlayer.getPlaybackState();
    const isPlaying = playbackState.state === State.Playing;

    const title = activeTrack?.title ?? "MMPlayer";
    const artist = activeTrack?.artist ?? "No se está reproduciendo";
    const artwork = activeTrack?.artwork ?? null;

    await updateWidget(title, artist, artwork, isPlaying);
  } catch (e) {
    console.error("Error syncing widget state:", e);
  }
}

export const PlaybackService = async function () {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemotePlayPause, async () => {
    const state = await TrackPlayer.getPlaybackState();
    if (state.state === State.Playing) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  });
  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    if (usePlayerStore.getState().isSyncingLyrics) {
      console.log("[PlaybackService] Ignored RemoteNext during lyrics sync");
      return;
    }
    TrackPlayer.skipToNext();
  });
  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
    if (usePlayerStore.getState().isSyncingLyrics) {
      console.log("[PlaybackService] Ignored RemotePrevious during lyrics sync");
      return;
    }
    try {
      const { position } = await TrackPlayer.getProgress();
      if (position > SKIP_PREVIOUS_THRESHOLD) {
        await TrackPlayer.seekTo(0);
      } else {
        await TrackPlayer.skipToPrevious();
      }
    } catch (e) {
      console.log('Error in RemotePrevious', e);
    }
  });
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.reset());
  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => TrackPlayer.seekTo(event.position));
  
  TrackPlayer.addEventListener(Event.PlaybackState, async (event) => {
    if (event.state === State.Playing) {
      const trackIndex = await TrackPlayer.getActiveTrackIndex();
      if (trackIndex !== undefined && trackIndex !== null) {
        const track = await TrackPlayer.getTrack(trackIndex);
        if (track && track.id) {
          PlaybackTimeTracker.onStatePlaying(track.id.toString());
        }
      }
    } else {
      PlaybackTimeTracker.onStateNotPlaying();
    }

    // Persistir posición y acumulado ante cambios de estado (pausa, stop, etc.)
    try {
      const trackId = PlaybackTimeTracker.getCurrentTrackId();
      if (trackId) {
        const progress = await TrackPlayer.getProgress();
        storage.set("@player_position", progress.position);
        storage.set("@player_accumulated", PlaybackTimeTracker.getAccumulatedSeconds(trackId));
      }
    } catch (e) {
      console.error("Error persistiendo posición en PlaybackState:", e);
    }
    await syncWidgetState();
  });

  TrackPlayer.addEventListener(
    Event.PlaybackActiveTrackChanged,
    async (event) => {
      const isSyncActive = usePlayerStore.getState().isSyncingLyrics;
      if (isSyncActive && event.track) {
        const syncedTrack = usePlayerStore.getState().activeTrack;
        if (syncedTrack && event.track.id !== syncedTrack.id) {
          console.log("[PlaybackService] Lyrics sync active. Reverting track change.");
          const queue = await TrackPlayer.getQueue();
          const syncedIndex = queue.findIndex(t => t.id?.toString().startsWith(syncedTrack.id.toString()));
          if (syncedIndex !== -1) {
            await TrackPlayer.skip(syncedIndex);
            await TrackPlayer.seekTo(0);
            await TrackPlayer.pause();
          }
          return;
        }
      }

      const previousTrackId = event.lastTrack?.id?.toString() || PlaybackTimeTracker.getCurrentTrackId();
      const nextTrackId = event.track?.id?.toString();

      // NUEVO: Lógica de Normalización de Volumen Segura (Compatible con Cast)
      if (nextTrackId) {
        try {
          const isCasting = useCastStore.getState().isServerRunning;
          
          if (isCasting) {
             // Si el servidor de Cast está activo, MANTENEMOS el móvil silenciado (volumen 0)
             await TrackPlayer.setVolume(0);
          } else {
             // Flujo normal: Aplicamos la normalización de volumen o lo restauramos a 1.0
             const settings = useSettingsStore.getState();
             
             if (settings.isNormalizationEnabled) {
                const cleanId = nextTrackId.split('-')[0];
                const trackModel = await database.get<Track>('tracks').find(cleanId);
                const trackGainDB = trackModel.replayGain ?? settings.fallbackGainDB;
                const totalTargetDB = trackGainDB + settings.preampLevel;
                
                let linearVolume = Math.pow(10, totalTargetDB / 20);
                linearVolume = Math.min(Math.max(linearVolume, 0), 1.0);
                
                await TrackPlayer.setVolume(linearVolume);
             } else {
                await TrackPlayer.setVolume(1.0);
             }
          }
        } catch (error) {
          console.error("Error aplicando volumen:", error);
          await TrackPlayer.setVolume(1.0); // Fallback
        }
      }

      // Reset position memory on track change
      lastKnownPosition = 0;
      lastKnownDuration = 0;

      // Reiniciar estado de repetición A-B al cambiar la canción
      useABRepeatStore.getState().clearAB();

      // Reset cast position on track change so new song starts at 0:00
      useCastStore.setState({ castPosition: 0 });

      // Limpiar minutaje y acumulado persistido de la canción anterior
      storage.set("@player_position", 0);
      storage.set("@player_accumulated", 0);

      // Record check if the timer was active prior to transition
      const wasPlaying = PlaybackTimeTracker.isTimerRunning();

      PlaybackTimeTracker.onStateNotPlaying();

      if (previousTrackId) {
        const durationPlayed = PlaybackTimeTracker.getAccumulatedSeconds(previousTrackId);
        let requiredSeconds = 20;
        try {
          const cleanId = previousTrackId.split('-')[0];
          const track = await database.get<Track>('tracks').find(cleanId);
          if (track && track.duration) {
            requiredSeconds = track.duration * 0.5;
          }
        } catch (e) {
          console.warn('[PlaybackService] Failed to find previous track for duration:', e);
        }
        if (durationPlayed >= requiredSeconds) {
          console.log(`[Historial] Guardando en historial. Canción: ${previousTrackId}, Duración: ${Math.floor(durationPlayed)}s.`);
          await HistoryService.logToDatabase(
            previousTrackId,
            durationPlayed,
            "queue",
          );
        } else {
          console.log(`[Historial] Canción descartada (escuchada ${Math.floor(durationPlayed)}s, requiere ${Math.floor(requiredSeconds)}s).`);
        }
        PlaybackTimeTracker.clearAccumulated(previousTrackId);
      }

      // If it was playing, restart the timer for the next/looped track
      if (wasPlaying && nextTrackId) {
        PlaybackTimeTracker.onStatePlaying(nextTrackId);
      }

      // Sync track to Chromecast if connected (starts at 0:00 for new track)
      if (useCastStore.getState().isChromecastConnected && event.track) {
        try {
          const { ChromecastService } = require('./ChromecastService');
          ChromecastService.loadTrack(event.track, null, 0);
        } catch (castErr) {
          console.error('[PlaybackService] Error loading track on Chromecast:', castErr);
        }
      }

      // Pre-buffer next track if casting (LocalCast or Chromecast)
      if (useCastStore.getState().isLocalCastActive || useCastStore.getState().isChromecastConnected) {
        try {
          const { LocalCastService } = require('./LocalCastService');
          LocalCastService.triggerPreloadNext().catch(() => {});
        } catch (preloadErr) {
          console.error('[PlaybackService] Error preloading next track during cast:', preloadErr);
        }
      }

      setTimeout(async () => {
        try {
          const queue = await TrackPlayer.getQueue();
          const currentIndex = await TrackPlayer.getActiveTrackIndex();
          if (currentIndex !== undefined && currentIndex !== null) {
            const ids = queue.map(q => q.id?.toString() ?? '');
            await LyricsSyncService.prefetchForQueue(currentIndex, ids);
          }
        } catch { }
      }, 2000);

      // ── Sync Zustand store so PlayerScreen always reflects the real active track ──
      // This is the single source of truth for the UI. Without this, skipping from
      // the notification, lock screen, or LocalCast /api/next leaves activeTrack stale.
      if (event.track?.id) {
        try {
          const { setActiveTrackById, updateQueueStatus } = usePlayerStore.getState();
          await setActiveTrackById(event.track.id.toString());
          const newIndex = await TrackPlayer.getActiveTrackIndex();
          if (newIndex !== undefined && newIndex !== null) {
            await updateQueueStatus(newIndex);
          }
          // Bump versions so PlayerScreenUI re-runs syncAdjacentTracks immediately
          // This is critical for the swipe slots (prev/next artwork) to update
          usePlayerStore.setState((state: any) => ({
            windowVersion: (state.windowVersion || 0) + 1,
            queueVersion: (state.queueVersion || 0) + 1,
          }));
        } catch (storeErr) {
          console.error('[PlaybackService] Error syncing store after track change:', storeErr);
        }
      }

      await syncWidgetState();
    },
  );

  TrackPlayer.addEventListener(
    Event.PlaybackProgressUpdated,
    async (event) => {
      const { position, duration } = event;

      // Verificar y ejecutar bucle A-B si está activo
      await useABRepeatStore.getState().checkLoop(position);
      
      if (duration > 0 && lastKnownPosition > 0) {
        // Detect if position jumped backwards to the start from near the end
        const isLoopDetected = 
          position < lastKnownPosition && 
          (lastKnownDuration - lastKnownPosition) < 2.0 && 
          position < 2.0;
          
        if (isLoopDetected) {
          const trackIndex = await TrackPlayer.getActiveTrackIndex();
          if (trackIndex !== undefined && trackIndex !== null) {
            const track = await TrackPlayer.getTrack(trackIndex);
            if (track && track.id) {
              const trackId = track.id.toString();
              
              // Only trigger if it is the same track looping
              if (trackId === PlaybackTimeTracker.getCurrentTrackId()) {
                PlaybackTimeTracker.onStateNotPlaying();
                
                const durationPlayed = PlaybackTimeTracker.getAccumulatedSeconds(trackId);
                
                let requiredSeconds = 20;
                try {
                  const cleanId = trackId.split('-')[0];
                  const track = await database.get<Track>('tracks').find(cleanId);
                  if (track && track.duration) {
                    requiredSeconds = track.duration * 0.5;
                  }
                } catch (e) {
                  console.warn('[PlaybackService] Failed to find loop track for duration:', e);
                }
                
                if (durationPlayed >= requiredSeconds) {
                  console.log(`[Historial] Guardando en historial (bucle). Canción: ${trackId}, Duración: ${Math.floor(durationPlayed)}s.`);
                  await HistoryService.logToDatabase(trackId, durationPlayed, "queue");
                } else {
                  console.log(`[Historial] Canción descartada (escuchada ${Math.floor(durationPlayed)}s, requiere ${Math.floor(requiredSeconds)}s).`);
                }
                
                PlaybackTimeTracker.clearAccumulated(trackId);
                PlaybackTimeTracker.onStatePlaying(trackId);
              }
            }
          }
        }
      }
      
      lastKnownPosition = position;
      lastKnownDuration = duration;

      // Persistir posición y acumulado periódicamente (cada 1s)
      try {
        const trackId = PlaybackTimeTracker.getCurrentTrackId();
        if (trackId) {
          storage.set("@player_position", position);
          storage.set("@player_accumulated", PlaybackTimeTracker.getAccumulatedSeconds(trackId));
        }
      } catch (e) {
        console.error("Error persistiendo posición en PlaybackProgressUpdated:", e);
      }
    }
  );

  TrackPlayer.addEventListener(Event.RemotePlaySearch, async (event: RemotePlaySearchEvent) => {
    console.log('[Voice Assistant] Request:', event);
    const searchTerm = event.title || event.artist || event.query || '';
    if (!searchTerm) {
      await TrackPlayer.play();
      return;
    }
    try {
      const tracksCollection = database.collections.get<Track>('tracks');
      const results = await tracksCollection.query(
        Q.or(
          Q.where('title', Q.like(`%${Q.sanitizeLikeString(searchTerm)}%`)),
          Q.where('artist', Q.like(`%${Q.sanitizeLikeString(searchTerm)}%`))
        )
      ).fetch();

      if (results.length > 0) {
        await usePlayerStore.getState().loadQueue(results, 0, "voice_search");
        await TrackPlayer.play();
      } else {
        console.log('[Voice Assistant] No tracks found for:', searchTerm);
      }
    } catch (error) {
      console.error('[Voice Assistant] DB error:', error);
    }
  });
};
