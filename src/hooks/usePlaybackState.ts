import { usePlaybackState as useRNTPPlaybackState, State } from 'react-native-track-player';
import { useState, useEffect } from 'react';

let isFadingOut = false;
let shouldStopFadingOut = false;
const listeners = new Set<(fading: boolean) => void>();

export function setIsFadingOut(val: boolean) {
  if (isFadingOut !== val) {
    isFadingOut = val;
    if (!val) {
      shouldStopFadingOut = false;
    }
    listeners.forEach(listener => {
      try {
        listener(val);
      } catch (e) {
        console.error("[PlaybackStateHook] Error notifying listener:", e);
      }
    });
  }
}

export function getIsFadingOut() {
  return isFadingOut;
}

export function setShouldStopFadingOut(val: boolean) {
  shouldStopFadingOut = val;
}

export function getShouldStopFadingOut() {
  return shouldStopFadingOut;
}

export function usePlaybackState() {
  const playbackState = useRNTPPlaybackState();
  const [fading, setFading] = useState(isFadingOut);

  useEffect(() => {
    const listener = (val: boolean) => setFading(val);
    listeners.add(listener);
    if (fading !== isFadingOut) {
      setFading(isFadingOut);
    }
    return () => {
      listeners.delete(listener);
    };
  }, [fading]);

  const isNativePaused = 
    playbackState.state === State.Paused || 
    playbackState.state === State.Stopped || 
    playbackState.state === State.None || 
    playbackState.state === State.Ended;

  // Run the state update after the rendering phase in a useEffect hook
  // to avoid "Cannot update a component while rendering a different component" warnings.
  useEffect(() => {
    if (fading && shouldStopFadingOut && isNativePaused) {
      setIsFadingOut(false);
    }
  }, [fading, isNativePaused]);

  if (fading && !isNativePaused) {
    return { ...playbackState, state: State.Paused };
  }
  return playbackState;
}
