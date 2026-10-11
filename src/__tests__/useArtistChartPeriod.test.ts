import React from 'react';
import { useArtistChartPeriod } from '../hooks/useArtistChartPeriod';

function createPeriodHarness() {
  const states: any[] = [];
  let index = 0;
  jest.spyOn(React, 'useState').mockImplementation(((initial: any) => {
    const current = index++;
    if (!(current in states)) states[current] = typeof initial === 'function' ? initial() : initial;
    return [states[current], (value: any) => { states[current] = typeof value === 'function' ? value(states[current]) : value; }];
  }) as any);
  jest.spyOn(React, 'useMemo').mockImplementation(factory => factory());
  return function usePeriodRender(first: Date | null) {
    index = 0;
    return useArtistChartPeriod(first, key => key === 'activity.locale_code' ? 'en-US' : key);
  };
}

describe('artist chart date controls', () => {
  const now = new Date(2026, 9, 11, 12);
  const first = new Date(2026, 9, 4, 8);
  let render: ReturnType<typeof createPeriodHarness>;
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    render = createPeriodHarness();
  });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  it('starts with all-time and disables date arrows until artist history is available', () => {
    const result = render(null);
    expect(result.period).toBe('all');
    expect(result.dateRangeInfo.from).toBeNull();
    expect(result.dateRangeInfo.to).toEqual(now);
    result.previous();
    result.next();
    expect(render(first).period).toBe('all');
  });

  it('navigates only from the artist first day through today and resets on period change', () => {
    render(first).changePeriod('day');
    expect(render(first).dateRangeInfo.canGoNext).toBe(false);
    render(first).next();
    expect(render(first).dateRangeInfo.from).toEqual(new Date(2026, 9, 11));
    render(first).previous();
    expect(render(first).dateRangeInfo.from).toEqual(new Date(2026, 9, 10));
    render(first).next();
    expect(render(first).dateRangeInfo.from).toEqual(new Date(2026, 9, 11));
    for (let day = 11; day > 4; day--) render(first).previous();
    expect(render(first).dateRangeInfo.canGoPrev).toBe(false);
    render(first).previous();
    expect(render(first).dateRangeInfo.from).toEqual(new Date(2026, 9, 4));
    render(first).changePeriod('month');
    expect(render(first).dateRangeInfo.from).toEqual(new Date(2026, 9, 1));
  });

  it('prevents backwards navigation before knowing the artist first listen', () => {
    render(null).changePeriod('day');
    render(null).previous();
    expect(render(null).dateRangeInfo.from).toEqual(new Date(2026, 9, 11));
  });

  it('applies and retains a custom range, and switches back to all-time', () => {
    const from = new Date(2026, 9, 5);
    const to = new Date(2026, 9, 8, 23, 59);
    render(first).applyCustomRange(from, to);
    const custom = render(first);
    expect(custom.period).toBe('custom');
    expect(custom.dateRangeInfo.from).toEqual(from);
    expect(custom.dateRangeInfo.to).toEqual(to);
    custom.changePeriod('all');
    expect(render(first).customFrom).toEqual(from);
    expect(render(first).customTo).toEqual(to);
  });
});
