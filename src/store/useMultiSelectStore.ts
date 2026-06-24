import { create } from 'zustand';
import Track from '../database/models/Track';

interface MultiSelectState {
    isSelectionMode: boolean;
    selectedTracks: Track[];
    enterSelectionMode: (initialTrack: Track) => void;
    toggleTrack: (track: Track) => void;
    clearSelection: () => void;
    exitSelectionMode: () => void;
}

export const useMultiSelectStore = create<MultiSelectState>((set, get) => ({
    isSelectionMode: false,
    selectedTracks: [],
    
    enterSelectionMode: (initialTrack) => set({ 
        isSelectionMode: true, 
        selectedTracks: [initialTrack] 
    }),
    
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
