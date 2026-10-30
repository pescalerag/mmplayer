import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSettingsStore } from "../../../../../src/store/useSettingsStore";

export async function saveSettingsAndRestart(updates: Record<string, any>) {
  useSettingsStore.setState(updates);
  try {
    const currentState = useSettingsStore.getState();
    const rawState: Record<string, any> = {};
    for (const key of Object.keys(currentState)) {
      if (typeof (currentState as any)[key] !== "function") {
        rawState[key] = (currentState as any)[key];
      }
    }
    await AsyncStorage.setItem(
      "mmplayer-settings",
      JSON.stringify({
        state: rawState,
        version: 0,
      }),
    );
  } catch (e) {
    console.error("Error persisting settings on desktop:", e);
  }
}
