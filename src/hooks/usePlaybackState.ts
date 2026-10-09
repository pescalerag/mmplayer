import { usePlaybackState as useRNTPPlaybackState, State } from 'react-native-track-player';
import { useState, useEffect } from 'react';
import { useCastStore } from '../store/useCastStore';

let isFadingOut = false;
let fadeOutTimeout: any = null;
const listeners = new Set<(fading: boolean) => void>();

export function setIsFadingOut(val: boolean) {
  if (fadeOutTimeout) {
    clearTimeout(fadeOutTimeout);
    fadeOutTimeout = null;
  }

  if (isFadingOut !== val) {
    isFadingOut = val;
    listeners.forEach(listener => {
      try {
        listener(val);
      } catch (e) {
        console.error("[PlaybackStateHook] Error notifying listener:", e);
      }
    });
  }

  if (val) {
    // Safety fallback: a fade-out can NEVER legitimately last more than 1500ms.
    // If anything fails to call setIsFadingOut(false), automatically reset it.
    fadeOutTimeout = setTimeout(() => {
      if (isFadingOut) {
        setIsFadingOut(false);
      }
    }, 1500);
  }
}

export function getIsFadingOut() {
  return isFadingOut;
}

export function setShouldStopFadingOut(_val: boolean) {}
export function getShouldStopFadingOut() { return false; }

export function usePlaybackState() {
  const isLocalCastActive = useCastStore(state => state.isLocalCastActive);
  const isCastPlaying = useCastStore(state => state.isCastPlaying);
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
  }, []);

  const isNativePaused = 
    playbackState.state !== State.Playing && 
    playbackState.state !== State.Buffering;

  // If native playback is paused, fading must be reset to false immediately
  useEffect(() => {
    if ((fading || isFadingOut) && isNativePaused) {
      setIsFadingOut(false);
    }
  }, [fading, isNativePaused]);

  if (isLocalCastActive) {
    return { state: isCastPlaying ? State.Playing : State.Paused };
  }

  if (fading && !isNativePaused) {
    return { ...playbackState, state: State.Paused };
  }
  return playbackState;
}
