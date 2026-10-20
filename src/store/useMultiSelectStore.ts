import { create } from 'zustand';
import Track from '../database/models/Track';

interface MultiSelectState {
    isSelectionMode: boolean;
    selectedTracks: Track[];
    selectedPlaylistIds: Record<string, string | null>;
    selectionPlaylistId: string | null;
    enterSelectionMode: (initialTrack: Track, playlistId?: string) => void;
    selectMultipleTracks: (tracks: Track[], playlistId?: string) => void;
    toggleTrack: (track: Track, playlistId?: string) => void;
    clearSelection: () => void;
    exitSelectionMode: () => void;
}

function selectionState(tracks: Track[], origins: Record<string, string | null>) {
    const selectedPlaylistIds = Object.fromEntries(tracks.map(track => [track.id, origins[track.id] ?? null]));
    const firstPlaylistId = tracks.length ? selectedPlaylistIds[tracks[0].id] : null;
    const selectionPlaylistId = firstPlaylistId && tracks.every(track => selectedPlaylistIds[track.id] === firstPlaylistId)
        ? firstPlaylistId : null;
    return { selectedTracks: tracks, selectedPlaylistIds, selectionPlaylistId };
}

export const useMultiSelectStore = create<MultiSelectState>((set, get) => ({
    isSelectionMode: false,
    selectedTracks: [],
    selectedPlaylistIds: {},
    selectionPlaylistId: null,
    
    enterSelectionMode: (initialTrack, playlistId) => {
        get().selectMultipleTracks([initialTrack], playlistId);
    },

    selectMultipleTracks: (tracks, playlistId) => {
        const state = get();
        const selected = state.isSelectionMode ? [...state.selectedTracks] : [];
        const origins = state.isSelectionMode ? { ...state.selectedPlaylistIds } : {};
        const ids = new Set(selected.map(track => track.id));
        for (const track of tracks) {
            if (ids.has(track.id)) continue;
            ids.add(track.id);
            selected.push(track);
            origins[track.id] = playlistId ?? null;
        }
        set({ isSelectionMode: selected.length > 0, ...selectionState(selected, origins) });
    },
    
    toggleTrack: (track, playlistId) => {
        const { selectedTracks, selectedPlaylistIds } = get();
        const exists = selectedTracks.find(t => t.id === track.id);
        
        if (exists) {
            const newSelection = selectedTracks.filter(t => t.id !== track.id);
            set({ isSelectionMode: newSelection.length > 0, ...selectionState(newSelection, selectedPlaylistIds) });
        } else {
            get().selectMultipleTracks([track], playlistId);
        }
    },
    
    clearSelection: () => set(selectionState([], {})),
    
    exitSelectionMode: () => set({ 
        isSelectionMode: false, 
        ...selectionState([], {})
    }),
}));
