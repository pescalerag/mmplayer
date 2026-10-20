import { readPlaybackSnapshot } from './playbackSnapshot';
import { CrossfadeService } from './CrossfadeService';
import TrackPlayer from 'react-native-track-player';
import { createMMKV } from 'react-native-mmkv';
import Track from '../database/models/Track';
import { mapToTPTrack, usePlayerStore } from '../store/usePlayerStore';
import { useCastStore } from '../store/useCastStore';
import { getQueueSession, QueueSession, resetAllQueueSlots, useMultipleQueuesStore } from '../store/useMultipleQueuesStore';
import { PlaybackTimeTracker, syncWidgetState } from './PlaybackService';
import { QueueActionsService } from './QueueActionsService';
import { beginQueueMutation, setQueueSnapshot } from '../store/useQueueSnapshotStore';
import { refreshPlaybackSnapshot } from '../store/usePlaybackSnapshotStore';
import { useABRepeatStore } from '../store/useABRepeatStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { PlaybackListenService } from './PlaybackListenService';
import { useUIStore } from '../store/useUIStore';
import { useToastStore } from '../store/useToastStore';

const storage = createMMKV();
function checkQueueChangeAllowed() {
    const state = useMultipleQueuesStore.getState();
    if (state.isSwitching || state.pendingEdits) throw new Error('Queue unavailable');
    if (usePlayerStore.getState().isQueueLoading) throw new Error('Queue is still loading');
    if (useCastStore.getState().isLocalCastActive || useCastStore.getState().isServerRunning) throw new Error('Queue switching is disabled during Local Cast');
}
async function beginQueueChange() {
    checkQueueChangeAllowed();
    await QueueActionsService.waitForPendingActions();
    await usePlayerStore.getState().cancelQueueLoading();
    checkQueueChangeAllowed();
    const state = useMultipleQueuesStore.getState();
    useMultipleQueuesStore.setState({ isSwitching: true });
    try { await CrossfadeService.flush(); }
    catch (error) { useMultipleQueuesStore.setState({ isSwitching: false }); throw error; }
    return state;
}
async function capture(): Promise<QueueSession> {
    const player = usePlayerStore.getState();
    const { queue, index, progress, repeatMode } = await readPlaybackSnapshot();
    const activeIndex = index ?? 0;
    return { queue, index: activeIndex, position: progress.position,
        accumulatedTime: queue[activeIndex]?.id ? PlaybackTimeTracker.getAccumulatedSeconds(queue[activeIndex].id.toString()) : 0,
        userQueueSize: player.userQueueSize, playbackContext: player.playbackContext,
        isShuffleEnabled: player.isShuffleEnabled, shuffleOriginalQueue: player.shuffleOriginalQueue,
        repeatMode, playbackSpeed: player.playbackSpeed, playbackPitch: player.playbackPitch, isVinylModeEnabled: player.isVinylModeEnabled };
}
async function install(session: QueueSession | null, shuffleOnQueueEnd: boolean): Promise<QueueSession | null> {
    let installed: QueueSession | null = null;
    if (!session?.queue.length) {
        await TrackPlayer.reset();
        await TrackPlayer.setRepeatMode(0);
        usePlayerStore.setState({ activeTrack: null, activeTrackInstanceId: null, prevTrack: null, nextTrack: null, hasNext: false, hasPrevious: false,
            userQueueSize: 0, playbackContext: null, isShuffleEnabled: false, shuffleOriginalQueue: [] });
    } else {
        const player = usePlayerStore.getState();
        const globalSettings = { playbackSpeed: player.playbackSpeed, playbackPitch: player.playbackPitch, isVinylModeEnabled: player.isVinylModeEnabled };
        installed = { ...session, ...globalSettings };
        await usePlayerStore.getState().restorePlaybackState(installed, shuffleOnQueueEnd);
        const track = await TrackPlayer.getActiveTrack();
        if (track?.id !== session.queue[session.index]?.id) throw new Error('Queue restoration failed');
    }
    useABRepeatStore.getState().clearAB();
    await refreshPlaybackSnapshot();
    return installed;
}

function persistInstalledSession(session: QueueSession | null) {
    if (session) {
        storage.set('@player_persistence', JSON.stringify(session));
        storage.set('@player_position', session.position);
        storage.set('@player_accumulated', session.accumulatedTime);
    } else {
        storage.remove('@player_persistence'); storage.remove('@player_position'); storage.remove('@player_accumulated');
    }
}

async function finishQueueListens(sessions: (QueueSession | null)[]) {
    const listens = new Map<string, number>();
    for (const session of sessions) {
        const id = session?.queue[session.index]?.id?.toString();
        if (id && !id.startsWith('ext_') && session && session.accumulatedTime > 0) listens.set(id, session.accumulatedTime);
    }
    const results = await Promise.allSettled([...listens].map(([id, seconds]) => PlaybackListenService.save(id, seconds, true)));
    results.forEach(result => { if (result.status === 'rejected') console.error('Error finalizing queue listen:', result.reason); });
}

export const MultipleQueuesService = {
    async resetAllQueues(): Promise<void> {
        const state = await beginQueueChange();
        let previous: QueueSession | null = null;
        let installed: QueueSession | null | undefined;
        let finishMutation: (() => boolean) | undefined;
        let sessionsToFinish: (QueueSession | null)[] | undefined;
        try {
            PlaybackTimeTracker.onStateNotPlaying();
            await (TrackPlayer.pause as (bypassFade?: boolean) => Promise<void>)(true);
            previous = await capture();
            const sessions = state.slots.map(slot => slot.id === state.activeId ? previous : getQueueSession(slot.id));
            finishMutation = beginQueueMutation();
            installed = await install(null, false);
            persistInstalledSession(null);
            resetAllQueueSlots();
            PlaybackTimeTracker.reset();
            usePlayerStore.setState(player => ({ queueVersion: player.queueVersion + 1, windowVersion: player.windowVersion + 1 }));
            useToastStore.getState().hideToast();
            useUIStore.getState().closeSheet();
            sessionsToFinish = sessions;
        } catch (error) {
            if (previous) {
                try {
                    installed = await install(previous, state.slots[state.activeId].shuffleOnQueueEnd ?? false);
                    persistInstalledSession(installed);
                    state.saveSession(state.activeId, installed);
                } catch { /* Preserve the original reset error. */ }
            }
            throw error;
        } finally {
            finishMutation?.();
            if (installed !== undefined) setQueueSnapshot(installed?.queue ?? [], installed?.index ?? -1);
            useMultipleQueuesStore.setState({ isSwitching: false });
            void syncWidgetState();
        }
        // History uses captured counters and must not keep the empty player route locked.
        if (sessionsToFinish) await finishQueueListens(sessionsToFinish);
    },
    async switchQueue(id: number): Promise<void> {
        const current = useMultipleQueuesStore.getState();
        if (id === current.activeId) return;
        if (!current.slots[id]) throw new Error('Queue unavailable');
        const state = await beginQueueChange();
        if (id === state.activeId) { useMultipleQueuesStore.setState({ isSwitching: false }); return; }
        const previousId = state.activeId;
        let previous: QueueSession | null = null;
        let installed: QueueSession | null | undefined;
        let finishMutation: (() => boolean) | undefined;
        try {
            PlaybackTimeTracker.onStateNotPlaying();
            await (TrackPlayer.pause as (bypassFade?: boolean) => Promise<void>)(true);
            previous = await capture();
            state.saveSession(previousId, previous);
            const next = getQueueSession(id);
            finishMutation = beginQueueMutation();
            installed = await install(next, state.slots[id].shuffleOnQueueEnd ?? false);
            persistInstalledSession(installed);
            state.saveSession(id, installed);
            state.select(id);
            usePlayerStore.setState(player => ({ queueVersion: player.queueVersion + 1, windowVersion: player.windowVersion + 1 }));
        } catch (error) {
            if (previous) {
                try {
                    installed = await install(previous, state.slots[previousId].shuffleOnQueueEnd ?? false);
                    persistInstalledSession(installed);
                } catch { /* Preserve the original restoration error. */ }
            }
            throw error;
        } finally {
            finishMutation?.();
            if (installed !== undefined) setQueueSnapshot(installed?.queue ?? [], installed?.index ?? -1);
            useMultipleQueuesStore.setState({ isSwitching: false });
            // Widget artwork must not hold the queue selector disabled while Android loads it.
            void syncWidgetState();
        }
    },
    async addToQueue(id: number, tracks: Track[]): Promise<void> {
        if (!tracks.length) return;
        const state = useMultipleQueuesStore.getState();
        if (!state.slots[id] || state.isSwitching) throw new Error('Queue unavailable');
        if (id === state.activeId) { await usePlayerStore.getState().addMultipleToQueueEnd(tracks); return; }
        const items = await Promise.all(tracks.map(track => mapToTPTrack(track)));
        if (useMultipleQueuesStore.getState().isSwitching) throw new Error('Queue unavailable');
        if (useMultipleQueuesStore.getState().activeId === id) {
            await usePlayerStore.getState().addMultipleToQueueEnd(tracks); return;
        }
        items.forEach(item => { (item as any).isManual = true; });
        const session = getQueueSession(id);
        if (!session?.queue.length) {
            const player = usePlayerStore.getState();
            state.saveSession(id, { queue: items, index: 0, position: 0, accumulatedTime: 0, userQueueSize: Math.max(0, items.length - 1),
                playbackContext: null, isShuffleEnabled: false, shuffleOriginalQueue: [], repeatMode: 0,
                playbackSpeed: player.playbackSpeed, playbackPitch: player.playbackPitch, isVinylModeEnabled: player.isVinylModeEnabled });
        } else {
            const queue = [...session.queue];
            const addToManual = useSettingsStore.getState().queueAddBehavior === 'user_queue';
            const insertAt = addToManual ? session.index + 1 + session.userQueueSize : queue.length;
            queue.splice(insertAt, 0, ...items);
            state.saveSession(id, { ...session, queue, userQueueSize: session.userQueueSize + (addToManual ? items.length : 0) });
        }
    },
};
