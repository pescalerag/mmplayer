import { useCallback, useEffect, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { ArtistRankingService } from '../services/ArtistRankingService';
import { RatingSummary } from '../utils/trackRatings';
import { useDelayedLoader } from './useDelayedLoader';

export function useArtistRanking(enabled = true) {
  const focused = useIsFocused();
  const [data, setData] = useState<Map<string, RatingSummary>>(new Map());
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    if (!enabled || !focused) return;
    setLoading(true);
    setError(false);
    const subscription = ArtistRankingService.observe().subscribe({
      next: value => { setData(value); setLoading(false); },
      error: () => { setError(true); setLoading(false); },
    });
    return () => subscription.unsubscribe();
  }, [enabled, focused, attempt]);
  const showLoader = useDelayedLoader(enabled && loading, { delay: 250, minDisplayTime: 0 });
  return { data, error, loading: enabled && loading, showLoader, retry };
}
