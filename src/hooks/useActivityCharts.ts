import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityChartsService } from '../services/ActivityChartsService';
import { ActivityChartStats } from '../utils/activityCharts';
import { useDelayedLoader } from './useDelayedLoader';

interface ChartSnapshot {
  key: string;
  data: ActivityChartStats | null;
  error: boolean;
  loading: boolean;
}

export function useActivityCharts(from: Date | null, to: Date, refreshKey: number) {
  const fromTime = from?.getTime() ?? null;
  const toTime = to.getTime();
  const key = `${fromTime}:${toTime}:${refreshKey}`;
  const [snapshot, setSnapshot] = useState<ChartSnapshot>({ key, data: null, error: false, loading: true });
  const requestId = useRef(0);
  const isCurrent = snapshot.key === key;
  const isLoading = !isCurrent || snapshot.loading;
  const showLoader = useDelayedLoader(isLoading, { delay: 250, minDisplayTime: 0 });

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setSnapshot({ key, data: null, error: false, loading: true });
    try {
      const fromDate = fromTime === null ? null : new Date(fromTime);
      const endDate = fromTime === null ? new Date() : new Date(toTime);
      const data = await ActivityChartsService.getStats(fromDate, endDate);
      if (id === requestId.current) setSnapshot({ key, data, error: false, loading: false });
    } catch {
      if (id === requestId.current) setSnapshot({ key, data: null, error: true, loading: false });
    }
  }, [key, fromTime, toTime]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { requestId.current++; };
  }, [load]));

  return {
    data: isCurrent ? snapshot.data : null,
    error: isCurrent && snapshot.error,
    isLoading, showLoader, reload: load,
  };
}
