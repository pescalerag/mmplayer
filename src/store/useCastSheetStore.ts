import { create } from 'zustand';

interface CastSheetState {
    isVisible: boolean;
    openSheet: () => void;
    closeSheet: () => void;
}

export const useCastSheetStore = create<CastSheetState>((set) => ({
    isVisible: false,
    openSheet: () => set({ isVisible: true }),
    closeSheet: () => set({ isVisible: false }),
}));
