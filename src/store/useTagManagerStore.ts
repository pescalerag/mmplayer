import { create } from 'zustand';
import Track from '../database/models/Track';
import Album from '../database/models/Album';

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
    openForTrack: (track) => set({
        isVisible: true,
        targetType: 'track',
        targetId: track.id,
        targetTitle: track.title,
    }),
    openForAlbum: (album) => set({
        isVisible: true,
        targetType: 'album',
        targetId: album.id,
        targetTitle: album.title,
    }),
    closeManager: () => set({
        isVisible: false,
        targetType: null,
        targetId: null,
        targetTitle: null,
    }),
}));
