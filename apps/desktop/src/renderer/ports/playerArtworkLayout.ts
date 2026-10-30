import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { View } from "react-native";
import {
  calculatePlayerArtworkSize, calculatePlayerLyricsSlotHeight,
  type PlayerArtworkLayoutConfig,
} from "../../../../../src/store/usePlayerLayoutStore";

export function usePlayerArtworkLayout(config: PlayerArtworkLayoutConfig) {
  const artworkRegionRef = useRef<View>(null);
  const [height, setHeight] = useState(0);
  const onArtworkHeightMeasured = useCallback((value: number) => {
    if (Number.isFinite(value) && value > 0) setHeight(previous => Math.abs(previous - value) < 0.5 ? previous : value);
  }, []);
  useLayoutEffect(() => {
    const element = artworkRegionRef.current as unknown as HTMLElement | null;
    if (element?.getBoundingClientRect) onArtworkHeightMeasured(element.getBoundingClientRect().height);
    else artworkRegionRef.current?.measure((_x, _y, _width, value) => onArtworkHeightMeasured(value));
  }, [config.width, config.height, config.fontScale, onArtworkHeightMeasured]);
  const artworkSize = calculatePlayerArtworkSize(config, height || undefined);
  return {
    artworkRegionRef, artworkSize,
    lyricsSlotHeight: calculatePlayerLyricsSlotHeight(config, artworkSize, height),
    // An in-flight layout measurement must never hide existing desktop artwork.
    isLayoutReady: true,
    onArtworkHeightMeasured,
  };
}
