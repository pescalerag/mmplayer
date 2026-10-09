import { Easing, FadeIn, ReduceMotion } from 'react-native-reanimated';

export const CASCADE_ANIMATION_CONSTANTS = {
  DURATION_MS: 320,
  ITEM_STAGGER_MS: 40,
  TAG_STAGGER_MS: 36,
  MAX_STAGGER_ITEMS: 12,
  MAX_DELAY_MS: 240,
  ENTRY_WINDOW_MS: 240,
} as const;

const canAnimate = (index: number, maxItems: number) =>
  Number.isInteger(index) && index >= 0 && index < maxItems;

export function getStaggerDelay(
  index: number,
  staggerMs: number = CASCADE_ANIMATION_CONSTANTS.ITEM_STAGGER_MS,
  maxItems: number = CASCADE_ANIMATION_CONSTANTS.MAX_STAGGER_ITEMS
): number {
  return canAnimate(index, maxItems)
    ? Math.min(index * Math.max(0, staggerMs), CASCADE_ANIMATION_CONSTANTS.MAX_DELAY_MS)
    : 0;
}

export function getRowStaggerDelay(
  index: number,
  numColumns: number = 3,
  staggerMs: number = CASCADE_ANIMATION_CONSTANTS.ITEM_STAGGER_MS,
  maxItems: number = CASCADE_ANIMATION_CONSTANTS.MAX_STAGGER_ITEMS
): number {
  if (!canAnimate(index, maxItems)) return 0;
  const columns = Math.max(1, Math.floor(numColumns));
  return getStaggerDelay(Math.floor(index / columns), staggerMs, maxItems);
}

const fade = (delay: number, duration: number) => FadeIn
  .duration(duration)
  .delay(delay)
  .easing(Easing.out(Easing.quad))
  .reduceMotion(ReduceMotion.System);

// Cells outside the entry batch render immediately, including recycled cells.
export function getItemFadeIn(
  index: number,
  staggerMs: number = CASCADE_ANIMATION_CONSTANTS.ITEM_STAGGER_MS,
  maxItems: number = CASCADE_ANIMATION_CONSTANTS.MAX_STAGGER_ITEMS,
  durationMs: number = CASCADE_ANIMATION_CONSTANTS.DURATION_MS
) {
  return canAnimate(index, maxItems) ? fade(getStaggerDelay(index, staggerMs, maxItems), durationMs) : undefined;
}

export function getRowFadeIn(
  index: number,
  numColumns: number = 3,
  staggerMs: number = CASCADE_ANIMATION_CONSTANTS.ITEM_STAGGER_MS,
  maxItems: number = CASCADE_ANIMATION_CONSTANTS.MAX_STAGGER_ITEMS,
  durationMs: number = CASCADE_ANIMATION_CONSTANTS.DURATION_MS
) {
  return canAnimate(index, maxItems) ? fade(getRowStaggerDelay(index, numColumns, staggerMs, maxItems), durationMs) : undefined;
}

export function getTagFadeIn(
  index: number,
  staggerMs: number = CASCADE_ANIMATION_CONSTANTS.TAG_STAGGER_MS,
  maxItems: number = CASCADE_ANIMATION_CONSTANTS.MAX_STAGGER_ITEMS,
  durationMs: number = CASCADE_ANIMATION_CONSTANTS.DURATION_MS
) {
  return getItemFadeIn(index, staggerMs, maxItems, durationMs);
}

export function getSectionFadeIn(
  sectionIndex: number,
  staggerMs: number = CASCADE_ANIMATION_CONSTANTS.ITEM_STAGGER_MS,
  durationMs: number = CASCADE_ANIMATION_CONSTANTS.DURATION_MS
) {
  return getItemFadeIn(sectionIndex, staggerMs, CASCADE_ANIMATION_CONSTANTS.MAX_STAGGER_ITEMS, durationMs);
}

// Start when the first content arrives, rather than while its query is loading.
// Later sorts, refreshes and scroll mounts do not restart the entry animation.
export function createCascadeEntry(now: () => number = Date.now) {
  let startedAt: number | null = null;
  const isEntering = () => {
    startedAt ??= now();
    return now() - startedAt <= CASCADE_ANIMATION_CONSTANTS.ENTRY_WINDOW_MS;
  };
  return {
    item: (index: number) => isEntering() ? getItemFadeIn(index) : undefined,
    row: (index: number, columns = 3) => isEntering() ? getRowFadeIn(index, columns) : undefined,
    tag: (index: number) => isEntering() ? getTagFadeIn(index) : undefined,
    section: (index: number) => isEntering() ? getSectionFadeIn(index) : undefined,
  };
}
