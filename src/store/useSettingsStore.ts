import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
    showTagColors: boolean;
    setShowTagColors: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            showTagColors: true,
            setShowTagColors: (value) => set({ showTagColors: value }),
        }),
        {
            name: 'mmplayer-settings',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
