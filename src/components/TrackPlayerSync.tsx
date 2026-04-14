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
        console.log(`📢 [TrackPlayerSync] Evento RNTP puro recibido: ${event.type}`, event);

        if (event.type === Event.PlaybackState) {
            const estado = event.state;
            const isPlaying = estado === State.Playing || estado === State.Buffering;
            console.log(`▶️ [TrackPlayerSync] Estado crudo: ${estado} -> ¿isPlaying?: ${isPlaying}`);
            usePlayerStore.getState().setIsPlaying(isPlaying);
        }

        if (event.type === Event.PlaybackActiveTrackChanged) {
            const { index, track } = event;
            
            if (track?.id) {
                console.log('🔄 [TrackPlayerSync] Track cambió:', track.id);
                await usePlayerStore.getState().setActiveTrackById(track.id);
            }
            
            if (index !== undefined) {
                await usePlayerStore.getState().updateQueueStatus(index);
            }
        }

        if (event.type === Event.PlaybackQueueEnded) {
            console.log('🏁 [TrackPlayerSync] Cola terminada. Reseteando Play en Zustand.');
            usePlayerStore.getState().setIsPlaying(false);
        }
        
        if (event.type === Event.PlaybackError) {
            console.error('❌ [TrackPlayerSync] Error Crítico TrackPlayer:', event.message);
        }

        if (event.type === Event.RemoteNext || event.type === Event.RemotePrevious) {
             console.log(`[TrackPlayerSync] Control remoto detectado: ${event.type}. Forzando actualización de la cola.`);
             usePlayerStore.getState().updateQueueStatus();
        }
    });

    return null;
};
