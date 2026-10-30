export const DESKTOP_ZOOM = { min: 0.5, max: 1.3, step: 0.1 } as const;
export const DESKTOP_SPLIT_MIN_WIDTH = 72 + 280 + 290;

// Chromium handles zoom and OS DPI together. Window size must never change
// the user's zoom: it changes the logical viewport and triggers layout instead.
export function normalizeDesktopZoom(zoom = 1) {
  return Number.isFinite(zoom)
    ? Math.max(DESKTOP_ZOOM.min, Math.min(DESKTOP_ZOOM.max, zoom))
    : 1;
}

export function stepDesktopZoom(zoom: number, direction: number) {
  return normalizeDesktopZoom(Math.round((zoom + direction * DESKTOP_ZOOM.step) * 100) / 100);
}

export function desktopPanelLayout(width: number, sidebar: number, player: number, visible: boolean) {
  // Preserve the saved widths while making room for the central screen. At very
  // high zoom the right panel collapses temporarily, without changing preferences.
  const playerVisible = visible && width >= DESKTOP_SPLIT_MIN_WIDTH;
  const desiredSidebar = Math.min(sidebar, width - 280 - (playerVisible ? 290 : 0));
  const sidebarWidth = desiredSidebar < 150 ? 72 : desiredSidebar;
  const playerWidth = playerVisible ? Math.min(player, width - sidebarWidth - 280) : 0;
  return { sidebarWidth, playerWidth, playerVisible };
}
