import { create } from 'zustand';

interface LibraryTabsOrderSheetState {
    isVisible: boolean;
    openSheet: () => void;
    closeSheet: () => void;
}

export const useLibraryTabsOrderSheetStore = create<LibraryTabsOrderSheetState>((set) => ({
    isVisible: false,
    openSheet: () => set({ isVisible: true }),
    closeSheet: () => set({ isVisible: false }),
}));
