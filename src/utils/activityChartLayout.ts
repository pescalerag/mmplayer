import { ChartGranularity } from './activityCharts';

export interface ChartTick {
  index: number;
  left: number;
  width: number;
}

/** Keep every bar visible, while spacing tick labels independently of the bars. */
export function getCompactChartLayout(width: number, count: number) {
  const availableWidth = Math.max(0, width);
  if (count <= 0 || availableWidth === 0) return { barWidth: 0, gap: 0, ticks: [] as ChartTick[] };
  const gap = Math.min(6, availableWidth / count * 0.2);
  const barWidth = (availableWidth - gap * (count - 1)) / count;
  const tickWidth = Math.min(36, availableWidth);
  const tickCount = Math.min(count, Math.max(1, Math.floor(availableWidth / 44)));
  const ticks = Array.from({ length: tickCount }, (_, position) => {
    const index = tickCount === 1 ? 0 : Math.round(position * (count - 1) / (tickCount - 1));
    const center = index * (barWidth + gap) + barWidth / 2;
    return { index, width: tickWidth, left: Math.max(0, Math.min(availableWidth - tickWidth, center - tickWidth / 2)) };
  });
  return { barWidth, gap, ticks };
}

export function formatCompactChartTick(key: number, granularity: ChartGranularity, locale: string): string {
  if (granularity === 'hour') return String(key).padStart(2, '0');
  const date = new Date(key);
  if (granularity === 'day') return String(date.getDate());
  return date.toLocaleDateString(locale, { month: 'short' });
}
