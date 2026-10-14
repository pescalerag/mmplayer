import { useEffect, useState } from 'react';
import { database } from '../database';
import Track from '../database/models/Track';
import { fileFormat } from '../utils/libraryFilters';

export function useFilterChoices(enabled: boolean) {
  const [choices, setChoices] = useState({ genres: [] as string[], formats: [] as string[], error: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    database.get<Track>('tracks').query().fetch().then(tracks => {
      if (!mounted) return;
      setChoices({ genres: [...new Set(tracks.map(track => track.genre?.trim()).filter((genre): genre is string => !!genre))].sort((a, b) => a.localeCompare(b)), formats: [...new Set(tracks.map(track => fileFormat(track.fileUrl)).filter(Boolean))].sort(), error: false });
    }).catch(() => { if (mounted) setChoices(previous => ({ ...previous, error: true })); });
    return () => { mounted = false; };
  }, [enabled, attempt]);
  return { ...choices, retry: () => setAttempt(value => value + 1) };
}
