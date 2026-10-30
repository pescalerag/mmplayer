import { Platform } from 'react-native';
import TrackPlayer from 'react-native-track-player';
import { getNativePlaybackSnapshot } from '../../modules/native-equalizer';
import { useCastStore } from '../store/useCastStore';

export async function tryReadNativePlaybackSnapshot() {
    if (Platform.OS === 'android' && !useCastStore.getState().isServerRunning && typeof getNativePlaybackSnapshot === 'function') {
        const snapshot = await getNativePlaybackSnapshot();
        return snapshot;
    }
    return null;
}

/** Identity, queue and position must belong to the same native transition. */
export async function readPlaybackSnapshot() {
    const snapshot = await tryReadNativePlaybackSnapshot();
    if (snapshot) return snapshot;
    const [queue, index, progress, repeatMode] = await Promise.all([
        TrackPlayer.getQueue(), TrackPlayer.getActiveTrackIndex(), TrackPlayer.getProgress(), TrackPlayer.getRepeatMode(),
    ]);
    return { queue, index: index ?? 0, progress, repeatMode, queueRevision: undefined, userQueueSize: undefined };
}
