import { Platform } from 'react-native';
import { setReplayGainSettings } from '../../modules/native-equalizer';
import { useSettingsStore } from '../store/useSettingsStore';

let unsubscribe: (() => void) | undefined;
let pending = Promise.resolve();

function applySettings() {
    const { isNormalizationEnabled, preampLevel, fallbackGainDB } = useSettingsStore.getState();
    const next = pending.then(() => setReplayGainSettings(isNormalizationEnabled, preampLevel, fallbackGainDB));
    pending = next.catch(error => console.error('[ReplayGain] Could not apply settings:', error));
    return next;
}

export async function initializeReplayGain() {
    if (Platform.OS !== 'android') return;
    if (!unsubscribe) {
        unsubscribe = useSettingsStore.subscribe((state, previous) => {
            if (state.isNormalizationEnabled !== previous.isNormalizationEnabled ||
                state.preampLevel !== previous.preampLevel || state.fallbackGainDB !== previous.fallbackGainDB) {
                void applySettings().catch(() => {});
            }
        });
    }
    // Await this before setup/restore so the first PCM buffer has the saved settings.
    await applySettings();
}
