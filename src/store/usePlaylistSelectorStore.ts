import { create } from 'zustand';
import Playlist from '../database/models/Playlist';
import Track from '../database/models/Track';

interface PlaylistSelectorState {
    isVisible: boolean;
    tracksToAssociate: Track[];
    playlistToEdit: Playlist | null;
    isCreatingDirectly: boolean;
    openSelector: (tracks: Track | Track[]) => void;
    openEdit: (playlist: Playlist) => void;
    openCreate: () => void;
    closeSelector: () => void;
}

export const usePlaylistSelectorStore = create<PlaylistSelectorState>((set) => ({
    isVisible: false,
    tracksToAssociate: [],
    playlistToEdit: null,
    isCreatingDirectly: false,
    openSelector: (tracks) => set({
        isVisible: true,
        tracksToAssociate: Array.isArray(tracks) ? tracks : [tracks],
        playlistToEdit: null,
        isCreatingDirectly: false,
    }),
    openEdit: (playlist) => set({
        isVisible: true,
        tracksToAssociate: [],
        playlistToEdit: playlist,
        isCreatingDirectly: false,
    }),
    openCreate: () => set({
        isVisible: true,
        tracksToAssociate: [],
        playlistToEdit: null,
        isCreatingDirectly: true,
    }),
    closeSelector: () => set({
        isVisible: false,
        tracksToAssociate: [],
        playlistToEdit: null,
        isCreatingDirectly: false,
    }),
}));
