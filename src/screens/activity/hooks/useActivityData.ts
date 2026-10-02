import { useState, useCallback, useRef } from 'react';
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

export function useActivityData(
  period: Period,
  metric: Metric,
  from: Date | null,
  to: Date
) {
  const [detailedStats, setDetailedStats] = useState<DetailedStats>(EMPTY_DETAILED_STATS);
  const [isLoading, setIsLoading] = useState(true);
  const showLoader = useDelayedLoader(isLoading, { delay: 250, minDisplayTime: 500 });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [smartLists, setSmartLists] = useState<SmartListItem[]>([]);
  const latestFetchId = useRef(0);

  const loadStatsSmartLists = useCallback(async () => {
    try {
      const lists = SmartListService.getSmartLists();
      const loaded = await Promise.all(
        lists.map(async (list) => {
          const tracks = await list.getTracks();
          return {
            id: list.id,
            name: list.name,
            placeholderIcon: list.placeholderIcon,
            trackCount: tracks.length,
          };
        })
      );
      setSmartLists(loaded);
    } catch (e) {
      console.error('[ActivityMainScreen] Error loading smart lists:', e);
    }
  }, []);

  const fetchStats = useCallback(
    async (isRefresh = false) => {
      const fetchId = ++latestFetchId.current;
      if (!isRefresh) {
        setIsLoading(true);
      }
      try {
        const result = await HistoryService.getDetailedStatsForPeriod(period, metric, from, to);
        if (fetchId === latestFetchId.current) {
          setDetailedStats(result);
        }
      } catch (err) {
        console.error('[ActivityMainScreen] Failed to fetch stats:', err);
        if (fetchId === latestFetchId.current) {
          setDetailedStats(EMPTY_DETAILED_STATS);
        }
      } finally {
        if (fetchId === latestFetchId.current) {
          setIsLoading(false);
        }
      }
    },
    [period, metric, from, to]
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([fetchStats(true), loadStatsSmartLists()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchStats, loadStatsSmartLists]);

  useFocusEffect(
    useCallback(() => {
      void fetchStats();
      void loadStatsSmartLists();
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
