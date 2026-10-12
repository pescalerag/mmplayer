import { formatCompactChartTick, getCompactChartLayout } from '../utils/activityChartLayout';

describe('compact chart layout', () => {
  it.each([1, 7, 12, 24, 28, 29, 30, 31])('fits all %s bars on small and large screens without horizontal overflow', count => {
    for (const width of [180, 264, 340, 700]) {
      const layout = getCompactChartLayout(width, count);
      expect(layout.barWidth).toBeGreaterThan(0);
      expect(layout.barWidth * count + layout.gap * (count - 1)).toBeCloseTo(width);
      expect(layout.ticks.length).toBeLessThanOrEqual(count);
      expect(new Set(layout.ticks.map(tick => tick.index)).size).toBe(layout.ticks.length);
      for (const tick of layout.ticks) {
        expect(tick.index).toBeGreaterThanOrEqual(0);
        expect(tick.index).toBeLessThan(count);
        expect(tick.left).toBeGreaterThanOrEqual(0);
        expect(tick.left + tick.width).toBeLessThanOrEqual(width);
      }
    }
  });

  it('labels both ends of a month while keeping the axis sparse', () => {
    const { ticks } = getCompactChartLayout(264, 31);
    expect(ticks).toHaveLength(6);
    expect(ticks[0].index).toBe(0);
    expect(ticks[ticks.length - 1].index).toBe(30);
  });

  it('handles empty charts and the initial render before width measurement', () => {
    expect(getCompactChartLayout(264, 0)).toEqual({ barWidth: 0, gap: 0, ticks: [] });
    expect(getCompactChartLayout(0, 31)).toEqual({ barWidth: 0, gap: 0, ticks: [] });
    expect(getCompactChartLayout(-20, 7)).toEqual({ barWidth: 0, gap: 0, ticks: [] });
  });

  it('keeps labels within a very narrow container', () => {
    const { ticks } = getCompactChartLayout(20, 31);
    expect(ticks).toEqual([{ index: 0, left: 0, width: 20 }]);
  });

  it('uses short localised labels for hours, days and months', () => {
    expect(formatCompactChartTick(0, 'hour', 'es-ES')).toBe('00');
    expect(formatCompactChartTick(23, 'hour', 'en-US')).toBe('23');
    const key = new Date(2026, 9, 11).getTime();
    expect(formatCompactChartTick(key, 'day', 'pt-BR')).toBe('11');
    for (const locale of ['es-ES', 'en-US', 'pt-BR']) {
      expect(formatCompactChartTick(key, 'month', locale)).toBe(new Date(key).toLocaleDateString(locale, { month: 'short' }));
    }
  });
});
