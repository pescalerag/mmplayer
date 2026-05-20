import { create } from 'zustand';
import Album from '../database/models/Album';

interface NavCallbacks {
    artist?: (artistId: string) => void;
}

interface AlbumMenuState {
    isVisible: boolean;
    selectedAlbum: Album | null;
    navCallbacks: NavCallbacks;
    openMenu: (album: Album, callbacks?: NavCallbacks) => void;
    closeMenu: () => void;
}

export const useAlbumMenuStore = create<AlbumMenuState>((set) => ({
    isVisible: false,
    selectedAlbum: null,
    navCallbacks: {},
    openMenu: (album, callbacks = {}) => set({
        isVisible: true,
        selectedAlbum: album,
        navCallbacks: callbacks,
    }),
    closeMenu: () => set({
        isVisible: false,
        selectedAlbum: null,
        navCallbacks: {},
    }),
}));
