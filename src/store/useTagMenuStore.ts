import { create } from 'zustand';
import Tag from '../database/models/Tag';

interface TagMenuState {
    isVisible: boolean;
    selectedTag: Tag | null;
    openMenu: (tag: Tag) => void;
    closeMenu: () => void;
}

export const useTagMenuStore = create<TagMenuState>((set) => ({
    isVisible: false,
    selectedTag: null,
    openMenu: (tag) => set({
        isVisible: true,
        selectedTag: tag,
    }),
    closeMenu: () => set({
        isVisible: false,
        selectedTag: null,
    }),
}));
