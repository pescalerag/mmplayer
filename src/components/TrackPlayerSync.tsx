import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import TrackPlayer, { State } from "react-native-track-player";
import { usePlayerStore } from "../store/usePlayerStore";

export const TrackPlayerSync = () => {
  const lastIndexRef = useRef<number | null>(null);
  const lastStateRef = useRef<string | null>(null);

  useEffect(() => {
    console.log('🎧 Iniciando "Smart Pulse" con Dynamic Polling...');

    let intervalId: any;

    const runTick = async () => {
      try {
        // 1. Consultas ultraligeras al motor nativo
        const stateObj = await TrackPlayer.getPlaybackState();
        const currentState = stateObj.state || stateObj; // Compatibilidad con la v4
        const currentIndex = await TrackPlayer.getActiveTrackIndex();

        // 2. ¿Ha cambiado el estado de Play/Pause?
        if (currentState !== lastStateRef.current) {
          lastStateRef.current = currentState as string;
          const isPlaying =
            currentState === State.Playing || currentState === State.Buffering;
          usePlayerStore.getState().setIsPlaying(isPlaying);
        }

        // 3. ¿Ha cambiado la canción activa?
        if (
          currentIndex !== undefined &&
          currentIndex !== null &&
          currentIndex !== lastIndexRef.current
        ) {
          lastIndexRef.current = currentIndex;

          const nativeTrack = await TrackPlayer.getTrack(currentIndex);
          if (nativeTrack?.id) {
            await usePlayerStore.getState().setActiveTrackById(nativeTrack.id);
          }

          // Actualizamos Anterior/Siguiente enviando el nuevo índice
          await usePlayerStore.getState().updateQueueStatus(currentIndex);
        }
      } catch (error) {
        // Silenciamos errores durante la inicialización
      }
    };

    const startPulse = (ms: number) => {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(runTick, ms);
    };

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const isAppActive = nextAppState === "active";
      const intervalMs = isAppActive ? 400 : 2000;

      console.log(`📱 AppState: ${nextAppState} | Pulse: ${intervalMs}ms`);
      startPulse(intervalMs);
    };

    // Escuchamos cambios de estado (Background/Foreground)
    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    // Inicio inicial basado en el estado actual
    const currentMs = AppState.currentState === "active" ? 400 : 2000;
    startPulse(currentMs);

    return () => {
      if (intervalId) clearInterval(intervalId);
      subscription.remove();
    };
  }, []);

  return null;
};
