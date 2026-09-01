import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type SortOption =
    | 'name_asc'
    | 'name_desc'
    | 'recent_desc'
    | 'recent_asc'
    | 'duration_desc'
    | 'duration_asc'
    | 'year_desc'
    | 'year_asc';

interface LibraryState {
    albumSort: SortOption;
    artistSort: SortOption;
    playlistSort: SortOption;
    trackSort: SortOption;
    artistFilter: 'album' | 'all';
    playlistFilter: 'user' | 'smart';
    setAlbumSort: (sort: SortOption) => void;
    setArtistSort: (sort: SortOption) => void;
    setPlaylistSort: (sort: SortOption) => void;
    setTrackSort: (sort: SortOption) => void;
    setArtistFilter: (filter: 'album' | 'all') => void;
    setPlaylistFilter: (filter: 'user' | 'smart') => void;
}

export const useLibraryStore = create<LibraryState>()(
    persist(
        (set) => ({
            albumSort: 'name_asc',
            artistSort: 'name_asc',
            playlistSort: 'recent_desc',
            trackSort: 'name_asc',
            artistFilter: 'album',
            playlistFilter: 'user',
            setAlbumSort: (sort) => set({ albumSort: sort }),
            setArtistSort: (sort) => set({ artistSort: sort }),
            setPlaylistSort: (sort) => set({ playlistSort: sort }),
            setTrackSort: (sort) => set({ trackSort: sort }),
            setArtistFilter: (filter) => set({ artistFilter: filter }),
            setPlaylistFilter: (filter) => set({ playlistFilter: filter }),
        }),
        {
            name: 'library-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
