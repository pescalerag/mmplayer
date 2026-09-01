import TrackPlayer, { State } from 'react-native-track-player';
import BackgroundTimer from 'react-native-background-timer';
import { useSettingsStore } from '../store/useSettingsStore';
import { 
  setIsFadingOut, 
  getIsFadingOut, 
  setShouldStopFadingOut, 
  getShouldStopFadingOut 
} from '../hooks/usePlaybackState';

// Extend TypeScript typings for play/pause bypass options
declare module 'react-native-track-player' {
  export function play(bypassFade?: boolean): Promise<void>;
  export function pause(bypassFade?: boolean): Promise<void>;
}

const FADE_DURATION = 500; // ms
const STEP_INTERVAL = 20; // ms
const TOTAL_STEPS = FADE_DURATION / STEP_INTERVAL; // 25 steps

// Keep references to original TrackPlayer functions
const originalPlay = TrackPlayer.play.bind(TrackPlayer);
const originalPause = TrackPlayer.pause.bind(TrackPlayer);
const originalReset = TrackPlayer.reset.bind(TrackPlayer);
const originalSetVolume = TrackPlayer.setVolume.bind(TrackPlayer);
const originalGetPlaybackState = TrackPlayer.getPlaybackState.bind(TrackPlayer);
const originalSeekTo = TrackPlayer.seekTo.bind(TrackPlayer);
const originalGetProgress = TrackPlayer.getProgress.bind(TrackPlayer);

let fadeIntervalId: any = null;
let targetVolume = 1.0;
let currentVolume = 1.0;

function clearFadeInterval() {
  if (fadeIntervalId !== null) {
    BackgroundTimer.clearInterval(fadeIntervalId);
    fadeIntervalId = null;
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
    originalState.state === State.Paused || 
    originalState.state === State.Stopped || 
    originalState.state === State.None || 
    originalState.state === State.Ended;

  if (getIsFadingOut() && getShouldStopFadingOut() && isNativePaused) {
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
    clearFadeInterval();
    setIsFadingOut(false);
    currentVolume = 0;
    return originalSetVolume(0);
  }

  if (volume > 0.05) {
    targetVolume = volume;
  } else if (volume === 0) {
    targetVolume = 0;
  }

  // Si hay un fade en progreso (in o out), dejamos que el intervalo de fade continúe
  // actualizando el volumen hasta targetVolume de forma progresiva.
  if (fadeIntervalId !== null || getIsFadingOut()) {
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
  clearFadeInterval();
  setIsFadingOut(false);
  currentVolume = targetVolume;
  return originalReset();
};

// Override play
TrackPlayer.play = async (bypassFade = false) => {
  clearFadeInterval();
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

  const shouldFadeIn = !isPlaying || currentVolume < (targetVolume - 0.05);

  if (!isPlaying) {
    currentVolume = 0;
    await originalSetVolume(0);
  }

  await originalPlay();

  if (shouldFadeIn) {
    const startVol = currentVolume;
    if (targetVolume <= 0 || Math.abs(targetVolume - startVol) < 0.01) {
      currentVolume = targetVolume;
      await originalSetVolume(targetVolume);
      return;
    }

    const stepVal = (targetVolume - startVol) / TOTAL_STEPS;
    let step = 0;

    fadeIntervalId = BackgroundTimer.setInterval(async () => {
      step++;
      currentVolume += stepVal;
      
      const nextVol = Math.min(Math.max(currentVolume, 0), targetVolume);
      currentVolume = nextVol;
      await originalSetVolume(nextVol);

      if (step >= TOTAL_STEPS || nextVol >= targetVolume) {
        clearFadeInterval();
        currentVolume = targetVolume;
        await originalSetVolume(targetVolume);
      }
    }, STEP_INTERVAL);
  } else {
    currentVolume = targetVolume;
    await originalSetVolume(targetVolume);
  }
};

// Override pause
TrackPlayer.pause = async (bypassFade = false) => {
  const { useCastStore } = require('../store/useCastStore');
  const castState = useCastStore.getState();

  try {
    if (castState.isChromecastConnected) {
      const { ChromecastService } = require('./ChromecastService');
      ChromecastService.pause();
    }
  } catch (e) {}

  // When LocalCast (or Chromecast) is active the phone volume is already 0.
  // Doing a fade-out via BackgroundTimer.setInterval is pointless and,
  // critically, Android freezes those intervals when the screen is off —
  // leaving the native player stuck in Playing state and never pausing.
  const isCasting = castState.isServerRunning && (castState.isLocalCastActive || castState.isChromecastConnected);
  const isFadeEnabled = useSettingsStore.getState().isFadeEnabled;
  if (!isFadeEnabled || isCasting) {
    bypassFade = true;
  }

  if (bypassFade) {
    clearFadeInterval();
    currentVolume = 0;
    await originalPause();
    await originalSetVolume(0);
    setIsFadingOut(false);
    try {
      if (castState.isLocalCastActive) {
        castState.setCastPlaying(false);
        const { LocalCastService } = require('./LocalCastService');
        LocalCastService.emitPause();
      }
    } catch (e) {}
    return;
  }

  if (getIsFadingOut()) {
    // Toggled back to play during fade out
    setIsFadingOut(false);
    return TrackPlayer.play();
  }

  let isPlaying = false;
  try {
    const state = await originalGetPlaybackState();
    isPlaying = state.state === State.Playing || state.state === State.Buffering;
  } catch (e) {
    console.warn("[TrackPlayerFade] Error checking playback state in pause:", e);
  }

  if (!isPlaying) {
    currentVolume = 0;
    await originalPause();
    await originalSetVolume(0);
    return;
  }

  const startVol = currentVolume;
  if (startVol <= 0.01) {
    currentVolume = 0;
    await originalPause();
    await originalSetVolume(0);
    return;
  }

  clearFadeInterval();
  setIsFadingOut(true);

  const stepVal = startVol / TOTAL_STEPS;
  let step = 0;

  fadeIntervalId = BackgroundTimer.setInterval(async () => {
    step++;
    currentVolume -= stepVal;
    
    const nextVol = Math.max(currentVolume, 0);
    currentVolume = nextVol;
    await originalSetVolume(nextVol);

    if (step >= TOTAL_STEPS || nextVol <= 0) {
      clearFadeInterval();
      await originalPause();
      currentVolume = 0;
      await originalSetVolume(0);
      setShouldStopFadingOut(true);

      // Backup safety timer
      BackgroundTimer.setTimeout(() => {
        if (getIsFadingOut()) {
          setIsFadingOut(false);
        }
      }, 1500);
    }
  }, STEP_INTERVAL);
};
