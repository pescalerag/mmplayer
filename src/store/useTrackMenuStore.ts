import { create } from 'zustand';
import Track from '../database/models/Track';

interface TrackMenuState {
    isVisible: boolean;
    selectedTrack: Track | null;
    openMenu: (track: Track) => void;
    closeMenu: () => void;
}

export const useTrackMenuStore = create<TrackMenuState>((set) => ({
    isVisible: false,
    selectedTrack: null,
    openMenu: (track) => set({ isVisible: true, selectedTrack: track }),
    closeMenu: () => set({ isVisible: false, selectedTrack: null }),
}));
