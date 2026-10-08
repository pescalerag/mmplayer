import { useEffect } from 'react';
import { AppState } from 'react-native';
import TrackPlayer, {
    Event,
    useTrackPlayerEvents
} from 'react-native-track-player';
import { usePlayerStore } from '../../store/usePlayerStore';
import { subscribeToPlaybackSnapshot } from '../../store/usePlaybackSnapshotStore';
import { subscribeToQueueSnapshot } from '../../store/useQueueSnapshotStore';
import { useCastStore } from '../../store/useCastStore';

const forwardLocalCastPlayback = async (track: any) => {
    const isRestoring = usePlayerStore.getState().isRestoring;
    const { isLocalCastActive, isCastPlaying } = useCastStore.getState();
    // Native skips preserve play intent themselves. Local cast alone needs
    // the override to forward a play command to its remote client.
    if (!isRestoring && track?.id && isLocalCastActive && isCastPlaying) {
        await TrackPlayer.play();
    }
};

const updateUserQueueSlot = (index?: number, lastIndex?: number) => {
    // Si avanzamos hacia adelante, consumimos los slots correspondientes de la user queue
    if (index !== undefined && lastIndex !== undefined && index > lastIndex) {
        const { userQueueSize } = usePlayerStore.getState();
        if (userQueueSize > 0) {
            const steps = index - lastIndex;
            const newSize = Math.max(0, userQueueSize - steps);
            usePlayerStore.setState({ userQueueSize: newSize });
        }
    }
};

let trackEventRevision = 0;

export const handleActiveTrackChangedEvent = async (event: any) => {
    const revision = ++trackEventRevision;
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

    if (revision !== trackEventRevision) return;

    // Consume manual slots immediately on a real song change, not after DB metadata.
    // Insertions before the playing entry can change its index without changing the song.
    if (!event.lastTrack?.id || event.lastTrack.id !== track?.id) {
        updateUserQueueSlot(index, lastIndex);
    }

    await Promise.all([
        forwardLocalCastPlayback(track),
        track?.id
            ? usePlayerStore.getState().setActiveTrackById(track.id, track.instanceId)
            : Promise.resolve(),
        index !== undefined
            ? usePlayerStore.getState().updateQueueStatus(index)
            : Promise.resolve(),
    ]);

    // Guardar estado en disco tras cada cambio de track
    await usePlayerStore.getState().savePlaybackState();
};

export const TrackPlayerSync = () => {
    useEffect(subscribeToPlaybackSnapshot, []);
    useEffect(subscribeToQueueSnapshot, []);
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                usePlayerStore.getState().syncWithTrackPlayer().catch(() => {});
            }
        });
        return () => subscription.remove();
    }, []);

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
