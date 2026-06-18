import { create } from 'zustand';

interface AudioSpeedPitchSheetState {
    isVisible: boolean;
    openSheet: () => void;
    closeSheet: () => void;
}

export const useAudioSpeedPitchSheetStore = create<AudioSpeedPitchSheetState>((set) => ({
    isVisible: false,
    openSheet: () => set({ isVisible: true }),
    closeSheet: () => set({ isVisible: false }),
}));
