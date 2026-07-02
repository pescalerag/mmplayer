import { useEffect, useMemo, useState, useRef } from 'react';
import Track from '../database/models/Track';
import { LyricsService, parseLRC } from '../services/LyricsService';
import { usePlayerStore } from '../store/usePlayerStore';

export function useSyncedLyrics(track: Track | null, currentTime: number) {
    const [isLocalLoading, setIsLocalLoading] = useState(false);
    const isFetchingLyrics = usePlayerStore(state => state.isFetchingLyrics);
    const isLoading = isLocalLoading || isFetchingLyrics;

    // Sync parsedLyrics with track.lyricsLRC (reactive from WatermelonDB)
    const parsedLyrics = useMemo(() => {
        return track?.lyricsLRC ? parseLRC(track.lyricsLRC) : [];
    }, [track?.lyricsLRC]);

    const isSynced = parsedLyrics.length > 0;

    // Fetch lyrics if track changes and lyrics are not in DB
    useEffect(() => {
        if (!track) return;
        if (track.lyricsLRC) {
            setIsLocalLoading(false);
            return;
        }

        let isMounted = true;
        setIsLocalLoading(true);

        LyricsService.fetchLyrics(track)
            .catch(err => {
                console.error("[useSyncedLyrics] Error loading lyrics:", err);
            })
            .finally(() => {
                if (isMounted) {
                    setIsLocalLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [track?.id]);

    const lastIndexRef = useRef<number>(-1);

    // Reset lastIndexRef when track changes to avoid stale indexing
    useEffect(() => {
        lastIndexRef.current = -1;
    }, [track?.id]);

    // Optimize active index lookup using the last known active index
    const activeIndex = useMemo(() => {
        if (!isSynced) return -1;

        const lastIdx = lastIndexRef.current;
        const total = parsedLyrics.length;

        // 1. Fast path: check if we are still within the same line
        if (lastIdx >= 0 && lastIdx < total) {
            const currentLine = parsedLyrics[lastIdx];
            const nextLine = lastIdx + 1 < total ? parsedLyrics[lastIdx + 1] : null;

            if (currentTime >= currentLine.time && (!nextLine || currentTime < nextLine.time)) {
                return lastIdx;
            }
        }

        // 2. Slow path: fallback search from 0
        let index = -1;
        for (let i = 0; i < total; i++) {
            if (currentTime >= parsedLyrics[i].time) {
                index = i;
            } else {
                break;
            }
        }

        lastIndexRef.current = index;
        return index;
    }, [currentTime, parsedLyrics, isSynced]);

    return {
        parsedLyrics,
        activeIndex,
        isLoading,
        isSynced,
        lyricsText: track?.lyricsLRC || null,
    };
}
