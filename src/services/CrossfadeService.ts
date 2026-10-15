import { Platform } from 'react-native';
import { setCrossfadeSettings } from '../../modules/native-equalizer';
import { getCrossfadePolicy } from '../utils/crossfadePolicy';

let refresh: (() => Promise<void>) | undefined;
let blocks = 0;

export async function initializeCrossfade() {
    if (Platform.OS !== 'android') return;
    if (refresh) return refresh();
    // Resolve stores lazily, avoiding their existing service cycles.
    const { useSettingsStore } = await import('../store/useSettingsStore');
    const { usePlayerStore } = await import('../store/usePlayerStore');
    const { useCastStore } = await import('../store/useCastStore');
    const { useMultipleQueuesStore } = await import('../store/useMultipleQueuesStore');
    const { useABRepeatStore } = await import('../store/useABRepeatStore');
    let pending = Promise.resolve();
    let last = '';
    refresh = () => {
        const settings = useSettingsStore.getState();
        const player = usePlayerStore.getState();
        const cast = useCastStore.getState();
        const ab = useABRepeatStore.getState();
        const policy = getCrossfadePolicy({ seconds: settings.crossfadeSeconds,
            casting: cast.isServerRunning || cast.isLocalCastActive || cast.isChromecastConnected,
            switchingQueue: useMultipleQueuesStore.getState().isSwitching,
            restoring: player.isRestoring, syncingLyrics: player.isSyncingLyrics,
            hasABPoint: ab.pointA !== null || ab.pointB !== null, blocked: blocks > 0 });
        const key = JSON.stringify(policy);
        if (key === last) return pending;
        last = key;
        const operation = pending.catch(() => {}).then(() => setCrossfadeSettings(policy.seconds, policy.allowed));
        pending = operation;
        void operation.catch(error => {
            if (last === key) last = '';
            console.error('[Crossfade] Could not apply configuration:', error);
        });
        return operation;
    };
    const apply = () => { void refresh?.().catch(() => {}); };
    useSettingsStore.subscribe(apply);
    useSettingsStore.persist.onFinishHydration(apply);
    usePlayerStore.subscribe(apply);
    useCastStore.subscribe(apply);
    useMultipleQueuesStore.subscribe(apply);
    useABRepeatStore.subscribe(apply);
    await refresh();
}

export const CrossfadeService = {
    flush: () => refresh?.() ?? Promise.resolve(),
    async block() {
        blocks++;
        try { await refresh?.(); }
        catch (error) { blocks--; throw error; }
        let released = false;
        return () => {
            if (released) return;
            released = true;
            blocks--;
            void refresh?.().catch(() => {});
        };
    },
};
