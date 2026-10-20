import { useCallback, useRef, useState } from 'react';
import { useObservedRefresh } from './useObservedRefresh';
import { STAT_TABLES } from '../services/ScreenDataChanges';
import { ActivityChartsService, ActivityChartResult, TagChartFilter } from '../services/ActivityChartsService';
import { useDelayedLoader } from './useDelayedLoader';

interface ChartSnapshot {
  key: string;
  data: ActivityChartResult | null;
  error: boolean;
  loading: boolean;
}

async function fetchChartStats(from: Date | null, to: Date, artistId?: string, tagFilter?: TagChartFilter) {
  if (tagFilter) return ActivityChartsService.getStats(from, to, new Date(), undefined, tagFilter);
  if (artistId !== undefined) return ActivityChartsService.getStats(from, to, new Date(), artistId);
  return ActivityChartsService.getStats(from, to);
}

export function useActivityCharts(from: Date | null, to: Date, refreshKey: number, artistId?: string, enabled = true, tagFilter?: TagChartFilter) {
  const fromTime = from?.getTime() ?? null;
  const toTime = fromTime === null ? 0 : to.getTime();
  const tagId = tagFilter?.tagId;
  const tagScope = tagFilter?.scope;
  const key = `${fromTime}:${toTime}:${refreshKey}:${artistId}:${enabled}:${tagId}:${tagScope}`;
  const [snapshot, setSnapshot] = useState<ChartSnapshot>({ key, data: null, error: false, loading: true });
  const requestId = useRef(0);
  const isCurrent = snapshot.key === key;
  const isLoading = enabled && (!isCurrent || snapshot.loading);
  const showLoader = useDelayedLoader(isLoading, { delay: 250, minDisplayTime: 0 });

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!enabled) {
      setSnapshot({ key, data: null, error: false, loading: false });
      return;
    }
    const id = ++requestId.current;
    setSnapshot(previous => ({ key, data: previous.key === key ? previous.data : null, error: false, loading: previous.key !== key || !previous.data }));
    try {
      const fromDate = fromTime === null ? null : new Date(fromTime);
      const endDate = fromTime === null ? new Date() : new Date(toTime);
      const filter = tagId !== undefined && tagScope !== undefined ? { tagId, scope: tagScope } : undefined;
      const data = await fetchChartStats(fromDate, endDate, artistId, filter);
      if (!signal?.aborted && id === requestId.current) setSnapshot({ key, data, error: false, loading: false });
    } catch {
      if (!signal?.aborted && id === requestId.current) setSnapshot({ key, data: null, error: true, loading: false });
    }
  }, [key, fromTime, toTime, artistId, enabled, tagId, tagScope]);

  useObservedRefresh(load, STAT_TABLES, enabled);

  return {
    data: isCurrent ? snapshot.data : null,
    error: isCurrent && snapshot.error,
    isLoading, showLoader, reload: load,
  };
}
