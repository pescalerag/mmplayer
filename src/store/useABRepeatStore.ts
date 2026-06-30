import { create } from 'zustand';
import TrackPlayer from 'react-native-track-player';
import { useToastStore } from './useToastStore';
import { useCastStore } from './useCastStore';

interface ABRepeatState {
    pointA: number | null;
    pointB: number | null;
    setPointA: (time: number) => void;
    setPointB: (time: number) => void;
    clearAB: () => void;
    handleButtonPress: (currentPosition: number) => void;
    checkLoop: (currentPosition: number) => Promise<number | null>; // Returns seek position if seeked
}

export const useABRepeatStore = create<ABRepeatState>((set, get) => ({
    pointA: null,
    pointB: null,
    setPointA: (time) => set({ pointA: time }),
    setPointB: (time) => set({ pointB: time }),
    clearAB: () => set({ pointA: null, pointB: null }),
    handleButtonPress: (currentPosition) => {
        const { pointA, pointB } = get();
        if (pointA === null) {
            set({ pointA: currentPosition });
            useToastStore.getState().showToast("Punto A fijado", "flag-outline");
        } else if (pointB === null) {
            if (currentPosition > pointA) {
                set({ pointB: currentPosition });
                useToastStore.getState().showToast("Punto B fijado. Bucle activado", "repeat");
            } else {
                set({ pointA: currentPosition });
                useToastStore.getState().showToast("Punto A actualizado", "flag-outline");
            }
        } else {
            set({ pointA: null, pointB: null });
            useToastStore.getState().showToast("Bucle A-B desactivado", "close-outline");
        }
    },
    checkLoop: async (currentPosition) => {
        // Evitar bucles A-B si Cast está activo
        if (useCastStore.getState().isServerRunning) {
            return null;
        }
        const { pointA, pointB } = get();
        if (pointA !== null && pointB !== null && pointA < pointB) {
            // Si se supera el punto B o se retrocede antes del punto A (con margen de 0.5s de tolerancia)
            if (currentPosition >= pointB || currentPosition < pointA - 0.5) {
                try {
                    await TrackPlayer.seekTo(pointA);
                    return pointA;
                } catch (err) {
                    console.error("Error seeking to point A in loop:", err);
                }
            }
        }
        return null;
    }
}));
