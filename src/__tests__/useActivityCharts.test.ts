import React from 'react';
import { useActivityCharts } from '../hooks/useActivityCharts';
import { ActivityChartsService } from '../services/ActivityChartsService';
import { calculateActivityCharts } from '../utils/activityCharts';

jest.mock('../services/ActivityChartsService', () => ({ ActivityChartsService: { getStats: jest.fn() } }));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => jest.requireActual<typeof React>('react').useEffect(callback, [callback]),
}));

function changed(a?: React.DependencyList, b?: React.DependencyList) {
  return !a || !b || a.length !== b.length || a.some((value, index) => !Object.is(value, b[index]));
}

function createHarness() {
  const states: any[] = [];
  const refs: any[] = [];
  const callbacks: { callback: any; deps?: React.DependencyList }[] = [];
  const effects: { deps?: React.DependencyList; cleanup?: () => void }[] = [];
  let stateIndex = 0;
  let refIndex = 0;
  let callbackIndex = 0;
  let effectIndex = 0;
  let pending: (() => void)[] = [];

  jest.spyOn(React, 'useState').mockImplementation(((initial: any) => {
    const index = stateIndex++;
    if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
    return [states[index], (value: any) => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
  }) as any);
  jest.spyOn(React, 'useRef').mockImplementation(((initial: any) => {
    const index = refIndex++;
    refs[index] ??= { current: initial };
    return refs[index];
  }) as any);
  jest.spyOn(React, 'useCallback').mockImplementation((callback, deps) => {
    const index = callbackIndex++;
    if (changed(callbacks[index]?.deps, deps)) callbacks[index] = { callback, deps };
    return callbacks[index].callback;
  });
  jest.spyOn(React, 'useEffect').mockImplementation((callback, deps) => {
    const index = effectIndex++;
    const previous = effects[index];
    if (!changed(previous?.deps, deps)) return;
    pending.push(() => {
      previous?.cleanup?.();
      effects[index] = { deps, cleanup: callback() || undefined };
    });
  });
  return {
    render: function useChartsRender(from: Date | null, to: Date, refreshKey = 0, artistId?: string, enabled?: boolean) {
      stateIndex = refIndex = callbackIndex = effectIndex = 0;
      pending = [];
      const result = useActivityCharts(from, to, refreshKey, artistId, enabled);
      pending.forEach(effect => effect());
      return result;
    },
    dispose() { effects.forEach(effect => effect.cleanup?.()); },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

describe('chart loading lifecycle', () => {
  const from = new Date(2026, 9, 1);
  const to = new Date(2026, 9, 11, 12);
  const stats = calculateActivityCharts([{ playedAt: from, durationPlayed: 60 }], from, to, to);
  let harness: ReturnType<typeof createHarness>;
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(to);
    jest.clearAllMocks();
    (ActivityChartsService.getStats as jest.Mock).mockResolvedValue(stats);
    harness = createHarness();
  });
  afterEach(() => {
    harness.dispose();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('does not flash a loader for a query completing before 250ms', async () => {
    expect(harness.render(from, to).showLoader).toBe(false);
    await jest.advanceTimersByTimeAsync(100);
    const result = harness.render(from, to);
    expect(result.data).toBe(stats);
    expect(result.isLoading).toBe(false);
    await jest.advanceTimersByTimeAsync(500);
    expect(harness.render(from, to).showLoader).toBe(false);
    expect(ActivityChartsService.getStats).toHaveBeenCalledTimes(1);
  });

  it('queries nothing while folded and reloads the artist when reopened', async () => {
    expect(harness.render(from, to, 0, 'artist-a', false).isLoading).toBe(false);
    await jest.advanceTimersByTimeAsync(500);
    expect(ActivityChartsService.getStats).not.toHaveBeenCalled();
    await harness.render(from, to, 0, 'artist-a', false).reload();
    expect(ActivityChartsService.getStats).not.toHaveBeenCalled();
    harness.render(from, to, 0, 'artist-a');
    await jest.advanceTimersByTimeAsync(0);
    expect(ActivityChartsService.getStats).toHaveBeenLastCalledWith(from, to, new Date(to.getTime() + 500), 'artist-a');
    expect(harness.render(from, to, 0, 'artist-a').data).toBe(stats);
    harness.render(from, to, 0, 'artist-a', false);
    expect(harness.render(from, to, 0, 'artist-a').data).toBeNull();
    await jest.advanceTimersByTimeAsync(0);
    expect(ActivityChartsService.getStats).toHaveBeenCalledTimes(2);
  });

  it('does not reload all-time charts when first-listen metadata updates the displayed date range', async () => {
    harness.render(null, to, 0, 'artist-a');
    await jest.advanceTimersByTimeAsync(1);
    const changedEnd = new Date(to.getTime() + 1);
    expect(harness.render(null, changedEnd, 0, 'artist-a').data).toBe(stats);
    await jest.advanceTimersByTimeAsync(0);
    expect(ActivityChartsService.getStats).toHaveBeenCalledTimes(1);
  });

  it('discards artist data arriving after folding or switching artist', async () => {
    const old = deferred<typeof stats>();
    (ActivityChartsService.getStats as jest.Mock).mockReturnValueOnce(old.promise);
    harness.render(from, to, 0, 'artist-a');
    harness.render(from, to, 0, 'artist-a', false);
    harness.render(from, to, 0, 'artist-b');
    await jest.advanceTimersByTimeAsync(0);
    old.resolve({ ...stats, averageMinutes: 99 });
    await jest.advanceTimersByTimeAsync(0);
    expect(harness.render(from, to, 0, 'artist-b').data).toBe(stats);
    expect(ActivityChartsService.getStats).toHaveBeenLastCalledWith(from, to, to, 'artist-b');
  });

  it('shows the loader at 250ms and removes it when the slow query finishes', async () => {
    const slow = deferred<typeof stats>();
    (ActivityChartsService.getStats as jest.Mock).mockReturnValueOnce(slow.promise);
    harness.render(from, to);
    await jest.advanceTimersByTimeAsync(249);
    expect(harness.render(from, to).showLoader).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(harness.render(from, to).showLoader).toBe(true);
    slow.resolve(stats);
    await jest.advanceTimersByTimeAsync(0);
    expect(harness.render(from, to).isLoading).toBe(false);
    expect(harness.render(from, to).showLoader).toBe(false);
  });

  it('never displays old-period data or lets an old request overwrite the new period', async () => {
    const old = deferred<typeof stats>();
    const recent = { ...stats, averageMinutes: 99 };
    (ActivityChartsService.getStats as jest.Mock).mockReturnValueOnce(old.promise).mockResolvedValueOnce(recent);
    harness.render(from, to);
    const nextFrom = new Date(2026, 9, 5);
    const next = harness.render(nextFrom, to);
    expect(next.isLoading).toBe(true);
    expect(next.data).toBeNull();
    await jest.advanceTimersByTimeAsync(0);
    old.resolve(stats);
    await jest.advanceTimersByTimeAsync(0);
    expect(harness.render(nextFrom, to).data).toBe(recent);
  });

  it('ignores a rejected old request after the period changes', async () => {
    const old = deferred<typeof stats>();
    (ActivityChartsService.getStats as jest.Mock).mockReturnValueOnce(old.promise);
    harness.render(from, to);
    const nextFrom = new Date(2026, 9, 6);
    harness.render(nextFrom, to);
    old.reject(new Error('old error'));
    await jest.advanceTimersByTimeAsync(0);
    const result = harness.render(nextFrom, to);
    expect(result.error).toBe(false);
    expect(result.data).toBe(stats);
  });

  it('shows failures explicitly and allows retry', async () => {
    (ActivityChartsService.getStats as jest.Mock).mockRejectedValueOnce(new Error('db'));
    harness.render(from, to);
    await jest.advanceTimersByTimeAsync(0);
    const failed = harness.render(from, to);
    expect(failed.error).toBe(true);
    expect(failed.isLoading).toBe(false);
    expect(failed.data).toBeNull();
    await failed.reload();
    const recovered = harness.render(from, to);
    expect(recovered.data).toBe(stats);
    expect(recovered.error).toBe(false);
  });

  it('reloads on pull-to-refresh and queries all-time through the current instant', async () => {
    harness.render(null, to);
    await jest.advanceTimersByTimeAsync(0);
    jest.setSystemTime(new Date(2026, 9, 11, 13));
    expect(harness.render(null, to, 1).data).toBeNull();
    await jest.advanceTimersByTimeAsync(0);
    expect(ActivityChartsService.getStats).toHaveBeenLastCalledWith(null, new Date(2026, 9, 11, 13));
    expect(harness.render(null, to, 1).data).toBe(stats);
  });

  it('discards data arriving after unmount and cancels the delayed loader', async () => {
    const slow = deferred<typeof stats>();
    (ActivityChartsService.getStats as jest.Mock).mockReturnValueOnce(slow.promise);
    harness.render(from, to);
    harness.dispose();
    slow.resolve(stats);
    await jest.advanceTimersByTimeAsync(500);
    expect(harness.render(from, to).data).toBeNull();
    expect(harness.render(from, to).showLoader).toBe(false);
  });
});
