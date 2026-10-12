import { useMemo, useState } from 'react';
import { calculateDateRangeInfo, Period } from '../screens/activity/utils/activityDateUtils';

export function useArtistChartPeriod(firstHistoryDate: Date | null, t: (key: string) => string) {
  const [period, setPeriod] = useState<Period>('all');
  const [dateOffset, setDateOffset] = useState(0);
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState(() => new Date());
  const firstTime = firstHistoryDate?.getTime() ?? null;
  const dateRangeInfo = useMemo(() => calculateDateRangeInfo(
    period, dateOffset, firstTime === null ? null : new Date(firstTime), customFrom, customTo, t,
  ), [period, dateOffset, firstTime, customFrom, customTo, t]);
  const changePeriod = (next: Period) => { setPeriod(next); setDateOffset(0); };
  const previous = () => { if (dateRangeInfo.canGoPrev) setDateOffset(value => value - 1); };
  const next = () => { if (dateRangeInfo.canGoNext) setDateOffset(value => value + 1); };
  const applyCustomRange = (from: Date, to: Date) => {
    setCustomFrom(from);
    setCustomTo(to);
    changePeriod('custom');
  };
  return { period, dateRangeInfo, customFrom, customTo, changePeriod, previous, next, applyCustomRange };
}
