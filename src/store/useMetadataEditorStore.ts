import { create } from 'zustand';
import Track from '../database/models/Track';
import { useUIStore } from './useUIStore';

interface MetadataEditorState {
    isVisible: boolean;
    tracks: Track[];
    openSheet: (tracks: Track[]) => void;
    closeSheet: () => void;
}

export const useMetadataEditorStore = create<MetadataEditorState>((set) => ({
    isVisible: false,
    tracks: [],
    openSheet: (tracks) => {
        useUIStore.getState().openSheet('metadata-editor', { tracks });
    },
    closeSheet: () => {
        useUIStore.getState().closeSheet();
    },
}));

// Sync with global UI store
useUIStore.subscribe((state) => {
    const isVisible = state.activeSheet === 'metadata-editor';
    const props = isVisible ? state.sheetProps : {};
    useMetadataEditorStore.setState({
        isVisible,
        tracks: props.tracks || [],
    });
});
