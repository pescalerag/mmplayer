import { create } from 'zustand';
import { useUIStore } from './useUIStore';

interface CastSheetState {
    isVisible: boolean;
    openSheet: () => void;
    closeSheet: () => void;
}

export const useCastSheetStore = create<CastSheetState>((set) => ({
    isVisible: false,
    openSheet: () => {
        useUIStore.getState().openSheet('local-cast');
    },
    closeSheet: () => {
        useUIStore.getState().closeSheet();
    },
}));

// Sync with global UI store
useUIStore.subscribe((state) => {
    const isVisible = state.activeSheet === 'local-cast';
    if (useCastSheetStore.getState().isVisible !== isVisible) {
        useCastSheetStore.setState({ isVisible });
    }
});
