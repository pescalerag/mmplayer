import { create } from 'zustand';
import Artist from '../database/models/Artist';

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
    openMenu: (artist, callbacks = {}) => set({
        isVisible: true,
        selectedArtist: artist,
        navCallbacks: callbacks,
    }),
    closeMenu: () => set({
        isVisible: false,
        selectedArtist: null,
        navCallbacks: {},
    }),
}));
