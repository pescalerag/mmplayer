import { create } from 'zustand';
import Artist from '../database/models/Artist';
import { useUIStore } from './useUIStore';

interface ArtistsListSheetState {
    isVisible: boolean;
    artists: Artist[];
    openSheet: (artists: Artist[]) => void;
    closeSheet: () => void;
}

export const useArtistsListSheetStore = create<ArtistsListSheetState>((set) => ({
    isVisible: false,
    artists: [],
    openSheet: (artists) => {
        useUIStore.getState().openSheet('artists-list', { artists });
    },
    closeSheet: () => {
        useUIStore.getState().closeSheet();
    },
}));

// Sync with global UI store
useUIStore.subscribe((state) => {
    const isVisible = state.activeSheet === 'artists-list';
    const props = isVisible ? state.sheetProps : {};
    useArtistsListSheetStore.setState({
        isVisible,
        artists: props.artists || [],
    });
});
