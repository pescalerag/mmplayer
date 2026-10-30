import React, { createContext, useContext } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

const ScreenWidthContext = createContext<{ width: number; height: number } | undefined>(undefined);
/** Embedded screens use their panel width; full-window mobile screens keep the window width. */
export function useScreenWidth() {
  const window = useWindowDimensions();
  return useContext(ScreenWidthContext)?.width ?? window.width;
}
export function useScreenDimensions() {
  const window = useWindowDimensions();
  const panel = useContext(ScreenWidthContext);
  return panel ? { ...window, ...panel } : window;
}
export function useLibraryGridLayout() {
  const screenWidth = useScreenWidth();
  const horizontalPadding = 40; // 20px left + 20px right
  const gap = 15;
  const availableWidth = Math.max(200, screenWidth - horizontalPadding);
  // Desktop uses Chromium's logical panel width, already adjusted for native
  // zoom. Do not multiply metrics again or mix them with devicePixelRatio.
  if (Platform.OS === 'web') {
    const available = Math.max(1, screenWidth - horizontalPadding);
    const desktopGap = 24;
    const columns = Math.max(1, Math.floor(available / (180 + desktopGap)));
    // FlashList gives each column an equal-width cell rather than a CSS gap.
    // Reserve half a gutter on each side of its centered card, even with one
    // or two columns, and avoid oversized covers when little content fits.
    const cardWidth = Math.max(1, Math.min(280, available / columns - desktopGap));
    return { screenWidth, numColumns: columns, cardWidth };
  }
  const numColumns =
    screenWidth < 480
      ? 3
      : Math.max(3, Math.floor((availableWidth + gap) / (125 + gap)));
  const cardWidth = Math.floor(
    (availableWidth - gap * (numColumns - 1)) / numColumns,
  );
  return { screenWidth, numColumns, cardWidth };
}
export const ScreenWidthProvider = ScreenWidthContext.Provider;
