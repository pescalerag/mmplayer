import TrackPlayer, { State } from 'react-native-track-player';
import BackgroundTimer from 'react-native-background-timer';
import { useSettingsStore } from '../store/useSettingsStore';
import { 
  setIsFadingOut, 
  getIsFadingOut 
} from '../hooks/usePlaybackState';

// Extend TypeScript typings for play/pause bypass options
declare module 'react-native-track-player' {
  export function play(bypassFade?: boolean): Promise<void>;
  export function pause(bypassFade?: boolean): Promise<void>;
}

const FADE_DURATION = 400; // ms
const TOTAL_STEPS = 16;
const STEP_INTERVAL = Math.round(FADE_DURATION / TOTAL_STEPS); // 25 ms

// Keep references to original TrackPlayer functions
const originalPlay = TrackPlayer.play.bind(TrackPlayer);
const originalPause = TrackPlayer.pause.bind(TrackPlayer);
const originalReset = TrackPlayer.reset.bind(TrackPlayer);
const originalSetVolume = TrackPlayer.setVolume.bind(TrackPlayer);
const originalGetPlaybackState = TrackPlayer.getPlaybackState.bind(TrackPlayer);
const originalSeekTo = TrackPlayer.seekTo.bind(TrackPlayer);
const originalGetProgress = TrackPlayer.getProgress.bind(TrackPlayer);

let fadeTimer: any = null;
let targetVolume = 1.0;
let currentVolume = 1.0;
let currentOperationId = 0;

function clearFadeTimer() {
  if (fadeTimer !== null) {
    try {
      BackgroundTimer.clearTimeout(fadeTimer);
      BackgroundTimer.clearInterval(fadeTimer);
    } catch (e) {}
    fadeTimer = null;
  }
}

// Override getProgress
TrackPlayer.getProgress = async () => {
  const { useCastStore } = require('../store/useCastStore');
  const castState = useCastStore.getState();
  if (castState.isLocalCastActive) {
    const { usePlayerStore } = require('../store/usePlayerStore');
    const activeTrack = usePlayerStore.getState().activeTrack;
    const dur = castState.castDuration > 0 ? castState.castDuration : (activeTrack?.duration || 0);
    return {
      position: castState.castPosition || 0,
      duration: dur,
      buffered: dur,
    };
  }
  return originalGetProgress();
};

// Override seekTo to sync with Chromecast and LocalCast
TrackPlayer.seekTo = async (position: number) => {
  try {
    const { useCastStore } = require('../store/useCastStore');
    if (useCastStore.getState().isChromecastConnected) {
      const { ChromecastService } = require('./ChromecastService');
      ChromecastService.seekTo(position);
    }
    if (useCastStore.getState().isLocalCastActive) {
      useCastStore.setState({ castPosition: position });
      const { LocalCastService } = require('./LocalCastService');
      LocalCastService.emitSeek(position);
      return;
    }
  } catch (e) {}
  return originalSeekTo(position);
};

// Override getPlaybackState
TrackPlayer.getPlaybackState = async () => {
  const { useCastStore } = require('../store/useCastStore');
  const isLocalCast = useCastStore.getState().isLocalCastActive;
  if (isLocalCast) {
    setIsFadingOut(false);
    return { state: useCastStore.getState().isCastPlaying ? State.Playing : State.Paused };
  }

  const originalState = await originalGetPlaybackState();
  const castState = useCastStore.getState();
  const isCasting = castState.isServerRunning && (castState.isLocalCastActive || castState.isChromecastConnected);

  if (isCasting) {
    setIsFadingOut(false);
    return originalState;
  }

  const isNativePaused = 
    originalState.state !== State.Playing && 
    originalState.state !== State.Buffering;

  if (getIsFadingOut() && isNativePaused) {
    setIsFadingOut(false);
  }

  if (getIsFadingOut() && !isNativePaused) {
    return { ...originalState, state: State.Paused };
  }
  return originalState;
};

// Override setVolume
TrackPlayer.setVolume = async (volume: number) => {
  const { useCastStore } = require('../store/useCastStore');
  const castState = useCastStore.getState();
  const isCasting = castState.isServerRunning && (castState.isLocalCastActive || castState.isChromecastConnected);

  if (isCasting) {
    clearFadeTimer();
    setIsFadingOut(false);
    currentVolume = 0;
    return originalSetVolume(0);
  }

  if (volume > 0.05) {
    targetVolume = volume;
  } else if (volume === 0) {
    targetVolume = 0;
  }

  // Si hay un fade en progreso (in o out), dejamos que el timer de fade continúe
  // actualizando el volumen hasta targetVolume de forma progresiva.
  if (fadeTimer !== null || getIsFadingOut()) {
    return;
  }

  currentVolume = volume;
  return originalSetVolume(volume);
};

// Override getVolume - returns the logical volume (targetVolume)
TrackPlayer.getVolume = async () => {
  return targetVolume > 0.05 ? targetVolume : 1.0;
};

// Override reset
TrackPlayer.reset = async () => {
  clearFadeTimer();
  setIsFadingOut(false);
  currentVolume = targetVolume;
  return originalReset();
};

// Override play
TrackPlayer.play = async (bypassFade = false) => {
  const opId = ++currentOperationId;
  clearFadeTimer();
  setIsFadingOut(false);

  const { useCastStore } = require('../store/useCastStore');
  const castState = useCastStore.getState();
  const isCasting = castState.isServerRunning && (castState.isLocalCastActive || castState.isChromecastConnected);

  try {
    if (useCastStore.getState().isChromecastConnected) {
      const { ChromecastService } = require('./ChromecastService');
      ChromecastService.play();
    }
  } catch (e) {}

  // When casting (local or chromecast), phone's native audio must remain silent
  if (isCasting) {
    currentVolume = 0;
    await originalSetVolume(0);
    try {
      if (useCastStore.getState().isLocalCastActive) {
        useCastStore.getState().setCastPlaying(true);
        const { LocalCastService } = require('./LocalCastService');
        LocalCastService.emitPlay();
        await originalPause(); // Prevent ExoPlayer from running in silence and auto-advancing on its own
        return;
      }
    } catch (e) {}
    return originalPlay();
  }

  // If not casting and targetVolume was stuck at 0 (e.g. from previous cast), restore default 1.0
  if (targetVolume <= 0.05) {
    targetVolume = 1.0;
  }

  const isFadeEnabled = useSettingsStore.getState().isFadeEnabled;
  if (!isFadeEnabled) {
    bypassFade = true;
  }

  if (bypassFade) {
    currentVolume = targetVolume;
    await originalSetVolume(targetVolume);
    return originalPlay();
  }

  let isPlaying = false;
  try {
    const state = await originalGetPlaybackState();
    isPlaying = state.state === State.Playing || state.state === State.Buffering;
  } catch (e) {
    console.warn("[TrackPlayerFade] Error checking playback state in play:", e);
  }

  if (opId !== currentOperationId) return;

  const shouldFadeIn = !isPlaying || currentVolume < (targetVolume - 0.05);

  if (!isPlaying) {
    currentVolume = 0;
    await originalSetVolume(0);
  }

  await originalPlay();

  if (opId !== currentOperationId) return;

  if (shouldFadeIn) {
    const startVol = currentVolume;
    const volDiff = targetVolume - startVol;
    if (targetVolume <= 0 || volDiff <= 0.01) {
      currentVolume = targetVolume;
      await originalSetVolume(targetVolume);
      return;
    }

    const stepVal = volDiff / TOTAL_STEPS;
    let step = 0;

    const runFadeInStep = async () => {
      if (opId !== currentOperationId) return;

      step++;
      currentVolume = Math.min(Math.max(startVol + (stepVal * step), 0), targetVolume);
      await originalSetVolume(currentVolume);

      if (opId !== currentOperationId) return;

      if (step < TOTAL_STEPS && currentVolume < targetVolume) {
        fadeTimer = BackgroundTimer.setTimeout(runFadeInStep, STEP_INTERVAL);
      } else {
        currentVolume = targetVolume;
        await originalSetVolume(targetVolume);
        fadeTimer = null;
      }
    };

    fadeTimer = BackgroundTimer.setTimeout(runFadeInStep, STEP_INTERVAL);
  } else {
    currentVolume = targetVolume;
    await originalSetVolume(targetVolume);
  }
};

// Override pause
TrackPlayer.pause = async (bypassFade = false) => {
  const opId = ++currentOperationId;
  clearFadeTimer();

  const { useCastStore } = require('../store/useCastStore');
  const castState = useCastStore.getState();

  try {
    if (castState.isChromecastConnected) {
      const { ChromecastService } = require('./ChromecastService');
      ChromecastService.pause();
    }
  } catch (e) {}

  // When LocalCast (or Chromecast) is active the phone volume is already 0.
  // Doing a fade-out via BackgroundTimer is pointless and,
  // critically, Android freezes timers when the screen is off —
  // leaving the native player stuck in Playing state and never pausing.
  const isCasting = castState.isServerRunning && (castState.isLocalCastActive || castState.isChromecastConnected);
  const isFadeEnabled = useSettingsStore.getState().isFadeEnabled;
  if (!isFadeEnabled || isCasting) {
    bypassFade = true;
  }

  if (bypassFade) {
    setIsFadingOut(false);
    currentVolume = 0;
    await originalSetVolume(0);
    await originalPause();
    try {
      if (castState.isLocalCastActive) {
        castState.setCastPlaying(false);
        const { LocalCastService } = require('./LocalCastService');
        LocalCastService.emitPause();
      }
    } catch (e) {}
    return;
  }

  // If already fading out, user tapped pause again: pause immediately without waiting
  if (getIsFadingOut()) {
    currentVolume = 0;
    await originalSetVolume(0);
    await originalPause();
    return;
  }

  let isPlaying = false;
  try {
    const state = await originalGetPlaybackState();
    isPlaying = state.state === State.Playing || state.state === State.Buffering;
  } catch (e) {
    console.warn("[TrackPlayerFade] Error checking playback state in pause:", e);
  }

  if (opId !== currentOperationId) return;

  if (!isPlaying) {
    setIsFadingOut(false);
    currentVolume = 0;
    await originalSetVolume(0);
    await originalPause();
    return;
  }

  const startVol = currentVolume;
  if (startVol <= 0.05) {
    setIsFadingOut(false);
    currentVolume = 0;
    await originalSetVolume(0);
    await originalPause();
    return;
  }

  setIsFadingOut(true);

  const stepVal = startVol / TOTAL_STEPS;
  let step = 0;

  const runFadeOutStep = async () => {
    if (opId !== currentOperationId) {
      return;
    }

    step++;
    currentVolume = Math.max(startVol - (stepVal * step), 0);
    await originalSetVolume(currentVolume);

    if (opId !== currentOperationId) {
      return;
    }

    if (step < TOTAL_STEPS && currentVolume > 0) {
      fadeTimer = BackgroundTimer.setTimeout(runFadeOutStep, STEP_INTERVAL);
    } else {
      currentVolume = 0;
      await originalSetVolume(0);
      await originalPause();
      if (opId !== currentOperationId) {
        return;
      }
      fadeTimer = null;
    }
  };

  fadeTimer = BackgroundTimer.setTimeout(runFadeOutStep, STEP_INTERVAL);
};
