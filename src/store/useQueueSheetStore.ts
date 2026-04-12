import { create } from 'zustand';

interface QueueSheetState {
    isVisible: boolean;
    openQueue: () => void;
    closeQueue: () => void;
}

export const useQueueSheetStore = create<QueueSheetState>((set) => ({
    isVisible: false,
    openQueue: () => set({ isVisible: true }),
    closeQueue: () => set({ isVisible: false }),
}));
