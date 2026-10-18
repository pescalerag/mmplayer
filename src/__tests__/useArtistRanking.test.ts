import React from 'react';
import { Subject } from 'rxjs';
import { useIsFocused } from '@react-navigation/native';
import { useArtistRanking } from '../hooks/useArtistRanking';
import { ArtistRankingService } from '../services/ArtistRankingService';

jest.mock('../services/ArtistRankingService', () => ({ ArtistRankingService: { observe: jest.fn() } }));
jest.mock('@react-navigation/native', () => ({ useIsFocused: jest.fn(() => true) }));

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
    render: function useRankingRender(enabled?: boolean) {
      stateIndex = refIndex = callbackIndex = effectIndex = 0;
      pending = [];
      const result = useArtistRanking(enabled);
      pending.forEach(effect => effect());
      return result;
    },
    dispose() { effects.forEach(effect => effect.cleanup?.()); },
  };
}

describe('artist ranking subscription lifecycle', () => {
  let harness: ReturnType<typeof createHarness>;
  let source: Subject<Map<string, any>>;
  beforeEach(() => {
    jest.useFakeTimers(); jest.clearAllMocks();
    (useIsFocused as jest.Mock).mockReturnValue(true);
    source = new Subject<Map<string, any>>();
    (ArtistRankingService.observe as jest.Mock).mockImplementation(() => source);
    harness = createHarness();
  });
  afterEach(() => { harness.dispose(); jest.restoreAllMocks(); jest.useRealTimers(); });

  it('subscribes only when enabled and focused, and releases the observer on blur', () => {
    harness.render(false);
    expect(ArtistRankingService.observe).not.toHaveBeenCalled();
    (useIsFocused as jest.Mock).mockReturnValue(false);
    harness.render(true);
    expect(ArtistRankingService.observe).not.toHaveBeenCalled();
    (useIsFocused as jest.Mock).mockReturnValue(true);
    harness.render(true);
    expect(source.observed).toBe(true);
    (useIsFocused as jest.Mock).mockReturnValue(false);
    harness.render(true);
    expect(source.observed).toBe(false);
    (useIsFocused as jest.Mock).mockReturnValue(true);
    harness.render(true);
    expect(ArtistRankingService.observe).toHaveBeenCalledTimes(2);
    harness.render(false);
    expect(source.observed).toBe(false);
  });

  it('delays the loader by 250ms and accepts subsequent live ranking updates', () => {
    expect(harness.render().showLoader).toBe(false);
    jest.advanceTimersByTime(249);
    expect(harness.render().showLoader).toBe(false);
    jest.advanceTimersByTime(1);
    expect(harness.render().showLoader).toBe(true);
    const result = new Map([['artist', { average: 5, ratedCount: 1, totalCount: 2 }]]);
    source.next(result);
    expect(harness.render().data).toBe(result);
    expect(harness.render().loading).toBe(false);
    expect(harness.render().showLoader).toBe(false);
    source.next(new Map());
    expect(harness.render().data).toEqual(new Map());
  });

  it('does not show a loader for fast reads and cleans up on unmount', () => {
    harness.render();
    jest.advanceTimersByTime(100);
    source.next(new Map()); harness.render();
    jest.advanceTimersByTime(500);
    expect(harness.render().showLoader).toBe(false);
    harness.dispose();
    expect(source.observed).toBe(false);
  });

  it('reports errors and resubscribes on retry without accepting old data', () => {
    harness.render(); source.error(new Error('unavailable'));
    const failed = harness.render();
    expect(failed.error).toBe(true); expect(failed.loading).toBe(false);
    source = new Subject<Map<string, any>>();
    failed.retry(); harness.render();
    expect(harness.render().error).toBe(false);
    expect(source.observed).toBe(true);
    source.next(new Map());
    expect(harness.render().loading).toBe(false);
  });
});
