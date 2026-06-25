import { create } from 'zustand';
import Track from '../database/models/Track';

interface MetadataEditorState {
    isVisible: boolean;
    tracks: Track[];
    openSheet: (tracks: Track[]) => void;
    closeSheet: () => void;
}

export const useMetadataEditorStore = create<MetadataEditorState>((set) => ({
    isVisible: false,
    tracks: [],
    openSheet: (tracks) => set({ isVisible: true, tracks }),
    closeSheet: () => set({ isVisible: false, tracks: [] }),
}));
