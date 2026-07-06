import { create } from 'zustand';
import Artist from '../database/models/Artist';
import { useUIStore } from './useUIStore';

interface NavCallbacks {
    detail?: (artistId: string) => void;
}

interface ArtistMenuState {
    isVisible: boolean;
    selectedArtist: Artist | null;
    navCallbacks: NavCallbacks;
    openMenu: (artist: Artist, callbacks?: NavCallbacks) => void;
    closeMenu: () => void;
}

export const useArtistMenuStore = create<ArtistMenuState>((set) => ({
    isVisible: false,
    selectedArtist: null,
    navCallbacks: {},
    openMenu: (artist, callbacks = {}) => {
        useUIStore.getState().openSheet('artist-menu', { artist, callbacks });
    },
    closeMenu: () => {
        useUIStore.getState().closeSheet();
    },
}));

// Sync with global UI store
useUIStore.subscribe((state) => {
    const isVisible = state.activeSheet === 'artist-menu';
    const props = isVisible ? state.sheetProps : {};
    useArtistMenuStore.setState({
        isVisible,
        selectedArtist: props.artist || null,
        navCallbacks: props.callbacks || {},
    });
});
