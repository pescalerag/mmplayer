import { create } from 'zustand';
import { SortOption } from './useLibraryStore';

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
    openModal: (tab, currentSort) => set({
        isVisible: true,
        activeTab: tab,
        activeSort: currentSort,
    }),
    closeModal: () => set({ isVisible: false }),
}));
