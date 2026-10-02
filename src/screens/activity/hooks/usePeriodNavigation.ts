import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { HistoryService } from '../../../services/HistoryService';
import {
  Period,
  DateRangeInfo,
  calculateDateRangeInfo,
} from '../utils/activityDateUtils';

export function usePeriodNavigation(
  onLoadingChange: (loading: boolean) => void,
  t: (key: string) => string
) {
  const [period, setPeriod] = useState<Period>('week');
  const [dateOffset, setDateOffset] = useState<number>(0);
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date>(new Date());
  const [firstHistoryDate, setFirstHistoryDate] = useState<Date | null>(null);

  const activePeriodRef = useRef(period);
  activePeriodRef.current = period;
  const dateOffsetRef = useRef(dateOffset);
  dateOffsetRef.current = dateOffset;

  useEffect(() => {
    HistoryService.getFirstHistoryDate()
      .then((d) => setFirstHistoryDate(d))
      .catch((error) => {
        console.error('Failed to get first history date:', error);
      });
  }, []);

  const dateRangeInfo: DateRangeInfo = useMemo(
    () => calculateDateRangeInfo(period, dateOffset, firstHistoryDate, customFrom, customTo, t),
    [period, dateOffset, firstHistoryDate, customFrom, customTo, t]
  );

  const handlePrevPeriod = useCallback(() => {
    if (dateRangeInfo.canGoPrev) {
      onLoadingChange(true);
      setDateOffset((prev) => {
        const next = prev - 1;
        dateOffsetRef.current = next;
        return next;
      });
    }
  }, [dateRangeInfo.canGoPrev, onLoadingChange]);

  const handleNextPeriod = useCallback(() => {
    if (dateRangeInfo.canGoNext) {
      onLoadingChange(true);
      setDateOffset((prev) => {
        const next = prev + 1;
        dateOffsetRef.current = next;
        return next;
      });
    }
  }, [dateRangeInfo.canGoNext, onLoadingChange]);

  const handlePeriodChange = useCallback(
    (newPeriod: Period) => {
      if (newPeriod === activePeriodRef.current && dateOffsetRef.current === 0) {
        return;
      }
      activePeriodRef.current = newPeriod;
      dateOffsetRef.current = 0;
      onLoadingChange(true);
      setPeriod(newPeriod);
      setDateOffset(0);
    },
    [onLoadingChange]
  );

  const applyCustomRange = useCallback(
    (startDate: Date, endDate: Date) => {
      const isSameRange =
        activePeriodRef.current === 'custom' &&
        customFrom?.getTime() === startDate.getTime() &&
        customTo.getTime() === endDate.getTime() &&
        dateOffsetRef.current === 0;

      if (isSameRange) {
        return;
      }
      activePeriodRef.current = 'custom';
      dateOffsetRef.current = 0;
      onLoadingChange(true);
      setCustomFrom(startDate);
      setCustomTo(endDate);
      setPeriod('custom');
      setDateOffset(0);
    },
    [customFrom, customTo, onLoadingChange]
  );

  return {
    period,
    dateOffset,
    customFrom,
    customTo,
    firstHistoryDate,
    dateRangeInfo,
    handlePrevPeriod,
    handleNextPeriod,
    handlePeriodChange,
    applyCustomRange,
  };
}
