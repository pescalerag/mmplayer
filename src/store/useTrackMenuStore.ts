import { create } from 'zustand';
import Track from '../database/models/Track';

interface NavCallbacks {
    album?: (albumId: string) => void;
    artist?: (artistId: string) => void;
}

interface TrackMenuState {
    isVisible: boolean;
    selectedTrack: Track | null;
    navCallbacks: NavCallbacks;
    openMenu: (track: Track, callbacks?: NavCallbacks) => void;
    closeMenu: () => void;
}

export const useTrackMenuStore = create<TrackMenuState>((set) => ({
    isVisible: false,
    selectedTrack: null,
    navCallbacks: {},
    openMenu: (track, callbacks = {}) => set({
        isVisible: true,
        selectedTrack: track,
        navCallbacks: callbacks,
    }),
    closeMenu: () => set({
        isVisible: false,
        selectedTrack: null,
        navCallbacks: {},
    }),
}));
