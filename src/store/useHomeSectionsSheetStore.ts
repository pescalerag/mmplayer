import { create } from 'zustand';

interface HomeSectionsSheetState {
    isVisible: boolean;
    openSheet: () => void;
    closeSheet: () => void;
}

export const useHomeSectionsSheetStore = create<HomeSectionsSheetState>((set) => ({
    isVisible: false,
    openSheet: () => set({ isVisible: true }),
    closeSheet: () => set({ isVisible: false }),
}));
