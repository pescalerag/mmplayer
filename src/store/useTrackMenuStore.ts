import { create } from 'zustand';
import Track from '../database/models/Track';
import { useUIStore } from './useUIStore';

interface NavCallbacks {
    album?: (albumId: string) => void;
    artist?: (artistId: string) => void;
}

interface TrackMenuState {
    isVisible: boolean;
    selectedTrack: Track | null;
    navCallbacks: NavCallbacks;
    playlistId?: string;
    openMenu: (track: Track, callbacks?: NavCallbacks, playlistId?: string) => void;
    closeMenu: () => void;
}

export const useTrackMenuStore = create<TrackMenuState>((set) => ({
    isVisible: false,
    selectedTrack: null,
    navCallbacks: {},
    playlistId: undefined,
    openMenu: (track, callbacks = {}, playlistId) => {
        useUIStore.getState().openSheet('track-menu', { track, callbacks, playlistId });
    },
    closeMenu: () => {
        useUIStore.getState().closeSheet();
    },
}));

// Sync with global UI store
useUIStore.subscribe((state) => {
    const isVisible = state.activeSheet === 'track-menu';
    const props = isVisible ? state.sheetProps : {};
    useTrackMenuStore.setState({
        isVisible,
        selectedTrack: props.track || null,
        navCallbacks: props.callbacks || {},
        playlistId: props.playlistId,
    });
});
