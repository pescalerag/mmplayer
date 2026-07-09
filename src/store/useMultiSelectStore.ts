import { create } from 'zustand';
import Track from '../database/models/Track';

interface MultiSelectState {
    isSelectionMode: boolean;
    selectedTracks: Track[];
    enterSelectionMode: (initialTrack: Track) => void;
    selectMultipleTracks: (tracks: Track[]) => void;
    toggleTrack: (track: Track) => void;
    clearSelection: () => void;
    exitSelectionMode: () => void;
}

export const useMultiSelectStore = create<MultiSelectState>((set, get) => ({
    isSelectionMode: false,
    selectedTracks: [],
    
    enterSelectionMode: (initialTrack) => {
        const { isSelectionMode, selectedTracks } = get();
        if (isSelectionMode) {
            const exists = selectedTracks.some(t => t.id === initialTrack.id);
            if (!exists) {
                set({ selectedTracks: [...selectedTracks, initialTrack] });
            }
        } else {
            set({ isSelectionMode: true, selectedTracks: [initialTrack] });
        }
    },

    selectMultipleTracks: (tracks) => {
        const { isSelectionMode, selectedTracks } = get();
        if (isSelectionMode) {
            const toAdd = tracks.filter(t => !selectedTracks.some(st => st.id === t.id));
            set({ selectedTracks: [...selectedTracks, ...toAdd] });
        } else {
            set({ isSelectionMode: true, selectedTracks: tracks });
        }
    },
    
    toggleTrack: (track) => {
        const { selectedTracks } = get();
        const exists = selectedTracks.find(t => t.id === track.id);
        
        if (exists) {
            const newSelection = selectedTracks.filter(t => t.id !== track.id);
            // Si deseleccionamos la última canción, salimos del modo selección
            if (newSelection.length === 0) {
                set({ isSelectionMode: false, selectedTracks: [] });
            } else {
                set({ selectedTracks: newSelection });
            }
        } else {
            set({ selectedTracks: [...selectedTracks, track] });
        }
    },
    
    clearSelection: () => set({ selectedTracks: [] }),
    
    exitSelectionMode: () => set({ 
        isSelectionMode: false, 
        selectedTracks: [] 
    }),
}));
