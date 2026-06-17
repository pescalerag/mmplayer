import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from '../constants/i18n';

interface SettingsState {
    showTagColors: boolean;
    setShowTagColors: (value: boolean) => void;
    excludedFolders: string[];
    excludeFolder: (folderPath: string) => void;
    includeFolder: (folderPath: string) => void;
    excludedSongs: string[];
    excludeSong: (songPath: string) => void;
    includeSong: (songPath: string) => void;
    lastSeenVersion: string | null;
    setLastSeenVersion: (version: string) => void;
    language: string | null;
    setLanguage: (lang: string) => void;
    hideSyncToastOnResume: boolean;
    setHideSyncToastOnResume: (value: boolean) => void;
    swipeLeftAction: SwipeAction;
    setSwipeLeftAction: (action: SwipeAction) => void;
    swipeRightAction: SwipeAction;
    setSwipeRightAction: (action: SwipeAction) => void;
    libraryTabsOrder: LibraryTabType[];
    setLibraryTabsOrder: (order: LibraryTabType[]) => void;
    appTabsOrder: AppTabType[];
    setAppTabsOrder: (order: AppTabType[]) => void;
    initialAppRoute: AppTabType;
    setInitialAppRoute: (route: AppTabType) => void;
}

export type SwipeAction = 'add_next' | 'add_last' | 'toggle_favorite' | 'add_to_playlist' | 'none';
export type LibraryTabType = 'albums' | 'artists' | 'tracks' | 'playlists' | 'folders';
export type AppTabType = 'Inicio' | 'Biblioteca' | 'Buscar' | 'Etiquetas' | 'Configuración';

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            showTagColors: true,
            setShowTagColors: (value) => set({ showTagColors: value }),
            hideSyncToastOnResume: false,
            setHideSyncToastOnResume: (value) => set({ hideSyncToastOnResume: value }),
            swipeLeftAction: 'add_last',
            setSwipeLeftAction: (action) => set({ swipeLeftAction: action }),
            swipeRightAction: 'add_next',
            setSwipeRightAction: (action) => set({ swipeRightAction: action }),
            libraryTabsOrder: ['albums', 'playlists', 'artists', 'folders', 'tracks'],
            setLibraryTabsOrder: (order) => set({ libraryTabsOrder: order }),
            appTabsOrder: ['Inicio', 'Biblioteca', 'Buscar', 'Etiquetas', 'Configuración'],
            setAppTabsOrder: (order) => set({ appTabsOrder: order }),
            initialAppRoute: 'Inicio',
            setInitialAppRoute: (route) => set({ initialAppRoute: route }),
            excludedFolders: [],
            excludedSongs: [],
            excludeFolder: (folderPath) => set((state) => {
                if (state.excludedFolders.includes(folderPath)) return state;
                return { excludedFolders: [...state.excludedFolders, folderPath] };
            }),
            includeFolder: (folderPath) => set((state) => ({
                excludedFolders: state.excludedFolders.filter((f) => f !== folderPath),
            })),
            excludeSong: (songPath) => set((state) => {
                const songs = state.excludedSongs || [];
                if (songs.includes(songPath)) return state;
                return { excludedSongs: [...songs, songPath] };
            }),
            includeSong: (songPath) => set((state) => ({
                excludedSongs: (state.excludedSongs || []).filter((s) => s !== songPath),
            })),
            lastSeenVersion: null,
            setLastSeenVersion: (version) => set({ lastSeenVersion: version }),
            language: null,
            setLanguage: (lang) => {
                set({ language: lang });
                i18n.changeLanguage(lang);
            },
        }),
        {
            name: 'mmplayer-settings',
            storage: createJSONStorage(() => AsyncStorage),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    if (!state.language) {
                        const locales = Localization.getLocales();
                        const systemLanguage = locales[0]?.languageCode ?? 'es';
                        const defaultLang = systemLanguage.startsWith('es') ? 'es' : 'en';
                        state.setLanguage(defaultLang);
                    } else {
                        i18n.changeLanguage(state.language);
                    }
                }
            }
        }
    )
);

