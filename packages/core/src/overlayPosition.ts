export interface OverlayAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}
/** Place floating menus inside the viewport, flipping nested menus when needed. */
export function positionOverlay(
  anchor: OverlayAnchor,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  nested = false,
  preferredSide: "left" | "right" = "right",
) {
  const margin = 8;
  const width = Math.min(size.width, Math.max(0, viewport.width - margin * 2));
  const height = Math.min(
    size.height,
    Math.max(0, viewport.height - margin * 2),
  );
  let left = anchor.x;
  if (nested) {
    left =
      preferredSide === "left"
        ? anchor.x - width - 4
        : anchor.x + anchor.width + 4;
  }
  if (left < margin && nested) left = anchor.x + anchor.width + 4;
  if (left + width > viewport.width - margin)
    left = nested ? anchor.x - width - 4 : viewport.width - width - margin;
  const top = Math.max(
    margin,
    Math.min(
      nested ? anchor.y : anchor.y + anchor.height,
      viewport.height - height - margin,
    ),
  );
  return { left: Math.max(margin, Math.min(left, viewport.width - width - margin)), top, width, maxHeight: height };
}
