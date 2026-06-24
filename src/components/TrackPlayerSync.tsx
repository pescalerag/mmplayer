import { 
    Event, 
    useTrackPlayerEvents,
    default as TrackPlayer,
    State
} from 'react-native-track-player';
import { usePlayerStore } from '../store/usePlayerStore';
import { useCastStore } from '../store/useCastStore';
import { LocalCastService } from '../services/LocalCastService';

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

export const TrackPlayerSync = () => {

    useTrackPlayerEvents([
        Event.PlaybackQueueEnded,
        Event.PlaybackError,
        Event.RemoteNext,
        Event.RemotePrevious,
        Event.PlaybackActiveTrackChanged,
        Event.PlaybackState,
    ], async (event) => {

        if (event.type === Event.PlaybackState) {
            const state = event.state;
            if (isPlayingState(state)) {
                wasPlayingBeforeTransition = true;
            } else if (isPausedOrStoppedState(state)) {
                wasPlayingBeforeTransition = false;
            }
        }

        if (event.type === Event.PlaybackActiveTrackChanged) {
            const { index, lastIndex, track } = event;

            // Evitar procesar eventos de cambio de track temporales causados por la inserción
            // en segundo plano de las pistas previas al inicio de la cola.
            if (track?.id) {
                const cleanEventId = track.id.split('-')[0];
                const playerState = usePlayerStore.getState();
                if (playerState.isQueueLoading && playerState.activeTrack) {
                    const cleanActiveId = playerState.activeTrack.id.toString();
                    if (cleanEventId !== cleanActiveId) {
                        console.log(`[Sync] Ignorando cambio de track temporal a "${track.title}" durante carga de cola.`);
                        return;
                    }
                }
            }
            
            if (useCastStore.getState().isServerRunning) {
                const playState = await TrackPlayer.getPlaybackState();
                const playWhenReady = await TrackPlayer.getPlayWhenReady().catch(() => false);
                const shouldPlay = isPlayingState(playState.state) || wasPlayingBeforeTransition || playWhenReady;
                
                if (shouldPlay) {
                    LocalCastService.setPlayIntent(true);
                }
                await TrackPlayer.pause();
            } else {
                const isRestoring = usePlayerStore.getState().isRestoring;
                if (!isRestoring && track?.id) {
                    await TrackPlayer.play();
                }
            }

            if (track?.id) {
                await usePlayerStore.getState().setActiveTrackById(track.id);
            }
            
            if (index !== undefined) {
                await usePlayerStore.getState().updateQueueStatus(index);
            }

            // Si avanzamos hacia adelante, consumimos un slot de la user queue
            if (
                index !== undefined &&
                lastIndex !== undefined &&
                index > lastIndex
            ) {
                const { userQueueSize, decrementUserQueue } = usePlayerStore.getState();
                if (userQueueSize > 0) {
                    decrementUserQueue();
                }
            }

            // Guardar estado en disco tras cada cambio de track
            await usePlayerStore.getState().savePlaybackState();
        }

        if (event.type === Event.PlaybackQueueEnded) {
            // Se puede remover o dejar vacío
        }
        
        if (event.type === Event.PlaybackError) {
            console.error('❌ [TrackPlayerSync] Error Crítico TrackPlayer:', event.message);
        }

        if (event.type === Event.RemoteNext || event.type === Event.RemotePrevious) {
             usePlayerStore.getState().updateQueueStatus();
        }
    });

    return null;
};
