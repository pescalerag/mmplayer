import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { AlbumFilters, EMPTY_ALBUM_FILTERS } from '../utils/albumFilters';
import { EMPTY_SECTION_FILTERS, FilterSection, SectionFilters } from '../utils/libraryFilters';

export type SortOption =
    | 'name_asc'
    | 'name_desc'
    | 'recent_desc'
    | 'recent_asc'
    | 'duration_desc'
    | 'duration_asc'
    | 'year_desc'
    | 'year_asc'
    | 'rating_desc'
    | 'rating_asc';

interface LibraryState {
    sectionFilters: Record<FilterSection, SectionFilters>;
    setSectionFilters: (section: FilterSection, filters: SectionFilters) => void;
    albumSort: SortOption;
    albumFilters: AlbumFilters;
    setAlbumFilters: (filters: AlbumFilters) => void;
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
            sectionFilters: { tracks: { ...EMPTY_SECTION_FILTERS }, playlists: { ...EMPTY_SECTION_FILTERS }, artists: { ...EMPTY_SECTION_FILTERS }, folders: { ...EMPTY_SECTION_FILTERS } },
            setSectionFilters: (section, filters) => set(state => ({ sectionFilters: { ...state.sectionFilters, [section]: { ...EMPTY_SECTION_FILTERS, ...filters } } })),
            albumSort: 'name_asc',
            albumFilters: { ...EMPTY_ALBUM_FILTERS },
            setAlbumFilters: (albumFilters) => set({ albumFilters: { ...EMPTY_ALBUM_FILTERS, ...albumFilters } }),
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
            merge: (persisted, current) => {
                const saved = persisted as Partial<LibraryState> | undefined;
                const sectionFilters = { ...current.sectionFilters };
                for (const section of Object.keys(sectionFilters) as FilterSection[]) sectionFilters[section] = { ...EMPTY_SECTION_FILTERS, ...saved?.sectionFilters?.[section] };
                return { ...current, ...saved, sectionFilters, albumFilters: { ...EMPTY_ALBUM_FILTERS, ...saved?.albumFilters } };
            },
        }
    )
);
