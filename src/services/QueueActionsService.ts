import TrackPlayer, { Track } from 'react-native-track-player';
import { usePlayerStore } from '../store/usePlayerStore';
import {
    beginQueueMutation, refreshQueueSnapshot, setQueueSnapshot, useQueueSnapshotStore,
} from '../store/useQueueSnapshotStore';

export interface QueueRemoval {
    track: Track;
    index: number;
    isUserQueued: boolean;
    failed: boolean;
}

let commands: Promise<void> = Promise.resolve();

function replaceQueue(queue: Track[]) {
    const current = useQueueSnapshotStore.getState();
    const activeId = current.queue[current.activeIndex]?.id;
    setQueueSnapshot(queue, queue.findIndex(track => track.id === activeId));
}

function changeManualQueueSize(delta: number) {
    usePlayerStore.setState(state => ({ userQueueSize: Math.max(0, state.userQueueSize + delta) }));
}

// Serialize native edits by queue-entry identity, while publishing the UI projection immediately.
// Reconciliation and persistence run only after native edits, never before the visible response.
function enqueue(command: () => Promise<void>) {
    const finish = beginQueueMutation();
    const result = commands.then(command);
    commands = result.catch(error => console.error('[Queue] Native action failed:', error));
    void commands.then(async () => {
        if (!finish()) return;
        try {
            await refreshQueueSnapshot();
            void usePlayerStore.getState().updateQueueStatus();
            void usePlayerStore.getState().savePlaybackState();
        } catch (error) {
            console.error('[Queue] Could not reconcile:', error);
        }
    });
    return result;
}

export const QueueActionsService = {
    play(track: Track) {
        const snapshot = useQueueSnapshotStore.getState();
        const index = snapshot.queue.findIndex(item => item.id === track.id);
        if (index < 0) return Promise.resolve();
        const result = enqueue(async () => {
            const queue = await TrackPlayer.getQueue();
            const target = queue.findIndex(item => item.id === track.id);
            if (target < 0) return;
            await TrackPlayer.skip(target);
            await TrackPlayer.play();
        });
        setQueueSnapshot(snapshot.queue, index);
        return result;
    },

    remove(track: Track, isUserQueued: boolean): QueueRemoval | null {
        const snapshot = useQueueSnapshotStore.getState();
        const index = snapshot.queue.findIndex(item => item.id === track.id);
        if (index < 0 || index === snapshot.activeIndex) return null;
        const removal: QueueRemoval = { track, index, isUserQueued, failed: false };
        void enqueue(async () => {
            try {
                const queue = await TrackPlayer.getQueue();
                const target = queue.findIndex(item => item.id === track.id);
                if (target < 0) throw new Error('Queue entry no longer exists');
                await TrackPlayer.remove(target);
            } catch (error) {
                removal.failed = true;
                if (isUserQueued) changeManualQueueSize(1);
                throw error;
            }
        }).catch(() => {});
        replaceQueue(snapshot.queue.filter(item => item.id !== track.id));
        if (isUserQueued) changeManualQueueSize(-1);
        return removal;
    },

    undo(removals: QueueRemoval[]) {
        const snapshot = useQueueSnapshotStore.getState();
        const restore = [...removals].reverse().filter(item =>
            !item.failed && !snapshot.queue.some(track => track.id === item.track.id));
        if (restore.length === 0) return Promise.resolve();
        const projected = [...useQueueSnapshotStore.getState().queue];
        for (const item of restore) {
            if (projected.some(track => track.id === item.track.id)) continue;
            projected.splice(Math.min(item.index, projected.length), 0, item.track);
            if (item.isUserQueued) changeManualQueueSize(1);
        }
        const result = enqueue(async () => {
            let queue: Track[];
            try {
                queue = await TrackPlayer.getQueue();
            } catch (error) {
                changeManualQueueSize(-restore.filter(item => item.isUserQueued).length);
                throw error;
            }
            for (const item of restore) {
                if (item.failed || queue.some(track => track.id === item.track.id)) {
                    if (item.isUserQueued) changeManualQueueSize(-1);
                    continue;
                }
                const target = Math.min(item.index, queue.length);
                try {
                    await TrackPlayer.add([item.track], target);
                    queue.splice(target, 0, item.track);
                } catch (error) {
                    if (item.isUserQueued) changeManualQueueSize(-1);
                    console.error('[Queue] Could not restore entry:', error);
                }
            }
        });
        replaceQueue(projected);
        return result;
    },

    move(track: Track, before: Track | undefined) {
        const snapshot = useQueueSnapshotStore.getState();
        const from = snapshot.queue.findIndex(item => item.id === track.id);
        if (from <= snapshot.activeIndex) return Promise.resolve();
        const projectedQueue = snapshot.queue.filter(item => item.id !== track.id);
        const beforeIndex = before ? projectedQueue.findIndex(item => item.id === before.id) : -1;
        const to = beforeIndex < 0 ? projectedQueue.length : beforeIndex;
        // A drag may finish after playback advanced; preserve the latest playing prefix.
        if (to <= snapshot.activeIndex) return Promise.resolve();
        projectedQueue.splice(to, 0, snapshot.queue[from]);
        const result = enqueue(async () => {
            const [queue, activeIndex] = await Promise.all([
                TrackPlayer.getQueue(), TrackPlayer.getActiveTrackIndex(),
            ]);
            const from = queue.findIndex(item => item.id === track.id);
            if (from < 0 || from <= (activeIndex ?? -1)) return;
            const remaining = queue.filter(item => item.id !== track.id);
            const beforeIndex = before ? remaining.findIndex(item => item.id === before.id) : -1;
            const to = beforeIndex < 0 ? remaining.length : beforeIndex;
            if (to > (activeIndex ?? -1) && from !== to) await TrackPlayer.move(from, to);
        });
        replaceQueue(projectedQueue);
        return result;
    },

    clear(kind: 'manual' | 'context') {
        const snapshot = useQueueSnapshotStore.getState();
        const shouldRemove = (track: Track, index: number, activeIndex: number) =>
            index > activeIndex && (kind === 'manual' ? track.isManual === true : !track.isManual);
        const removed = snapshot.queue.filter((track, index) => shouldRemove(track, index, snapshot.activeIndex));
        const manualCount = kind === 'manual' ? removed.length : 0;
        const result = enqueue(async () => {
            try {
                if (kind === 'context') await usePlayerStore.getState().cancelQueueLoading();
                const [queue, index] = await Promise.all([TrackPlayer.getQueue(), TrackPlayer.getActiveTrackIndex()]);
                if (index == null) return;
                const indices = queue.flatMap((track, position) => shouldRemove(track, position, index) ? [position] : []);
                if (indices.length) await TrackPlayer.remove(indices);
            } catch (error) {
                changeManualQueueSize(manualCount);
                throw error;
            }
        });
        replaceQueue(snapshot.queue.filter((track, index) => !shouldRemove(track, index, snapshot.activeIndex)));
        changeManualQueueSize(-manualCount);
        return result;
    },

    stop() {
        const result = enqueue(() => usePlayerStore.getState().clearPlayer());
        setQueueSnapshot([], -1);
        return result;
    },
};
