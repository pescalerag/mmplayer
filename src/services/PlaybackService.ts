import TrackPlayer, { Event, State } from "react-native-track-player";
import { HistoryService } from "./HistoryService";

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
  }
};

export const PlaybackService = async function () {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
    try {
      const { position } = await TrackPlayer.getProgress();
      if (position > 3) {
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
  });

  TrackPlayer.addEventListener(
    Event.PlaybackActiveTrackChanged,
    async (event) => {
      const previousTrackId = event.lastTrack?.id?.toString() || PlaybackTimeTracker.getCurrentTrackId();
      const nextTrackId = event.track?.id?.toString();

      // Reset position memory on track change
      lastKnownPosition = 0;
      lastKnownDuration = 0;

      // Record check if the timer was active prior to transition
      const wasPlaying = PlaybackTimeTracker.isTimerRunning();

      PlaybackTimeTracker.onStateNotPlaying();

      if (previousTrackId) {
        const durationPlayed = PlaybackTimeTracker.getAccumulatedSeconds(previousTrackId);
        if (durationPlayed >= 20) {
          console.log(`[Historial] Guardando en historial. Canción: ${previousTrackId}, Duración: ${Math.floor(durationPlayed)}s.`);
          await HistoryService.logToDatabase(
            previousTrackId,
            durationPlayed,
            "queue",
          );
        } else {
          console.log(`[Historial] Canción descartada (escuchada ${Math.floor(durationPlayed)}s, requiere 20s).`);
        }
        PlaybackTimeTracker.clearAccumulated(previousTrackId);
      }

      // If it was playing, restart the timer for the next/looped track
      if (wasPlaying && nextTrackId) {
        PlaybackTimeTracker.onStatePlaying(nextTrackId);
      }
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
                
                if (durationPlayed >= 20) {
                  console.log(`[Historial] Guardando en historial (bucle). Canción: ${trackId}, Duración: ${Math.floor(durationPlayed)}s.`);
                  await HistoryService.logToDatabase(trackId, durationPlayed, "queue");
                } else {
                  console.log(`[Historial] Canción descartada (escuchada ${Math.floor(durationPlayed)}s, requiere 20s).`);
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
    }
  );
};
