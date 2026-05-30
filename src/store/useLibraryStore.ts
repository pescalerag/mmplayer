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
    setAlbumSort: (sort: SortOption) => void;
    setArtistSort: (sort: SortOption) => void;
    setPlaylistSort: (sort: SortOption) => void;
    setTrackSort: (sort: SortOption) => void;
}

export const useLibraryStore = create<LibraryState>()(
    persist(
        (set) => ({
            albumSort: 'name_asc',
            artistSort: 'name_asc',
            playlistSort: 'recent_desc',
            trackSort: 'name_asc',
            setAlbumSort: (sort) => set({ albumSort: sort }),
            setArtistSort: (sort) => set({ artistSort: sort }),
            setPlaylistSort: (sort) => set({ playlistSort: sort }),
            setTrackSort: (sort) => set({ trackSort: sort }),
        }),
        {
            name: 'library-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
