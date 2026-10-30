import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { View } from 'react-native';
import {
    calculatePlayerArtworkSize, calculatePlayerLyricsSlotHeight, getPlayerArtworkLayoutKey, PlayerArtworkLayoutConfig,
    usePlayerLayoutStore,
} from '../store/usePlayerLayoutStore';

export function usePlayerArtworkLayout(config: PlayerArtworkLayoutConfig) {
    const key = getPlayerArtworkLayoutKey(config);
    const artworkRegionRef = useRef<View>(null);
    const committedKey = useRef(key);
    useLayoutEffect(() => { committedKey.current = key; }, [key]);
    const cached = usePlayerLayoutStore(state => state.artworkLayouts[key]);
    const layout = useMemo(() => cached ?? {
        size: calculatePlayerArtworkSize(config), measuredHeight: 0,
    }, [cached, config]);

    // Never publish store updates during render. A measured result that arrives
    // before this effect must not be replaced by the initial estimate.
    useEffect(() => {
        if (!cached) usePlayerLayoutStore.getState().rememberEstimate(key, layout.size);
    }, [cached, key, layout.size]);

    const onArtworkHeightMeasured = useCallback((height: number) => {
        if (committedKey.current !== key) return;
        usePlayerLayoutStore.getState().recordMeasurement(config, height);
    }, [config, key]);

    // A parent can change the configuration without resizing this child. RN Web
    // also delivers layout measurements asynchronously: never attach an old
    // callback's measurement to the wrong geometry, and explicitly remeasure.
    useLayoutEffect(() => {
        artworkRegionRef.current?.measure((_x, _y, _width, height) => {
            onArtworkHeightMeasured(height);
        });
    }, [onArtworkHeightMeasured]);

    return {
        artworkRegionRef,
        artworkSize: layout.size,
        lyricsSlotHeight: calculatePlayerLyricsSlotHeight(config, layout.size, layout.measuredHeight),
        isLayoutReady: layout.measuredHeight > 0,
        onArtworkHeightMeasured,
    };
}
