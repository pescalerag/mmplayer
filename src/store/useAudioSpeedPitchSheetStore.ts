import { create } from 'zustand';
import { useUIStore } from './useUIStore';

interface AudioSpeedPitchSheetState {
    isVisible: boolean;
    openSheet: () => void;
    closeSheet: () => void;
}

export const useAudioSpeedPitchSheetStore = create<AudioSpeedPitchSheetState>((set) => ({
    isVisible: false,
    openSheet: () => {
        useUIStore.getState().openSheet('speed-pitch');
    },
    closeSheet: () => {
        useUIStore.getState().closeSheet();
    },
}));

// Sync with global UI store
useUIStore.subscribe((state) => {
    const isVisible = state.activeSheet === 'speed-pitch';
    if (useAudioSpeedPitchSheetStore.getState().isVisible !== isVisible) {
        useAudioSpeedPitchSheetStore.setState({ isVisible });
    }
});
