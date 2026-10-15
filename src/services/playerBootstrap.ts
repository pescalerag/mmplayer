import { setupPlayer } from './trackPlayerSetup';
import { useSettingsStore } from '../store/useSettingsStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { EqualizerService } from './EqualizerService';

let initialization: Promise<void> | undefined;

export function ensurePlaybackReady(): Promise<void> {
    if (initialization) return initialization;
    initialization = (async () => {
        if (!useSettingsStore.persist.hasHydrated()) {
            await new Promise<void>(resolve => {
                const stop = useSettingsStore.persist.onFinishHydration(() => { stop(); resolve(); });
                if (useSettingsStore.persist.hasHydrated()) { stop(); resolve(); }
            });
        }
        await setupPlayer();
        await usePlayerStore.getState().restorePlaybackState();
        EqualizerService.subscribeToPlayback();
    })().catch(error => { initialization = undefined; throw error; });
    return initialization;
}
