import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';

export interface PlayerArtworkLayoutConfig {
    width: number;
    height: number;
    topInset: number;
    bottomInset: number;
    fontScale: number;
    artworkPadding?: number;
}

interface ArtworkLayout {
    size: number;
    measuredHeight: number;
}

export const getPlayerArtworkLayoutKey = (config: PlayerArtworkLayoutConfig) => [
    config.width, config.height, config.topInset, config.bottomInset, config.fontScale, config.artworkPadding ?? 28,
].join(':');

export function calculatePlayerArtworkSize(config: PlayerArtworkLayoutConfig, availableHeight?: number) {
    // The normal artwork width is screen width minus 32 points on each side.
    // A guessed height for the controls must not permanently shrink the cover;
    // the lyrics slot yields space instead.
    const preferred = Math.max(0, config.width - 64);
    return availableHeight === undefined ? preferred
        : Math.min(preferred, Math.max(0, availableHeight - (config.artworkPadding ?? 28)));
}

export function calculatePlayerLyricsSlotHeight(config: PlayerArtworkLayoutConfig, size: number, availableHeight: number) {
    return Math.min(58, Math.max(0, availableHeight - size - (config.artworkPadding ?? 28)));
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
        // This is the combined artwork/lyrics region. Its height is independent
        // of whether the current song has lyrics.
        if (previous && Math.abs(previous.measuredHeight - height) <= 2) return state;
        return {
            artworkLayouts: cacheLayout(state.artworkLayouts, key, {
                size: calculatePlayerArtworkSize(config, height), measuredHeight: height,
            }),
        };
    }),
}), {
    name: 'player-artwork-layout',
    version: 3,
    // Older measurements were of the artwork alone, not its available region.
    migrate: () => ({ artworkLayouts: {} }),
    storage: createJSONStorage(() => ({
        getItem: key => storage.getString(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: key => { storage.remove(key); },
    })),
    partialize: state => ({ artworkLayouts: state.artworkLayouts }),
}));
