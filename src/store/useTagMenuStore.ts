import { create } from 'zustand';
import Tag from '../database/models/Tag';
import { useUIStore } from './useUIStore';

interface TagMenuState {
    isVisible: boolean;
    selectedTag: Tag | null;
    openMenu: (tag: Tag) => void;
    closeMenu: () => void;
}

export const useTagMenuStore = create<TagMenuState>((set) => ({
    isVisible: false,
    selectedTag: null,
    openMenu: (tag) => {
        useUIStore.getState().openSheet('tag-menu', { tag });
    },
    closeMenu: () => {
        useUIStore.getState().closeSheet();
    },
}));

// Sync with global UI store
useUIStore.subscribe((state) => {
    const isVisible = state.activeSheet === 'tag-menu';
    const props = isVisible ? state.sheetProps : {};
    useTagMenuStore.setState({
        isVisible,
        selectedTag: props.tag || null,
    });
});
