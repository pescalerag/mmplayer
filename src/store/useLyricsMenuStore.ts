import { create } from 'zustand';
import Track from '../database/models/Track';
import { useUIStore } from './useUIStore';

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
    openMenu: (track, onImportSuccess) => {
        useUIStore.getState().openSheet('lyrics-menu', { track, onImportSuccess });
    },
    closeMenu: () => {
        useUIStore.getState().closeSheet();
    },
}));

// Sync with global UI store
useUIStore.subscribe((state) => {
    const isVisible = state.activeSheet === 'lyrics-menu';
    const props = isVisible ? state.sheetProps : {};
    useLyricsMenuStore.setState({
        isVisible,
        track: props.track || null,
        onImportSuccess: props.onImportSuccess || (() => {}),
    });
});
