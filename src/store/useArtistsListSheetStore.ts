import { create } from 'zustand';
import Artist from '../database/models/Artist';

interface ArtistsListSheetState {
    isVisible: boolean;
    artists: Artist[];
    openSheet: (artists: Artist[]) => void;
    closeSheet: () => void;
}

export const useArtistsListSheetStore = create<ArtistsListSheetState>((set) => ({
    isVisible: false,
    artists: [],
    openSheet: (artists) => set({
        isVisible: true,
        artists: artists,
    }),
    closeSheet: () => set({
        isVisible: false,
        artists: [],
    }),
}));
