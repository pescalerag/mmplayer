import { useState, useCallback } from 'react';
import { database } from '../database';
import Track from '../database/models/Track';
import { useObservedRefresh } from './useObservedRefresh';
import { fileFormat } from '../utils/libraryFilters';

export function useFilterChoices(enabled: boolean) {
  const [choices, setChoices] = useState({ genres: [] as string[], formats: [] as string[], error: false });
  const [attempt, setAttempt] = useState(0);
  const load = useCallback(async (signal: AbortSignal) => {
    await database.get<Track>('tracks').query().fetch().then(tracks => {
      if (signal.aborted) return;
      setChoices({ genres: [...new Set(tracks.map(track => track.genre?.trim()).filter((genre): genre is string => !!genre))].sort((a, b) => a.localeCompare(b)), formats: [...new Set(tracks.map(track => fileFormat(track.fileUrl)).filter(Boolean))].sort((a, b) => a.localeCompare(b)), error: false });
    }).catch(() => { if (!signal.aborted) setChoices(previous => ({ ...previous, error: true })); });
  }, [attempt]);
  useObservedRefresh(load, ['tracks'], enabled);
  return { ...choices, retry: () => setAttempt(value => value + 1) };
}
