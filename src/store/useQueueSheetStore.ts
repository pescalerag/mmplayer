import { create } from 'zustand';
import { useUIStore } from './useUIStore';

interface QueueSheetState {
    isVisible: boolean;
    openQueue: () => void;
    closeQueue: () => void;
}

export const useQueueSheetStore = create<QueueSheetState>((set) => ({
    isVisible: false,
    openQueue: () => {
        useUIStore.getState().openSheet('queue');
    },
    closeQueue: () => {
        useUIStore.getState().closeSheet();
    },
}));

// Sync with global UI store
useUIStore.subscribe((state) => {
    const isVisible = state.activeSheet === 'queue';
    if (useQueueSheetStore.getState().isVisible !== isVisible) {
        useQueueSheetStore.setState({ isVisible });
    }
});
