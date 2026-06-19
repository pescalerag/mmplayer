import { create } from 'zustand';
import Track from '../database/models/Track';

interface LyricsMenuState {
    isVisible: boolean;
    track: Track | null;
    onImportSuccess: (lyrics: string) => void;
    openMenu: (track: Track, onImportSuccess: (lyrics: string) => void) => void;
    closeMenu: () => void;
}

export const useLyricsMenuStore = create<LyricsMenuState>((set) => ({
    isVisible: false,
    track: null,
    onImportSuccess: () => {},
    openMenu: (track, onImportSuccess) => set({ isVisible: true, track, onImportSuccess }),
    closeMenu: () => set({ isVisible: false, track: null }),
}));
