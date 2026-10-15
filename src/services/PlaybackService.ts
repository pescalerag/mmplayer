import TrackPlayer, { Event, State, RemotePlaySearchEvent, PlaybackActiveTrackChangedEvent } from "react-native-track-player";
import { createMMKV } from "react-native-mmkv";
import { database } from "../database";
import Track from "../database/models/Track";
import { LyricsSyncService } from "./LyricsSyncService";
import { useCastStore } from "../store/useCastStore";
import { updateWidget } from "../../modules/native-audio-scanner";
import { useABRepeatStore } from "../store/useABRepeatStore";
import { consumeUserQueueTransition, usePlayerStore } from "../store/usePlayerStore";
import i18n from "../constants/i18n";
import { startNotificationFavoritesSync } from './NotificationFavoritesService';
import { PlaybackListenService } from './PlaybackListenService';
import { isSuspendedQueueListen, persistQueueTime, useMultipleQueuesStore } from '../store/useMultipleQueuesStore';
import { handleAutoRequest, startAndroidAutoService } from './AndroidAutoService';
import { ensurePlaybackReady } from './playerBootstrap';

const SKIP_PREVIOUS_THRESHOLD = 3;

const storage = createMMKV();

let lastPlayTimestamp: number | null = null;
let currentTrackId: string | null = null;
let accumulatedTimes: Record<string, number> = {};
let lastKnownPosition = 0;
let lastKnownDuration = 0;
let activeTrackEventRevision = 0;
const handledCrossfades = new Set<string>();

export const PlaybackTimeTracker = {
  reset() {
    lastPlayTimestamp = null;
    currentTrackId = null;
    accumulatedTimes = {};
    lastKnownPosition = 0;
    lastKnownDuration = 0;
  },
  addReportedSeconds(trackId: string, seconds: number) {
    this.onStateNotPlaying();
    currentTrackId = trackId;
    accumulatedTimes[trackId] = (accumulatedTimes[trackId] || 0) + seconds * 1000;
  },
  onStatePlaying(trackId: string, startedAt = Date.now()) {
    if (currentTrackId !== trackId) {
      this.onStateNotPlaying();
      currentTrackId = trackId;
    }
    if (!lastPlayTimestamp) {
      lastPlayTimestamp = startedAt;
    }
    if (accumulatedTimes[trackId] === undefined) {
      accumulatedTimes[trackId] = 0;
    }
  },

  onStateNotPlaying(stoppedAt = Date.now()) {
    if (lastPlayTimestamp && currentTrackId) {
      const elapsed = Math.max(0, stoppedAt - lastPlayTimestamp);
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

  restoreAccumulatedSeconds(trackId: string, seconds: number) {
    accumulatedTimes[trackId] = (accumulatedTimes[trackId] || 0) + seconds * 1000;
  },

  clearAccumulated(trackId: string) {
    delete accumulatedTimes[trackId];
    if (currentTrackId === trackId) {
      lastPlayTimestamp = null;
      currentTrackId = null;
    }
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

async function syncActiveTrackToStore(event: PlaybackActiveTrackChangedEvent, revision: number) {
  // ── Sync Zustand store so PlayerScreen always reflects the real active track ──
  // This is the single source of truth for the UI. Without this, skipping from
  // the notification, lock screen, or LocalCast /api/next leaves activeTrack stale.
  let effectiveTrack = event.track;
  if (!effectiveTrack?.id) {
    try {
      effectiveTrack = await TrackPlayer.getActiveTrack();
      if (!effectiveTrack?.id && event.index !== undefined && event.index !== null) {
        const queue = await TrackPlayer.getQueue();
        effectiveTrack = queue[event.index] ?? null;
      }
    } catch {}
  }

  if (effectiveTrack?.id && revision === activeTrackEventRevision) {
    try {
      const { setActiveTrackById, updateQueueStatus } = usePlayerStore.getState();
      const instanceId = (effectiveTrack as any)?.instanceId;
      await setActiveTrackById(effectiveTrack.id.toString(), instanceId);
      if (revision !== activeTrackEventRevision) return;
      const newIndex = event.index ?? await TrackPlayer.getActiveTrackIndex();
      if (newIndex !== undefined && newIndex !== null) {
        await updateQueueStatus(newIndex);
      }
      if (revision !== activeTrackEventRevision) return;
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

}

export async function syncWidgetState() {
  try {
    const activeTrack = await TrackPlayer.getActiveTrack();
    const playbackState = await TrackPlayer.getPlaybackState();
    const isPlaying = playbackState.state === State.Playing;

    const title = activeTrack?.title ?? "MMPlayer";
    const artist = activeTrack?.artist ?? i18n.t('common.not_playing');
    const artwork = activeTrack?.artwork ?? null;

    await updateWidget(title, artist, artwork, isPlaying);
  } catch (e) {
    console.error("Error syncing widget state:", e);
  }
}


async function restoreLyricsSyncTrack(event: PlaybackActiveTrackChangedEvent): Promise<boolean> {
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
            return true;
        }
    }
    return false;
}

async function persistPreviousListen(previousTrackId: string | undefined) {
  if (!previousTrackId) return;
  if (isSuspendedQueueListen(previousTrackId)) return;
  const seconds = PlaybackTimeTracker.getAccumulatedSeconds(previousTrackId);
  PlaybackTimeTracker.clearAccumulated(previousTrackId);
  try { await PlaybackListenService.save(previousTrackId, seconds, true); }
  catch (error) {
    PlaybackTimeTracker.restoreAccumulatedSeconds(previousTrackId, seconds);
    throw error;
  }
}

function hasPlaybackLooped(position: number, duration: number) {
  return duration > 0 && lastKnownPosition > 0 && position < lastKnownPosition
    && lastKnownDuration - lastKnownPosition < 2 && position < 2;
}

async function persistLoopListen(position: number, duration: number) {
  if (useCastStore.getState().isLocalCastActive) return;
  if (useMultipleQueuesStore.getState().isSwitching) return;
  const queueAtStart = useMultipleQueuesStore.getState().activeId;
  if (!hasPlaybackLooped(position, duration)) return;
  const index = await TrackPlayer.getActiveTrackIndex();
  if (index == null) return;
  const track = await TrackPlayer.getTrack(index);
  const trackId = track?.id?.toString();
  if (!trackId || trackId !== PlaybackTimeTracker.getCurrentTrackId()) return;
  if (isSuspendedQueueListen(trackId) || useMultipleQueuesStore.getState().activeId !== queueAtStart) return;
  PlaybackTimeTracker.onStateNotPlaying();
  await persistPreviousListen(trackId);
  if (isSuspendedQueueListen(trackId) || useMultipleQueuesStore.getState().activeId !== queueAtStart) return;
  PlaybackTimeTracker.onStatePlaying(trackId);
}

export const PlaybackService = async function () {
  startAndroidAutoService();
  void ensurePlaybackReady().catch(error => console.error('[Playback] Initialization failed:', error));
  startNotificationFavoritesSync();
  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    await ensurePlaybackReady();
    if (useMultipleQueuesStore.getState().isSwitching) return;
    usePlayerStore.setState({ isPreparingExternal: false });
    await TrackPlayer.play();
  });
  TrackPlayer.addEventListener(Event.RemotePause, async () => { await ensurePlaybackReady(); await TrackPlayer.pause(); });
  TrackPlayer.addEventListener(Event.RemotePlayPause, async () => {
    await ensurePlaybackReady();
    if (useMultipleQueuesStore.getState().isSwitching) return;
    const state = await TrackPlayer.getPlaybackState();
    if (state.state === State.Playing) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  });
  TrackPlayer.addEventListener(Event.RemoteNext, async () => {
    await ensurePlaybackReady();
    if (useMultipleQueuesStore.getState().isSwitching) return;
    console.log("[PlaybackService] Event.RemoteNext triggered");
    if (usePlayerStore.getState().isSyncingLyrics) {
      console.log("[PlaybackService] Ignored RemoteNext during lyrics sync");
      return;
    }
    await usePlayerStore.getState().skipToNext();
  });
  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
    await ensurePlaybackReady();
    if (useMultipleQueuesStore.getState().isSwitching) return;
    console.log("[PlaybackService] Event.RemotePrevious triggered");
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

  TrackPlayer.addEventListener(Event.RemoteJumpForward, async () => {
    console.log("[PlaybackService] Event.RemoteJumpForward triggered -> skipToNext");
    if (usePlayerStore.getState().isSyncingLyrics) {
      return;
    }
    await usePlayerStore.getState().skipToNext();
  });

  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async () => {
    console.log("[PlaybackService] Event.RemoteJumpBackward triggered -> skipToPrevious");
    if (usePlayerStore.getState().isSyncingLyrics) {
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
      console.log('Error in RemoteJumpBackward', e);
    }
  });

  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    await ensurePlaybackReady();
    try {
      await TrackPlayer.pause();
      await usePlayerStore.getState().savePlaybackState();
      PlaybackTimeTracker.onStateNotPlaying();
    } catch (e) {
      console.error("[PlaybackService] Error handling RemoteStop:", e);
    }
  });
  TrackPlayer.addEventListener(Event.RemoteSeek, async event => { await ensurePlaybackReady(); await TrackPlayer.seekTo(event.position); });
  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async () => {
    if (useMultipleQueuesStore.getState().isSwitching) return;
    try {
      PlaybackTimeTracker.onStateNotPlaying();
      await persistPreviousListen(PlaybackTimeTracker.getCurrentTrackId() ?? undefined);
      await usePlayerStore.getState().playRandomQueueOnEnd();
    } catch (e) {
      console.error('[PlaybackService] Error on PlaybackQueueEnded:', e);
    }
  });
  
  TrackPlayer.addEventListener(Event.PlaybackState, async (event) => {
    if (useMultipleQueuesStore.getState().isSwitching) return;
    const queueAtEvent = useMultipleQueuesStore.getState().activeId;
    const trackRevision = activeTrackEventRevision;
    if (event.state === State.Playing && !useCastStore.getState().isLocalCastActive) {
      const trackIndex = await TrackPlayer.getActiveTrackIndex();
      if (trackIndex !== undefined && trackIndex !== null) {
        const track = await TrackPlayer.getTrack(trackIndex);
        if (trackRevision !== activeTrackEventRevision || useMultipleQueuesStore.getState().isSwitching || useMultipleQueuesStore.getState().activeId !== queueAtEvent) return;
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
        if (useMultipleQueuesStore.getState().isSwitching || useMultipleQueuesStore.getState().activeId !== queueAtEvent) return;
        storage.set("@player_position", progress.position);
        storage.set("@player_accumulated", PlaybackTimeTracker.getAccumulatedSeconds(trackId));
        persistQueueTime(progress.position, PlaybackTimeTracker.getAccumulatedSeconds(trackId));
      }
    } catch (e) {
      console.error("Error persistiendo posición en PlaybackState:", e);
    }
    await syncWidgetState();
  });

  TrackPlayer.addEventListener(
    Event.PlaybackActiveTrackChanged,
    async (event) => {
      const crossfade = event as PlaybackActiveTrackChangedEvent & { crossfade?: boolean; transitionId?: string; occurredAt?: number };
      if (crossfade.transitionId) {
        if (handledCrossfades.has(crossfade.transitionId)) return;
        handledCrossfades.add(crossfade.transitionId);
        if (handledCrossfades.size > 64) handledCrossfades.delete(handledCrossfades.values().next().value!);
      }
      const revision = ++activeTrackEventRevision;
      if (useMultipleQueuesStore.getState().isSwitching) return;
      const previousTrackId = event.lastTrack?.id?.toString() || PlaybackTimeTracker.getCurrentTrackId();
      const nextTrackId = event.track?.id?.toString();
      let crossfadeHistory: Promise<void> | undefined;
      if (crossfade.crossfade && nextTrackId && !usePlayerStore.getState().isSyncingLyrics) {
        const boundary = Number.isFinite(crossfade.occurredAt) ? Math.min(Date.now(), crossfade.occurredAt!) : Date.now();
        // Commit time before any DB/bridge await: a later transition must not erase this listen.
        PlaybackTimeTracker.onStateNotPlaying(boundary);
        PlaybackTimeTracker.onStatePlaying(nextTrackId, boundary);
        crossfadeHistory = persistPreviousListen(previousTrackId ?? undefined);
        void crossfadeHistory.catch(error => console.error('[Crossfade] Could not persist the outgoing listen:', error));
      }
      if (await restoreLyricsSyncTrack(event)) return;
      if (revision !== activeTrackEventRevision || useMultipleQueuesStore.getState().isSwitching) return;

      void syncActiveTrackToStore(event, revision);
      consumeUserQueueTransition(event);

      // ReplayGain runs in the native PCM pipeline before the first sample.
      // Player volume remains reserved for transport fades and Cast muting.
      if (nextTrackId && useCastStore.getState().isServerRunning) {
        await TrackPlayer.setVolume(0);
      }

      // Reset position memory on track change
      lastKnownPosition = 0;
      lastKnownDuration = 0;

      // Reiniciar estado de repetición A-B al cambiar la canción
      useABRepeatStore.getState().clearAB();

      // Reset cast position on track change so new song starts at 0:00
      useCastStore.setState({ castPosition: 0, castDuration: 0 });
      if (nextTrackId && useCastStore.getState().isLocalCastActive) {
        const { LocalCastPlaybackService } = require('./LocalCastPlaybackService');
        LocalCastPlaybackService.selectTrack(nextTrackId);
      }

      // An incoming song may already have progressed while its event crossed the bridge.
      const incomingProgress = crossfade.crossfade ? await TrackPlayer.getProgress() : null;
      if (revision !== activeTrackEventRevision || useMultipleQueuesStore.getState().isSwitching) return;
      storage.set("@player_position", incomingProgress?.position ?? 0);
      storage.set("@player_accumulated", crossfade.crossfade && nextTrackId ? PlaybackTimeTracker.getAccumulatedSeconds(nextTrackId) : 0);

      if (!crossfade.crossfade) PlaybackTimeTracker.onStateNotPlaying();

      // Initial activation after restoring a queue is not a completed listen.
      if (crossfadeHistory) await crossfadeHistory;
      else if (event.lastTrack?.id || (nextTrackId && nextTrackId !== previousTrackId)) {
        await persistPreviousListen(previousTrackId);
      }

      // Reiniciar el timer SOLO si el reproductor está efectivamente en estado de reproducción (Playing)
      const currentState = await TrackPlayer.getPlaybackState();
      if (revision !== activeTrackEventRevision || useMultipleQueuesStore.getState().isSwitching) return;
      if (currentState.state === State.Playing && nextTrackId && !useCastStore.getState().isLocalCastActive) {
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

      await syncWidgetState();
    },
  );

  TrackPlayer.addEventListener(
    Event.PlaybackProgressUpdated,
    async (event) => {
      const { position, duration } = event;
      const progressTrackId = (event as typeof event & { trackId?: string }).trackId;
      if (progressTrackId && progressTrackId !== PlaybackTimeTracker.getCurrentTrackId()) return;
      if (useMultipleQueuesStore.getState().isSwitching) return;
      const queueAtEvent = useMultipleQueuesStore.getState().activeId;

      // Verificar y ejecutar bucle A-B si está activo
      await useABRepeatStore.getState().checkLoop(position);
      if (useMultipleQueuesStore.getState().isSwitching || useMultipleQueuesStore.getState().activeId !== queueAtEvent) return;
      
      await persistLoopListen(position, duration);
      if (useMultipleQueuesStore.getState().isSwitching || useMultipleQueuesStore.getState().activeId !== queueAtEvent) return;

      lastKnownPosition = position;
      lastKnownDuration = duration;

      // Persistir posición y acumulado periódicamente (cada 1s)
      try {
        const trackId = PlaybackTimeTracker.getCurrentTrackId();
        if (trackId) {
          storage.set("@player_position", position);
          storage.set("@player_accumulated", PlaybackTimeTracker.getAccumulatedSeconds(trackId));
          persistQueueTime(position, PlaybackTimeTracker.getAccumulatedSeconds(trackId));
        }
      } catch (e) {
        console.error("Error persistiendo posición en PlaybackProgressUpdated:", e);
      }
    }
  );

  TrackPlayer.addEventListener(Event.RemotePlaySearch, async (event: RemotePlaySearchEvent) => {
    try {
      await handleAutoRequest({ id: 'voice', kind: 'prepare', query: event.title || event.artist || event.query || '' });
      usePlayerStore.setState({ isPreparingExternal: false });
      await TrackPlayer.play();
    } catch (error) {
      console.error('[Voice Assistant] Playback request failed:', error);
    }
  });
};
