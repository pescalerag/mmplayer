import { create } from 'zustand';
import { SortOption } from './useLibraryStore';
import { useUIStore } from './useUIStore';

export type LibraryTab = 'albums' | 'artists' | 'tracks' | 'playlists';

interface SortModalState {
    isVisible: boolean;
    activeTab: LibraryTab;
    activeSort: SortOption;
    openModal: (tab: LibraryTab, currentSort: SortOption) => void;
    closeModal: () => void;
}

export const useSortModalStore = create<SortModalState>((set) => ({
    isVisible: false,
    activeTab: 'albums',
    activeSort: 'name_asc',
    openModal: (tab, currentSort) => {
        useUIStore.getState().openSheet('sort-modal', { tab, currentSort });
    },
    closeModal: () => {
        useUIStore.getState().closeSheet();
    },
}));

// Sync with global UI store
useUIStore.subscribe((state) => {
    const isVisible = state.activeSheet === 'sort-modal';
    const props = isVisible ? state.sheetProps : {};
    useSortModalStore.setState({
        isVisible,
        activeTab: props.tab || 'albums',
        activeSort: props.currentSort || 'name_asc',
    });
});
