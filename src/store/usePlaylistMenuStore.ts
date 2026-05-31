import { create } from 'zustand';
import Playlist from '../database/models/Playlist';

interface NavCallbacks {
    detail?: (playlistId: string) => void;
}

interface PlaylistMenuState {
    isVisible: boolean;
    selectedPlaylist: Playlist | null;
    navCallbacks: NavCallbacks;
    openMenu: (playlist: Playlist, callbacks?: NavCallbacks) => void;
    closeMenu: () => void;
}

export const usePlaylistMenuStore = create<PlaylistMenuState>((set) => ({
    isVisible: false,
    selectedPlaylist: null,
    navCallbacks: {},
    openMenu: (playlist, callbacks = {}) => set({
        isVisible: true,
        selectedPlaylist: playlist,
        navCallbacks: callbacks,
    }),
    closeMenu: () => set({
        isVisible: false,
        selectedPlaylist: null,
        navCallbacks: {},
    }),
}));
