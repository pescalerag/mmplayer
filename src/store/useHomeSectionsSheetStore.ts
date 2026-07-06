import { create } from 'zustand';
import { useUIStore } from './useUIStore';

interface HomeSectionsSheetState {
    isVisible: boolean;
    openSheet: () => void;
    closeSheet: () => void;
}

export const useHomeSectionsSheetStore = create<HomeSectionsSheetState>((set) => ({
    isVisible: false,
    openSheet: () => {
        useUIStore.getState().openSheet('home-sections');
    },
    closeSheet: () => {
        useUIStore.getState().closeSheet();
    },
}));

// Sync with global UI store
useUIStore.subscribe((state) => {
    const isVisible = state.activeSheet === 'home-sections';
    if (useHomeSectionsSheetStore.getState().isVisible !== isVisible) {
        useHomeSectionsSheetStore.setState({ isVisible });
    }
});
