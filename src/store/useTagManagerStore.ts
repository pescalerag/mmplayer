import { create } from 'zustand';
import Track from '../database/models/Track';
import Album from '../database/models/Album';
import { useUIStore } from './useUIStore';

interface TagManagerState {
    isVisible: boolean;
    targetType: 'track' | 'album' | null;
    targetId: string | null;
    targetTitle: string | null;
    openForTrack: (track: Track) => void;
    openForAlbum: (album: Album) => void;
    closeManager: () => void;
}

export const useTagManagerStore = create<TagManagerState>((set) => ({
    isVisible: false,
    targetType: null,
    targetId: null,
    targetTitle: null,
    openForTrack: (track) => {
        useUIStore.getState().openSheet('tag-manager', {
            targetType: 'track',
            targetId: track.id,
            targetTitle: track.title,
        });
    },
    openForAlbum: (album) => {
        useUIStore.getState().openSheet('tag-manager', {
            targetType: 'album',
            targetId: album.id,
            targetTitle: album.title,
        });
    },
    closeManager: () => {
        useUIStore.getState().closeSheet();
    },
}));

// Sync with global UI store
useUIStore.subscribe((state) => {
    const isVisible = state.activeSheet === 'tag-manager';
    const props = isVisible ? state.sheetProps : {};
    useTagManagerStore.setState({
        isVisible,
        targetType: props.targetType || null,
        targetId: props.targetId || null,
        targetTitle: props.targetTitle || null,
    });
});
