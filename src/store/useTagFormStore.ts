import { create } from 'zustand';
import Tag from '../database/models/Tag';
import { useUIStore } from './useUIStore';

interface TagFormState {
    isVisible: boolean;
    tag: Tag | null;
    onSaveCallback: (() => void) | null;
    openForCreate: (onSave?: () => void) => void;
    openForEdit: (tag: Tag, onSave?: () => void) => void;
    closeForm: () => void;
}

export const useTagFormStore = create<TagFormState>((set) => ({
    isVisible: false,
    tag: null,
    onSaveCallback: null,
    openForCreate: (onSave) => {
        useUIStore.getState().openSheet('tag-form', { tag: null, onSaveCallback: onSave || null });
    },
    openForEdit: (tag, onSave) => {
        useUIStore.getState().openSheet('tag-form', { tag, onSaveCallback: onSave || null });
    },
    closeForm: () => {
        useUIStore.getState().closeSheet();
    },
}));

// Sync with global UI store
useUIStore.subscribe((state) => {
    const isVisible = state.activeSheet === 'tag-form';
    const props = isVisible ? state.sheetProps : {};
    useTagFormStore.setState({
        isVisible,
        tag: props.tag || null,
        onSaveCallback: props.onSaveCallback || null,
    });
});
