import { useState, useCallback, useRef } from 'react';
import { RetainedResource } from '@/utils/retainedResource';
import { useFocusEffect } from '@react-navigation/native';
import { HistoryService } from '../../../services/HistoryService';
import { SmartListService } from '../../../services/SmartListService';
import { useDelayedLoader } from '@/hooks/useDelayedLoader';
import { Period } from '../utils/activityDateUtils';
import {
  Metric,
  DetailedStats,
  SmartListItem,
  EMPTY_DETAILED_STATS,
} from '../utils/activityStatUtils';

const statsResource = new RetainedResource<DetailedStats>();
const smartListsResource = new RetainedResource<SmartListItem[]>(2);

export function useActivityData(
  period: Period,
  metric: Metric,
  from: Date | null,
  to: Date
) {
  const fromTime = from?.getTime() ?? null;
  const toTime = to.getTime();
  const key = `${period}:${metric}:${fromTime}:${period === 'all' ? to.toDateString() : toTime}`;
  const [snapshot, setSnapshot] = useState(() => ({ key, data: statsResource.read(key) }));
  const [pending, setIsLoading] = useState(true);
  const data = snapshot.key === key ? snapshot.data : statsResource.read(key);
  const isLoading = data === undefined && (pending || snapshot.key !== key);
  const detailedStats = data ?? EMPTY_DETAILED_STATS;
  const showLoader = useDelayedLoader(isLoading, { delay: 150, minDisplayTime: 0 });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lists = SmartListService.getSmartLists();
  const listsKey = lists.map(list => `${list.id}:${list.name}`).join('|');
  const [smartLists, setSmartLists] = useState<SmartListItem[]>(() => smartListsResource.read(listsKey) ?? []);
  const latestFetchId = useRef(0);
  const latestListsId = useRef(0);

  const loadStatsSmartLists = useCallback(async () => {
    const fetchId = ++latestListsId.current;
    try {
      const loaded = await smartListsResource.load(listsKey, () => Promise.all(
        SmartListService.getSmartLists().map(async list => ({
          id: list.id,
          name: list.name,
          placeholderIcon: list.placeholderIcon,
          trackCount: (await list.getTracks()).length,
        }))
      ));
      if (fetchId === latestListsId.current) setSmartLists(loaded);
    } catch (e) {
      console.error('[ActivityMainScreen] Error loading smart lists:', e);
    }
  }, [listsKey]);

  const fetchStats = useCallback(async () => {
    const fetchId = ++latestFetchId.current;
    setIsLoading(true);
    try {
      const result = await statsResource.load(key, () => HistoryService.getDetailedStatsForPeriod(
        period, metric, fromTime === null ? null : new Date(fromTime), new Date(toTime)
      ));
      if (fetchId === latestFetchId.current) setSnapshot({ key, data: result });
    } catch (err) {
      console.error('[ActivityMainScreen] Failed to fetch stats:', err);
      if (fetchId === latestFetchId.current) {
        setSnapshot({ key, data: statsResource.read(key) ?? EMPTY_DETAILED_STATS });
      }
    } finally {
      if (fetchId === latestFetchId.current) setIsLoading(false);
    }
  }, [key, period, metric, fromTime, toTime]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([fetchStats(), loadStatsSmartLists()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchStats, loadStatsSmartLists]);

  useFocusEffect(
    useCallback(() => {
      void fetchStats();
      void loadStatsSmartLists();
      return () => {
        latestFetchId.current++;
        latestListsId.current++;
      };
    }, [fetchStats, loadStatsSmartLists])
  );

  return {
    detailedStats,
    isLoading,
    setIsLoading,
    showLoader,
    isRefreshing,
    smartLists,
    handleRefresh,
  };
}
