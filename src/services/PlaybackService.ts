import TrackPlayer, { Event, State } from "react-native-track-player";
import { createMMKV } from "react-native-mmkv";
import { HistoryService } from "./HistoryService";
import { useSettingsStore } from "../store/useSettingsStore";
import { database } from "../database";
import Track from "../database/models/Track";
import { LyricsSyncService } from "./LyricsSyncService";
import { useCastStore } from "../store/useCastStore";
import { updateWidget } from "../../modules/native-audio-scanner";

const MIN_SECONDS_FOR_HISTORY = 20;
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
  TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
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

      // Limpiar minutaje y acumulado persistido de la canción anterior
      storage.set("@player_position", 0);
      storage.set("@player_accumulated", 0);

      // Record check if the timer was active prior to transition
      const wasPlaying = PlaybackTimeTracker.isTimerRunning();

      PlaybackTimeTracker.onStateNotPlaying();

      if (previousTrackId) {
        const durationPlayed = PlaybackTimeTracker.getAccumulatedSeconds(previousTrackId);
        if (durationPlayed >= MIN_SECONDS_FOR_HISTORY) {
          console.log(`[Historial] Guardando en historial. Canción: ${previousTrackId}, Duración: ${Math.floor(durationPlayed)}s.`);
          await HistoryService.logToDatabase(
            previousTrackId,
            durationPlayed,
            "queue",
          );
        } else {
          console.log(`[Historial] Canción descartada (escuchada ${Math.floor(durationPlayed)}s, requiere ${MIN_SECONDS_FOR_HISTORY}s).`);
        }
        PlaybackTimeTracker.clearAccumulated(previousTrackId);
      }

      // If it was playing, restart the timer for the next/looped track
      if (wasPlaying && nextTrackId) {
        PlaybackTimeTracker.onStatePlaying(nextTrackId);
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
      await syncWidgetState();
    },
  );

  TrackPlayer.addEventListener(
    Event.PlaybackProgressUpdated,
    async (event) => {
      const { position, duration } = event;
      
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
                
                if (durationPlayed >= MIN_SECONDS_FOR_HISTORY) {
                  console.log(`[Historial] Guardando en historial (bucle). Canción: ${trackId}, Duración: ${Math.floor(durationPlayed)}s.`);
                  await HistoryService.logToDatabase(trackId, durationPlayed, "queue");
                } else {
                  console.log(`[Historial] Canción descartada (escuchada ${Math.floor(durationPlayed)}s, requiere ${MIN_SECONDS_FOR_HISTORY}s).`);
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
};
