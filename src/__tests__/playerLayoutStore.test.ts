import {
    calculatePlayerArtworkSize, calculatePlayerLyricsSlotHeight, getPlayerArtworkLayoutKey,
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
        expect(measured).toEqual({ size: 154, measuredHeight: 240 });
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
        expect(usePlayerLayoutStore.getState().artworkLayouts[key].size).toBe(calculatePlayerArtworkSize(updated, 200));
        expect(usePlayerLayoutStore.getState().artworkLayouts[getPlayerArtworkLayoutKey(config)].size).toBe(154);
    });

    it('adapts to a real available-height change and ignores invalid measurements', () => {
        const key = getPlayerArtworkLayoutKey(config);
        const store = usePlayerLayoutStore.getState();
        store.recordMeasurement(config, 240);
        store.recordMeasurement(config, 300);
        const updated = usePlayerLayoutStore.getState().artworkLayouts[key];
        expect(updated.size).toBe(214);
        for (const height of [0, -1, NaN, Infinity]) store.recordMeasurement(config, height);
        expect(usePlayerLayoutStore.getState().artworkLayouts[key]).toBe(updated);
    });

    it('uses the full normal artwork width regardless of the old guessed control height', () => {
        expect(calculatePlayerArtworkSize({ ...config, height: 570 })).toBe(336);
        expect(calculatePlayerArtworkSize({ ...config, height: 1000 })).toBe(336);
        expect(calculatePlayerArtworkSize(config)).toBe(336);
        expect(calculatePlayerArtworkSize({ ...config, width: 360, height: 700, topInset: 60, bottomInset: 60 })).toBe(296);
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
        expect(JSON.parse(saved).state.artworkLayouts[key]).toEqual({ size: 154, measuredHeight: 240 });
        usePlayerLayoutStore.setState({ artworkLayouts: {} });
        disk.set('player-artwork-layout', saved);
        // No await: the saved value must be ready before the first render.
        usePlayerLayoutStore.persist.rehydrate();
        expect(usePlayerLayoutStore.persist.hasHydrated()).toBe(true);
        expect(usePlayerLayoutStore.getState().artworkLayouts[key]).toEqual({ size: 154, measuredHeight: 240 });
    });

    it('uses the same size for tracks with and without lyrics and alternate display modes', () => {
        const key = getPlayerArtworkLayoutKey(config);
        usePlayerLayoutStore.getState().recordMeasurement(config, 240);
        const withLyrics = { ...config, hasLyrics: true, isImmersive: false, isAltDisplay: false };
        const withoutLyrics = { ...config, hasLyrics: false, isImmersive: true, isAltDisplay: true };
        expect(getPlayerArtworkLayoutKey(withLyrics)).toBe(key);
        expect(getPlayerArtworkLayoutKey(withoutLyrics)).toBe(key);
        usePlayerLayoutStore.getState().recordMeasurement(withoutLyrics, 240);
        expect(usePlayerLayoutStore.getState().artworkLayouts[key].size).toBe(154);
    });

    it.each([1, 2, 3])('discards incompatible v%i measurements and calibrates the new region once', version => {
        const key = getPlayerArtworkLayoutKey(config);
        disk.set('player-artwork-layout', JSON.stringify({
            version, state: { artworkLayouts: { [key]: { size: 154, measuredHeight: 240 } } },
        }));
        usePlayerLayoutStore.persist.rehydrate();
        expect(usePlayerLayoutStore.getState().artworkLayouts[key]).toBeUndefined();
        expect(JSON.parse(disk.get('player-artwork-layout')!).version).toBe(4);
        usePlayerLayoutStore.getState().recordMeasurement(config, 430);
        expect(usePlayerLayoutStore.getState().artworkLayouts[key].size).toBe(336);
    });

    it('reserves complete lyrics and shrinks artwork when necessary', () => {
        const roomy = calculatePlayerArtworkSize(config, 430);
        expect(roomy).toBe(336);
        expect(calculatePlayerLyricsSlotHeight(config, roomy, 430)).toBe(58);
        const tighter = calculatePlayerArtworkSize(config, 390);
        expect(tighter).toBe(304);
        expect(calculatePlayerLyricsSlotHeight(config, tighter, 390)).toBe(58);
        const short = calculatePlayerArtworkSize(config, 300);
        expect(short).toBe(214);
        expect(calculatePlayerLyricsSlotHeight(config, short, 300)).toBe(58);
    });

    it('fits artwork and lyrics into the measured region across screen sizes and theme padding', () => {
        for (const width of [240, 320, 360, 400, 600, 900]) {
            for (const height of [100, 180, 240, 300, 390, 500, 900]) {
                for (const artworkPadding of [0, 24, 28, 48]) {
                    const dimensions = { ...config, width, artworkPadding };
                    const size = calculatePlayerArtworkSize(dimensions, height);
                    const lyrics = calculatePlayerLyricsSlotHeight(dimensions, size, height);
                    expect(size).toBeLessThanOrEqual(width - 64);
                    expect(size + artworkPadding + lyrics).toBeLessThanOrEqual(height);
                    expect(lyrics).toBeLessThanOrEqual(58);
                }
            }
        }
    });

    it.each([1, 1.4, 2])('reserves both lyric lines at font scale %s', fontScale => {
        const dimensions = { ...config, fontScale };
        const size = calculatePlayerArtworkSize(dimensions, 300);
        const lyrics = calculatePlayerLyricsSlotHeight(dimensions, size, 300);
        expect(lyrics).toBeCloseTo(46 * fontScale + 12);
        expect(size + lyrics + 28).toBeCloseTo(300);
    });
});
