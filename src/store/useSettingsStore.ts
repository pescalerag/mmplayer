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
    lastSeenVersion: string | null;
    setLastSeenVersion: (version: string) => void;
    language: string | null;
    setLanguage: (lang: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            showTagColors: true,
            setShowTagColors: (value) => set({ showTagColors: value }),
            excludedFolders: [],
            excludeFolder: (folderPath) => set((state) => {
                if (state.excludedFolders.includes(folderPath)) return state;
                return { excludedFolders: [...state.excludedFolders, folderPath] };
            }),
            includeFolder: (folderPath) => set((state) => ({
                excludedFolders: state.excludedFolders.filter((f) => f !== folderPath),
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

