import { create } from 'zustand';
import * as Haptics from 'expo-haptics';
import { useToastStore } from './useToastStore';
import { useCastStore } from './useCastStore';
import i18n from '../constants/i18n';
import { useTimestampStore } from './useTimestampStore';
import { evaluateABButtonPress, shouldTriggerABLoop } from '../utils/trackTimestamps';
import { TimestampService } from '../services/TimestampService';

export interface ABRepeatState {
    pointA: number | null;
    pointB: number | null;
    setPointA: (time: number | null) => void;
    setPointB: (time: number | null) => void;
    clearAB: () => void;
    reset: () => void;
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
    reset: () => set({ pointA: null, pointB: null }),
    handleButtonPress: (currentPosition) => {
        const { pointA, pointB } = get();
        const action = evaluateABButtonPress(pointA, pointB, currentPosition, useTimestampStore.getState().config);
        if (action.type === 'reject_b_muted') {
            useToastStore.getState().showToast(i18n.t(action.toastKey), action.toastIcon);
            return;
        }
        set({ pointA: action.pointA, pointB: action.pointB });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        useToastStore.getState().showToast(i18n.t(action.toastKey), action.toastIcon);
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
        const timestamps = useTimestampStore.getState();
        if (timestamps.trackId && timestamps.previewTrackId === timestamps.trackId) return null;
        // Evitar bucles A-B si Cast está activo
        if (useCastStore.getState().isServerRunning) {
            return null;
        }
        const { pointA, pointB } = get();
        if (pointA !== null && pointB !== null && pointA < pointB) {
            if (TimestampService.nativeHandlesAB()) return null;
            const target = shouldTriggerABLoop(currentPosition, pointA, pointB);
            if (target !== null) {
                try {
                    await TimestampService.seekAutomatically(target);
                    return target;
                } catch (err) {
                    console.error("Error seeking to point A in loop:", err);
                }
            }
        }
        return null;
    }
}));
