import TrackPlayer, {
    Event,
    State,
    useTrackPlayerEvents
} from 'react-native-track-player';
import { LocalCastService } from '../../services/LocalCastService';
import { useCastStore } from '../../store/useCastStore';
import { usePlayerStore } from '../../store/usePlayerStore';

// Module-level variable to track if the player was playing before a track transition.
// Since transitions (loading/buffering) are non-playing states, we preserve the last known
// active state (playing vs paused/stopped/etc.).
let wasPlayingBeforeTransition = false;

const isPlayingState = (state: any) => {
    return state === 'playing' || state === State.Playing;
};

const isPausedOrStoppedState = (state: any) => {
    return state === 'paused' || state === State.Paused ||
        state === 'stopped' || state === State.Stopped ||
        state === 'none' || state === State.None ||
        state === 'ended' || state === State.Ended;
};

const handlePlaybackStateEvent = (state: any) => {
    if (isPlayingState(state)) {
        wasPlayingBeforeTransition = true;
    } else if (isPausedOrStoppedState(state)) {
        wasPlayingBeforeTransition = false;
    }
};

const isTrackChangeIgnored = (track: any): boolean => {
    if (!track?.id) return false;
    
    const cleanEventId = track.id.split('-')[0];
    const playerState = usePlayerStore.getState();
    
    if (playerState.isQueueLoading && playerState.activeTrack) {
        const cleanActiveId = playerState.activeTrack.id.toString();
        if (cleanEventId !== cleanActiveId) {
            console.log(`[Sync] Ignorando cambio de track temporal a "${track.title}" durante carga de cola.`);
            return true;
        }
    }
    
    return false;
};

const handleCastOrLocalPlay = async (track: any) => {
    const isRestoring = usePlayerStore.getState().isRestoring;
    if (!isRestoring && track?.id) {
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

const handleActiveTrackChangedEvent = async (event: any) => {
    const { index, lastIndex, track } = event;

    if (isTrackChangeIgnored(track)) {
        return;
    }

    await handleCastOrLocalPlay(track);

    if (track?.id) {
        await usePlayerStore.getState().setActiveTrackById(track.id);
    }

    if (index !== undefined) {
        await usePlayerStore.getState().updateQueueStatus(index);
    }

    updateUserQueueSlot(index, lastIndex);

    // Guardar estado en disco tras cada cambio de track
    await usePlayerStore.getState().savePlaybackState();
};

export const TrackPlayerSync = () => {

    useTrackPlayerEvents([
        Event.PlaybackQueueEnded,
        Event.PlaybackError,
        Event.RemoteNext,
        Event.RemotePrevious,
        Event.PlaybackActiveTrackChanged,
        Event.PlaybackState,
    ], async (event) => {
        switch (event.type) {
            case Event.PlaybackState:
                handlePlaybackStateEvent(event.state);
                break;
            case Event.PlaybackActiveTrackChanged:
                await handleActiveTrackChangedEvent(event);
                break;
            case Event.PlaybackError:
                console.error('❌ [TrackPlayerSync] Error Crítico TrackPlayer:', event.message);
                break;
            case Event.RemoteNext:
            case Event.RemotePrevious:
                usePlayerStore.getState().updateQueueStatus();
                break;
            case Event.PlaybackQueueEnded:
                // Se puede remover o dejar vacío
                break;
        }
    });

    return null;
};
