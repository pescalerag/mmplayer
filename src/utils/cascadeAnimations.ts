import { FadeIn } from 'react-native-reanimated';

export const CASCADE_ANIMATION_CONSTANTS = {
  DURATION_MS: 300,
  ITEM_STAGGER_MS: 50,
  TAG_STAGGER_MS: 40,
  MAX_STAGGER_ITEMS: 15,
} as const;

/**
 * Calculates stagger delay for linear lists protecting FlashList recycling.
 */
export function getStaggerDelay(
  index: number,
  staggerMs: number = CASCADE_ANIMATION_CONSTANTS.ITEM_STAGGER_MS,
  maxItems: number = CASCADE_ANIMATION_CONSTANTS.MAX_STAGGER_ITEMS
): number {
  return index < maxItems ? index * staggerMs : 0;
}

/**
 * Calculates stagger delay for grid layouts row-by-row.
 */
export function getRowStaggerDelay(
  index: number,
  numColumns: number = 3,
  staggerMs: number = CASCADE_ANIMATION_CONSTANTS.ITEM_STAGGER_MS,
  maxItems: number = CASCADE_ANIMATION_CONSTANTS.MAX_STAGGER_ITEMS
): number {
  if (index >= maxItems) return 0;
  const rowIndex = Math.floor(index / numColumns);
  return rowIndex * staggerMs;
}

/**
 * Creates entering FadeIn animation for a list item with recycling protection.
 */
export function getItemFadeIn(
  index: number,
  staggerMs: number = CASCADE_ANIMATION_CONSTANTS.ITEM_STAGGER_MS,
  maxItems: number = CASCADE_ANIMATION_CONSTANTS.MAX_STAGGER_ITEMS,
  durationMs: number = CASCADE_ANIMATION_CONSTANTS.DURATION_MS
) {
  const delay = getStaggerDelay(index, staggerMs, maxItems);
  return FadeIn.duration(durationMs).delay(delay);
}

/**
 * Creates entering FadeIn animation for a grid row with recycling protection.
 */
export function getRowFadeIn(
  index: number,
  numColumns: number = 3,
  staggerMs: number = CASCADE_ANIMATION_CONSTANTS.ITEM_STAGGER_MS,
  maxItems: number = CASCADE_ANIMATION_CONSTANTS.MAX_STAGGER_ITEMS,
  durationMs: number = CASCADE_ANIMATION_CONSTANTS.DURATION_MS
) {
  const delay = getRowStaggerDelay(index, numColumns, staggerMs, maxItems);
  return FadeIn.duration(durationMs).delay(delay);
}

/**
 * Creates entering FadeIn animation for tags in grid/wrap layout (diagonal sweep).
 */
export function getTagFadeIn(
  index: number,
  staggerMs: number = CASCADE_ANIMATION_CONSTANTS.TAG_STAGGER_MS,
  maxItems: number = 25,
  durationMs: number = CASCADE_ANIMATION_CONSTANTS.DURATION_MS
) {
  const delay = index < maxItems ? index * staggerMs : 0;
  return FadeIn.duration(durationMs).delay(delay);
}

/**
 * Creates entering FadeIn animation for HomeScreen sections.
 */
export function getSectionFadeIn(
  sectionIndex: number,
  staggerMs: number = CASCADE_ANIMATION_CONSTANTS.ITEM_STAGGER_MS,
  durationMs: number = CASCADE_ANIMATION_CONSTANTS.DURATION_MS
) {
  return FadeIn.duration(durationMs).delay(sectionIndex * staggerMs);
}
