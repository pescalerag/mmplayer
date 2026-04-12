import { useEffect, useRef } from 'react';
import TrackPlayer, {
    Event,
    State,
    useTrackPlayerEvents
} from 'react-native-track-player';
import { usePlayerStore } from '../store/usePlayerStore';

/**
 * Componente que sincroniza el estado de TrackPlayer con el Store de Zustand.
 * Usa un "pulso" (setInterval) para asegurar la sincronización si los eventos fallan.
 */
export const TrackPlayerSync = () => {
    const setActiveTrackById = usePlayerStore(state => state.setActiveTrackById);
    const setIsPlaying = usePlayerStore(state => state.setIsPlaying);
    const updateQueueStatus = usePlayerStore(state => state.updateQueueStatus);
    const lastTrackId = useRef<string | null>(null);

    // Eventos de TrackPlayer para reacción inmediata
    useTrackPlayerEvents([Event.PlaybackActiveTrackChanged, Event.PlaybackState], async (event) => {
        if (event.type === Event.PlaybackActiveTrackChanged) {
            if (event.track && event.track.id !== lastTrackId.current) {
                lastTrackId.current = event.track.id;
                await setActiveTrackById(event.track.id);
            }
        }
        if (event.type === Event.PlaybackState) {
            const isPlaying = event.state === State.Playing || event.state === State.Buffering;
            setIsPlaying(isPlaying);
        }
        await updateQueueStatus();
    });

    // SISTEMA DE PULSOS (Fallback manual)
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                // Sincronizar canción activa
                const activeTrack = await TrackPlayer.getActiveTrack();
                if (activeTrack && activeTrack.id !== lastTrackId.current) {
                    lastTrackId.current = activeTrack.id;
                    await setActiveTrackById(activeTrack.id);
                } else if (!activeTrack && lastTrackId.current !== null) {
                    lastTrackId.current = null;
                    // Reset opcional del store si no hay pista
                }

                // Sincronizar estado de reproducción
                const state = await TrackPlayer.getPlaybackState();
                const isPlaying = state.state === State.Playing || state.state === State.Buffering;
                setIsPlaying(isPlaying);

                // Sincronizar estado de la cola
                await updateQueueStatus();
            } catch (error) {
                console.error('Error in TrackPlayerSync pulse:', error);
            }
        }, 1000); // Un pulso por segundo es suficiente

        return () => clearInterval(interval);
    }, [setActiveTrackById, setIsPlaying, updateQueueStatus]);

    return null; // Componente lógico, no renderiza nada
};
