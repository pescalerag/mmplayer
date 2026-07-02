import { create } from 'zustand';

interface PlayerMenuStore {
    isVisible: boolean;
    openSheet: () => void;
    closeSheet: () => void;
}

export const usePlayerMenuStore = create<PlayerMenuStore>((set) => ({
    isVisible: false,
    openSheet: () => set({ isVisible: true }),
    closeSheet: () => set({ isVisible: false }),
}));
