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

let fadeIntervalId: any = null;
let targetVolume = 1.0;
let currentVolume = 1.0;

function clearFadeInterval() {
  if (fadeIntervalId !== null) {
    BackgroundTimer.clearInterval(fadeIntervalId);
    fadeIntervalId = null;
  }
}

// Override getPlaybackState
TrackPlayer.getPlaybackState = async () => {
  const originalState = await originalGetPlaybackState();
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
  clearFadeInterval();
  setIsFadingOut(false);
  targetVolume = volume;

  let isPlaying = false;
  try {
    const state = await originalGetPlaybackState();
    isPlaying = state.state === State.Playing || state.state === State.Buffering;
  } catch (e) {
    console.warn("[TrackPlayerFade] Error checking playback state in setVolume:", e);
  }

  if (isPlaying) {
    currentVolume = volume;
    return originalSetVolume(volume);
  } else {
    currentVolume = 0;
    return originalSetVolume(0);
  }
};

// Override getVolume - returns the logical volume (targetVolume)
TrackPlayer.getVolume = async () => {
  return targetVolume;
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
  const isFadeEnabled = useSettingsStore.getState().isFadeEnabled;
  if (!isFadeEnabled) {
    bypassFade = true;
  }

  if (bypassFade) {
    clearFadeInterval();
    currentVolume = 0;
    await originalPause();
    await originalSetVolume(0);
    setIsFadingOut(false);
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
