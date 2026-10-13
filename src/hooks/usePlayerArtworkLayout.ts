import { useCallback, useEffect, useMemo } from 'react';
import {
    calculatePlayerArtworkSize, calculatePlayerLyricsSlotHeight, getPlayerArtworkLayoutKey, PlayerArtworkLayoutConfig,
    usePlayerLayoutStore,
} from '../store/usePlayerLayoutStore';

export function usePlayerArtworkLayout(config: PlayerArtworkLayoutConfig) {
    const key = getPlayerArtworkLayoutKey(config);
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
        usePlayerLayoutStore.getState().recordMeasurement(config, height);
    }, [config]);

    return {
        artworkSize: layout.size,
        lyricsSlotHeight: calculatePlayerLyricsSlotHeight(config, layout.size, layout.measuredHeight),
        isLayoutReady: layout.measuredHeight > 0,
        onArtworkHeightMeasured,
    };
}
