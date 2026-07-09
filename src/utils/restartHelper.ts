import AsyncStorage from '@react-native-async-storage/async-storage';
import RNRestart from 'react-native-restart';
import { useSettingsStore } from '../store/useSettingsStore';

/**
 * Saves specific settings in useSettingsStore, manually persists them to AsyncStorage
 * to prevent race conditions during immediate app restart, and restarts the app.
 */
export async function saveSettingsAndRestart(updates: Record<string, any>) {
  // 1. Update zustand store state
  useSettingsStore.setState(updates);

  // 2. Persist the updated state to AsyncStorage manually to guarantee write completion before restart
  try {
    const currentState = useSettingsStore.getState();
    const rawState: any = {};
    for (const key of Object.keys(currentState)) {
      if (typeof (currentState as any)[key] !== 'function') {
        rawState[key] = (currentState as any)[key];
      }
    }

    await AsyncStorage.setItem('mmplayer-settings', JSON.stringify({
      state: rawState,
      version: 0
    }));
  } catch (e) {
    console.error("Error persisting settings before restart:", e);
  }

  // 3. Trigger app restart
  setTimeout(() => {
    RNRestart.restart();
  }, 800);
}
