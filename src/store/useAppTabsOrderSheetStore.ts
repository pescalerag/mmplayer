import { create } from 'zustand';
import { useUIStore } from './useUIStore';

interface AppTabsOrderSheetState {
    isVisible: boolean;
    openSheet: () => void;
    closeSheet: () => void;
}

export const useAppTabsOrderSheetStore = create<AppTabsOrderSheetState>((set) => ({
    isVisible: false,
    openSheet: () => {
        useUIStore.getState().openSheet('app-tabs-order');
    },
    closeSheet: () => {
        useUIStore.getState().closeSheet();
    },
}));

// Sync with global UI store
useUIStore.subscribe((state) => {
    const isVisible = state.activeSheet === 'app-tabs-order';
    if (useAppTabsOrderSheetStore.getState().isVisible !== isVisible) {
        useAppTabsOrderSheetStore.setState({ isVisible });
    }
});
