const enabled = process.env.EXPO_PUBLIC_PROFILE_PLAYBACK === '1';
let requestId = 0;

/** Opt-in release diagnostics. No song names, file paths or database IDs. */
export function startPlaybackTiming(operation: string): (phase: string) => void {
    if (!enabled) return () => {};
    const id = ++requestId;
    const start = performance.now();
    return phase => console.log(`[PlaybackTiming] ${operation}#${id} ${phase} +${Math.round(performance.now() - start)}ms`);
}
