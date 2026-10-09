import { create } from 'zustand';
import TrackPlayer, { Event, Track } from 'react-native-track-player';

export const useQueueSnapshotStore = create<{
    queue: Track[];
    activeIndex: number;
    ready: boolean;
}>(() => ({ queue: [], activeIndex: -1, ready: false }));

let readRevision = 0;
let pendingMutations = 0;

export function beginQueueSnapshotRead() {
    return ++readRevision;
}

export function publishNativeQueue(queue: Track[], index: number | null | undefined, revision: number) {
    if (revision !== readRevision || pendingMutations > 0) return;
    useQueueSnapshotStore.setState({ queue, activeIndex: index ?? -1, ready: true });
}

export function setQueueSnapshot(queue: Track[], activeIndex: number) {
    readRevision++;
    useQueueSnapshotStore.setState({ queue, activeIndex, ready: true });
}

export function beginQueueMutation() {
    pendingMutations++;
    readRevision++;
    let finished = false;
    return () => {
        if (finished) return false;
        finished = true;
        pendingMutations--;
        return pendingMutations === 0;
    };
}

export async function refreshQueueSnapshot() {
    if (pendingMutations > 0) return;
    const revision = beginQueueSnapshotRead();
    const [queue, index] = await Promise.all([
        TrackPlayer.getQueue(), TrackPlayer.getActiveTrackIndex(),
    ]);
    publishNativeQueue(queue, index, revision);
}

export function subscribeToQueueSnapshot() {
    const listener = TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, event => {
        if (pendingMutations > 0) return;
        const { queue } = useQueueSnapshotStore.getState();
        const trackId = event.track?.id;
        const index = trackId ? queue.findIndex(track => track.id === trackId) : -1;
        if (index >= 0) {
            // The event already identifies the playing row; don't wait for a bridge or DB read.
            setQueueSnapshot(queue, index);
        } else {
            void refreshQueueSnapshot().catch(error => console.error('[Queue] Could not refresh:', error));
        }
    });
    void refreshQueueSnapshot().catch(error => console.error('[Queue] Could not initialize:', error));
    return () => {
        readRevision++;
        listener.remove();
    };
}
