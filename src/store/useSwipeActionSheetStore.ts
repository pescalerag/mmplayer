import { create } from 'zustand';

interface SwipeActionSheetState {
    isVisible: boolean;
    currentSwipeTarget: 'left' | 'right' | null;
    openSheet: (target: 'left' | 'right') => void;
    closeSheet: () => void;
}

export const useSwipeActionSheetStore = create<SwipeActionSheetState>((set) => ({
    isVisible: false,
    currentSwipeTarget: null,
    openSheet: (target) => set({ isVisible: true, currentSwipeTarget: target }),
    closeSheet: () => set({ isVisible: false }),
}));
