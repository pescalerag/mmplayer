import { create } from 'zustand';

interface AppTabsOrderSheetState {
    isVisible: boolean;
    openSheet: () => void;
    closeSheet: () => void;
}

export const useAppTabsOrderSheetStore = create<AppTabsOrderSheetState>((set) => ({
    isVisible: false,
    openSheet: () => set({ isVisible: true }),
    closeSheet: () => set({ isVisible: false }),
}));
