import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';

export interface PlayerArtworkLayoutConfig {
    width: number;
    height: number;
    topInset: number;
    bottomInset: number;
    fontScale: number;
}

interface ArtworkLayout {
    size: number;
    measuredHeight: number;
}

export const getPlayerArtworkLayoutKey = (config: PlayerArtworkLayoutConfig) => [
    config.width, config.height, config.topInset, config.bottomInset, config.fontScale,
].join(':');

export function calculatePlayerArtworkSize(config: PlayerArtworkLayoutConfig) {
    const baseSize = config.width - 64;
    // Reserve transport/info space, but never shrink the cover to fit lyrics.
    const availableHeight = config.height - config.topInset - config.bottomInset - 430;
    return availableHeight > 0 && availableHeight < baseSize
        ? Math.max(140, Math.floor(availableHeight))
        : baseSize;
}

// Read synchronously before the first player render, including after an app
// restart. Song metadata and lyrics never select a different cover size.
const storage = createMMKV({ id: 'player-layout' });
function cacheLayout(layouts: Record<string, ArtworkLayout>, key: string, entry: ArtworkLayout) {
    const updated = { ...layouts };
    updated[key] = entry;
    return updated;
}

interface PlayerLayoutState {
    artworkLayouts: Record<string, ArtworkLayout>;
    rememberEstimate: (key: string, size: number) => void;
    recordMeasurement: (config: PlayerArtworkLayoutConfig, height: number) => void;
}

export const usePlayerLayoutStore = create<PlayerLayoutState>()(persist((set) => ({
    artworkLayouts: {},
    rememberEstimate: (key, size) => set(state => {
        if (state.artworkLayouts[key]) return state;
        return { artworkLayouts: cacheLayout(state.artworkLayouts, key, { size, measuredHeight: 0 }) };
    }),
    recordMeasurement: (config, height) => set(state => {
        if (!Number.isFinite(height) || height <= 0) return state;
        const key = getPlayerArtworkLayoutKey(config);
        const previous = state.artworkLayouts[key];
        // Once calibrated, retain the size until the device geometry changes.
        // onLayout also fires during song changes and visual transitions.
        if (previous && previous.measuredHeight > 0) return state;
        return {
            artworkLayouts: cacheLayout(state.artworkLayouts, key, {
                size: previous?.size ?? calculatePlayerArtworkSize(config), measuredHeight: height,
            }),
        };
    }),
}), {
    name: 'player-artwork-layout',
    version: 1,
    storage: createJSONStorage(() => ({
        getItem: key => storage.getString(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: key => { storage.remove(key); },
    })),
    partialize: state => ({ artworkLayouts: state.artworkLayouts }),
}));
