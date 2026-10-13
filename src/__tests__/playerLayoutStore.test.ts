import {
    calculatePlayerArtworkSize, getPlayerArtworkLayoutKey,
    PlayerArtworkLayoutConfig, usePlayerLayoutStore,
} from '../store/usePlayerLayoutStore';
import { createMMKV } from 'react-native-mmkv';

const config: PlayerArtworkLayoutConfig = {
    width: 400, height: 800, topInset: 24, bottomInset: 24, fontScale: 1,
};

describe('persistent PlayerScreen artwork size', () => {
    let disk: Map<string, string>;
    const storage = createMMKV();
    beforeEach(() => {
        disk = new Map();
        (storage.getString as jest.Mock).mockImplementation((key: string) => disk.get(key));
        (storage.set as jest.Mock).mockImplementation((key: string, value: string) => { disk.set(key, value); });
        usePlayerLayoutStore.setState({ artworkLayouts: {} });
    });

    it('retains the measured size when opening the same player layout again', () => {
        const key = getPlayerArtworkLayoutKey(config);
        const store = usePlayerLayoutStore.getState();
        store.rememberEstimate(key, calculatePlayerArtworkSize(config));
        store.recordMeasurement(config, 240);
        const measured = usePlayerLayoutStore.getState().artworkLayouts[key];
        expect(measured).toEqual({ size: 322, measuredHeight: 240 });
        const onChange = jest.fn();
        const unsubscribe = usePlayerLayoutStore.subscribe(onChange);
        // Reopening must reuse this entry, even if an initial estimate is queued.
        store.rememberEstimate(key, 302);
        store.recordMeasurement(config, 241);
        expect(usePlayerLayoutStore.getState().artworkLayouts[key]).toBe(measured);
        expect(onChange).not.toHaveBeenCalled();
        unsubscribe();
    });

    it.each([
        { width: 800, height: 400 }, { topInset: 40 }, { bottomInset: 40 },
        { fontScale: 1.4 },
    ])('keeps a separate size for a changed layout: %j', changes => {
        usePlayerLayoutStore.getState().recordMeasurement(config, 240);
        const updated = { ...config, ...changes };
        const key = getPlayerArtworkLayoutKey(updated);
        expect(key).not.toBe(getPlayerArtworkLayoutKey(config));
        expect(usePlayerLayoutStore.getState().artworkLayouts[key]).toBeUndefined();
        usePlayerLayoutStore.getState().recordMeasurement(updated, 200);
        expect(usePlayerLayoutStore.getState().artworkLayouts[key].size).toBe(calculatePlayerArtworkSize(updated));
        expect(usePlayerLayoutStore.getState().artworkLayouts[getPlayerArtworkLayoutKey(config)].size).toBe(322);
    });

    it('does not resize on subsequent song/layout events or invalid measurements', () => {
        const key = getPlayerArtworkLayoutKey(config);
        const store = usePlayerLayoutStore.getState();
        store.recordMeasurement(config, 240);
        store.recordMeasurement(config, 300);
        const updated = usePlayerLayoutStore.getState().artworkLayouts[key];
        expect(updated.size).toBe(322);
        for (const height of [0, -1, NaN, Infinity]) store.recordMeasurement(config, height);
        expect(usePlayerLayoutStore.getState().artworkLayouts[key]).toBe(updated);
    });

    it('preserves the size limits on constrained and spacious screens', () => {
        expect(calculatePlayerArtworkSize({ ...config, height: 570 })).toBe(140);
        expect(calculatePlayerArtworkSize({ ...config, height: 1000 })).toBe(336);
        expect(calculatePlayerArtworkSize(config)).toBe(322);
    });

    it('retains calibrated geometry variants rather than evicting them', () => {
        for (let height = 600; height < 630; height++) {
            usePlayerLayoutStore.getState().recordMeasurement({ ...config, height }, 240);
        }
        expect(Object.keys(usePlayerLayoutStore.getState().artworkLayouts)).toHaveLength(30);
    });

    it('restores the measured size synchronously from persistent storage', () => {
        const key = getPlayerArtworkLayoutKey(config);
        usePlayerLayoutStore.getState().recordMeasurement(config, 240);
        const saved = disk.get('player-artwork-layout')!;
        expect(JSON.parse(saved).state.artworkLayouts[key]).toEqual({ size: 322, measuredHeight: 240 });
        usePlayerLayoutStore.setState({ artworkLayouts: {} });
        disk.set('player-artwork-layout', saved);
        // No await: the saved value must be ready before the first render.
        usePlayerLayoutStore.persist.rehydrate();
        expect(usePlayerLayoutStore.persist.hasHydrated()).toBe(true);
        expect(usePlayerLayoutStore.getState().artworkLayouts[key]).toEqual({ size: 322, measuredHeight: 240 });
    });

    it('uses the same size for tracks with and without lyrics and alternate display modes', () => {
        const key = getPlayerArtworkLayoutKey(config);
        usePlayerLayoutStore.getState().recordMeasurement(config, 240);
        const withLyrics = { ...config, hasLyrics: true, isImmersive: false, isAltDisplay: false };
        const withoutLyrics = { ...config, hasLyrics: false, isImmersive: true, isAltDisplay: true };
        expect(getPlayerArtworkLayoutKey(withLyrics)).toBe(key);
        expect(getPlayerArtworkLayoutKey(withoutLyrics)).toBe(key);
        usePlayerLayoutStore.getState().recordMeasurement(withoutLyrics, 420);
        expect(usePlayerLayoutStore.getState().artworkLayouts[key].size).toBe(322);
    });
});
