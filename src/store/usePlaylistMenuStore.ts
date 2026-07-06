import { create } from 'zustand';
import Playlist from '../database/models/Playlist';
import { useUIStore } from './useUIStore';

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
    openMenu: (playlist, callbacks = {}) => {
        useUIStore.getState().openSheet('playlist-menu', { playlist, callbacks });
    },
    closeMenu: () => {
        useUIStore.getState().closeSheet();
    },
}));

// Sync with global UI store
useUIStore.subscribe((state) => {
    const isVisible = state.activeSheet === 'playlist-menu';
    const props = isVisible ? state.sheetProps : {};
    usePlaylistMenuStore.setState({
        isVisible,
        selectedPlaylist: props.playlist || null,
        navCallbacks: props.callbacks || {},
    });
});
