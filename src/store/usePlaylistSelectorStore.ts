import { create } from 'zustand';
import Playlist from '../database/models/Playlist';
import Track from '../database/models/Track';
import { useUIStore } from './useUIStore';

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
    openSelector: (tracks) => {
        useUIStore.getState().openSheet('playlist-selector', {
            tracksToAssociate: Array.isArray(tracks) ? tracks : [tracks],
            playlistToEdit: null,
            isCreatingDirectly: false,
        });
    },
    openEdit: (playlist) => {
        useUIStore.getState().openSheet('playlist-selector', {
            tracksToAssociate: [],
            playlistToEdit: playlist,
            isCreatingDirectly: false,
        });
    },
    openCreate: () => {
        useUIStore.getState().openSheet('playlist-selector', {
            tracksToAssociate: [],
            playlistToEdit: null,
            isCreatingDirectly: true,
        });
    },
    closeSelector: () => {
        useUIStore.getState().closeSheet();
    },
}));

// Sync with global UI store
useUIStore.subscribe((state) => {
    const isVisible = state.activeSheet === 'playlist-selector';
    const props = isVisible ? state.sheetProps : {};
    usePlaylistSelectorStore.setState({
        isVisible,
        tracksToAssociate: props.tracksToAssociate || [],
        playlistToEdit: props.playlistToEdit || null,
        isCreatingDirectly: props.isCreatingDirectly || false,
    });
});
