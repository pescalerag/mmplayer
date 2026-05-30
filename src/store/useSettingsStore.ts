import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
    showTagColors: boolean;
    setShowTagColors: (value: boolean) => void;
    excludedFolders: string[];
    excludeFolder: (folderPath: string) => void;
    includeFolder: (folderPath: string) => void;
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
        }),
        {
            name: 'mmplayer-settings',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
