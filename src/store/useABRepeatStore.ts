import { create } from 'zustand';
import TrackPlayer from 'react-native-track-player';
import * as Haptics from 'expo-haptics';
import { useToastStore } from './useToastStore';
import { useCastStore } from './useCastStore';
import i18n from '../constants/i18n';

interface ABRepeatState {
    pointA: number | null;
    pointB: number | null;
    setPointA: (time: number) => void;
    setPointB: (time: number) => void;
    clearAB: () => void;
    handleButtonPress: (currentPosition: number) => void;
    handleLongPress: () => void;
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
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            useToastStore.getState().showToast(i18n.t('toasts.ab_point_a_set'), "flag-outline");
        } else if (pointB === null) {
            if (currentPosition > pointA) {
                set({ pointB: currentPosition });
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                useToastStore.getState().showToast(i18n.t('toasts.ab_point_b_set'), "repeat");
            } else {
                set({ pointA: currentPosition });
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                useToastStore.getState().showToast(i18n.t('toasts.ab_point_a_updated'), "flag-outline");
            }
        } else {
            set({ pointA: null, pointB: null });
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            useToastStore.getState().showToast(i18n.t('toasts.ab_deactivated'), "close-outline");
        }
    },
    handleLongPress: () => {
        const { pointA, pointB } = get();
        if (pointA !== null || pointB !== null) {
            set({ pointA: null, pointB: null });
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            useToastStore.getState().showToast(i18n.t('toasts.ab_deactivated'), "close-outline");
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
