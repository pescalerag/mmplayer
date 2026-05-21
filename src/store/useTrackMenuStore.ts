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
    playlistId?: string;
    openMenu: (track: Track, callbacks?: NavCallbacks, playlistId?: string) => void;
    closeMenu: () => void;
}

export const useTrackMenuStore = create<TrackMenuState>((set) => ({
    isVisible: false,
    selectedTrack: null,
    navCallbacks: {},
    playlistId: undefined,
    openMenu: (track, callbacks = {}, playlistId) => set({
        isVisible: true,
        selectedTrack: track,
        navCallbacks: callbacks,
        playlistId: playlistId,
    }),
    closeMenu: () => set({
        isVisible: false,
        selectedTrack: null,
        navCallbacks: {},
        playlistId: undefined,
    }),
}));
