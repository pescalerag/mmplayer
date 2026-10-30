/** Desktop does not have a native stack transition to wait for. Yield one paint,
 * then use bounded idle work so repeating UI animations cannot starve DB reads. */
export function scheduleScreenRefresh(refresh: () => void) {
  let cancelled = false;
  let idle: number | undefined;
  const frame = requestAnimationFrame(() => {
    idle = window.requestIdleCallback(
      () => {
        if (!cancelled) refresh();
      },
      { timeout: 120 },
    );
  });
  return () => {
    cancelled = true;
    cancelAnimationFrame(frame);
    if (idle !== undefined) window.cancelIdleCallback(idle);
  };
}
