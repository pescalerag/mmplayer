import { create } from 'zustand';
import Tag from '../database/models/Tag';

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
    openForCreate: (onSave) => set({
        isVisible: true,
        tag: null,
        onSaveCallback: onSave || null,
    }),
    openForEdit: (tag, onSave) => set({
        isVisible: true,
        tag: tag,
        onSaveCallback: onSave || null,
    }),
    closeForm: () => set({
        isVisible: false,
        tag: null,
        onSaveCallback: null,
    }),
}));
