import { create } from 'zustand';
import { useUIStore } from './useUIStore';

interface LibraryTabsOrderSheetState {
    isVisible: boolean;
    openSheet: () => void;
    closeSheet: () => void;
}

export const useLibraryTabsOrderSheetStore = create<LibraryTabsOrderSheetState>((set) => ({
    isVisible: false,
    openSheet: () => {
        useUIStore.getState().openSheet('library-tabs-order');
    },
    closeSheet: () => {
        useUIStore.getState().closeSheet();
    },
}));

// Sync with global UI store
useUIStore.subscribe((state) => {
    const isVisible = state.activeSheet === 'library-tabs-order';
    if (useLibraryTabsOrderSheetStore.getState().isVisible !== isVisible) {
        useLibraryTabsOrderSheetStore.setState({ isVisible });
    }
});
