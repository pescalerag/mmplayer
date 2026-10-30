import { useEffect } from 'react';
import TrackPlayer, {
    Event,
    useTrackPlayerEvents
} from 'react-native-track-player';
import { consumeUserQueueTransition, usePlayerStore } from '../../store/usePlayerStore';
import { subscribeToPlaybackSnapshot } from '../../store/usePlaybackSnapshotStore';
import { subscribeToQueueSnapshot } from '../../store/useQueueSnapshotStore';
import { useMultipleQueuesStore } from '../../store/useMultipleQueuesStore';

const resumeTrackPlayback = async (track: any) => {
    const isRestoring = usePlayerStore.getState().isRestoring;
    // Restore v2.3.2: moving to another song starts playback even from pause.
    // Restoration itself still respects the saved paused state.
    if (!isRestoring && !usePlayerStore.getState().isPreparingExternal && !useMultipleQueuesStore.getState().isSwitching && track?.id) {
        await TrackPlayer.play();
    }
};

let trackEventRevision = 0;

export const handleActiveTrackChangedEvent = async (event: any) => {
    const player = usePlayerStore.getState();
    // Explicit queue replacement/restoration publishes its final model once.
    // Ignore intermediate clear/add/seek events rather than auto-playing them.
    if (player.isPreparingQueue || player.isRestoring || useMultipleQueuesStore.getState().isSwitching) return;
    const revision = ++trackEventRevision;
    const queueAtEvent = useMultipleQueuesStore.getState().activeId;
    const isCurrent = () => revision === trackEventRevision && !useMultipleQueuesStore.getState().isSwitching
        && useMultipleQueuesStore.getState().activeId === queueAtEvent;
    if (!isCurrent()) return;
    let { index, lastIndex, track } = event;

    if (!track?.id) {
        try {
            track = await TrackPlayer.getActiveTrack();
            if (!track?.id && index !== undefined && index !== null) {
                const queue = await TrackPlayer.getQueue();
                track = queue[index] ?? null;
            }
        } catch {}
    }

    if (!isCurrent()) return;

    // Consume manual slots immediately on a real song change, not after DB metadata.
    // Insertions before the playing entry can change its index without changing the song.
    if (!event.lastTrack?.id || event.lastTrack.id !== track?.id) {
        consumeUserQueueTransition({ ...event, track, index, lastIndex });
    }

    await Promise.all([
        event.crossfade ? Promise.resolve() : resumeTrackPlayback(track),
        track?.id
            ? usePlayerStore.getState().setActiveTrackById(track.id, track.instanceId)
            : Promise.resolve(),
        index !== undefined
            ? usePlayerStore.getState().updateQueueStatus(index)
            : Promise.resolve(),
    ]);

    // Guardar estado en disco tras cada cambio de track
    if (!isCurrent()) return;
    await usePlayerStore.getState().savePlaybackState();
};

export const TrackPlayerSync = () => {
    useEffect(subscribeToPlaybackSnapshot, []);
    useEffect(subscribeToQueueSnapshot, []);
    // AppLifecycleService owns foreground restoration. A second listener here
    // duplicated native/DB reads and invalidated the first restoration request.

    useTrackPlayerEvents([
        Event.PlaybackQueueEnded,
        Event.PlaybackError,
        Event.RemoteNext,
        Event.RemotePrevious,
        Event.PlaybackActiveTrackChanged,
    ], async (event) => {
        switch (event.type) {
            case Event.PlaybackActiveTrackChanged:
                await handleActiveTrackChangedEvent(event);
                break;
            case Event.PlaybackError:
                // Retain native playback failures even when a retry later succeeds.
                require('../../services/AppErrorService').AppErrorService.record('TrackPlayer', event);
                console.error('❌ [TrackPlayerSync] Error Crítico TrackPlayer:', event.message);
                try {
                    await (TrackPlayer as any).retry();
                } catch (retryErr) {
                    console.error('❌ [TrackPlayerSync] Falló retry tras error de TrackPlayer:', retryErr);
                }
                break;
            case Event.RemoteNext:
            case Event.RemotePrevious:
                usePlayerStore.getState().updateQueueStatus();
                break;
            case Event.PlaybackQueueEnded:
                await usePlayerStore.getState().playRandomQueueOnEnd();
                break;
        }
    });

    return null;
};
