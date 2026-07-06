import { create } from 'zustand';
import Album from '../database/models/Album';
import { useUIStore } from './useUIStore';

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
    openMenu: (album, callbacks = {}) => {
        useUIStore.getState().openSheet('album-menu', { album, callbacks });
    },
    closeMenu: () => {
        useUIStore.getState().closeSheet();
    },
}));

// Sync with global UI store
useUIStore.subscribe((state) => {
    const isVisible = state.activeSheet === 'album-menu';
    const props = isVisible ? state.sheetProps : {};
    useAlbumMenuStore.setState({
        isVisible,
        selectedAlbum: props.album || null,
        navCallbacks: props.callbacks || {},
    });
});
