import { useEffect } from 'react';
import TrackPlayer, { 
    State, 
    Event, 
    useTrackPlayerEvents 
} from 'react-native-track-player';
import { usePlayerStore } from '../store/usePlayerStore';

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
            // Se puede mantener vacío o remover la lógica si no hace nada más, pero como declara variables sin uso, podemos removerlo o dejar la lógica de asignación si es necesaria. Sin embargo, no hace nada más en este bloque, por lo que podemos eliminarlo por completo.
        }

        if (event.type === Event.PlaybackActiveTrackChanged) {
            const { index, lastIndex, track } = event;
            
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
