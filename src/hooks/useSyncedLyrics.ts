import { useEffect, useMemo, useState, useRef } from 'react';
import Track from '../database/models/Track';
import { LyricsService, parseLRC } from '../services/LyricsService';
import { usePlayerStore } from '../store/usePlayerStore';
import TrackPlayer, { State } from 'react-native-track-player';
import { usePlaybackState } from './usePlaybackState';

export function useSyncedLyrics(track: Track | null) {
    const [isLocalLoading, setIsLocalLoading] = useState(false);
    const isFetchingLyrics = usePlayerStore(state => state.isFetchingLyrics);
    const speed = usePlayerStore(state => state.playbackSpeed);
    const isLoading = isLocalLoading || isFetchingLyrics;
    const playbackState = usePlaybackState();
    const isPlaying = playbackState.state === State.Playing;

    const parsedLyrics = useMemo(() => {
        return track?.lyricsLRC ? parseLRC(track.lyricsLRC) : [];
    }, [track?.lyricsLRC]);

    const isSynced = parsedLyrics.length > 0;

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
    }, [track?.id]);

    const lastIndexRef = useRef<number>(-1);
    const [activeIndex, setActiveIndex] = useState<number>(-1);

    const syncData = useRef({
        isPlaying: false,
        anchorPosition: 0,
        anchorDate: Date.now(),
        speed: 1.0,
    });

    useEffect(() => {
        syncData.current.speed = speed;
    }, [speed]);

    useEffect(() => {
        syncData.current.isPlaying = isPlaying;
        const syncAnchor = async () => {
            try {
                const { position } = await TrackPlayer.getProgress();
                syncData.current.anchorPosition = position;
                syncData.current.anchorDate = Date.now();
            } catch (e) {}
        };
        syncAnchor();
    }, [isPlaying]);

    useEffect(() => {
        lastIndexRef.current = -1;
        setActiveIndex(-1);
        syncData.current = {
            isPlaying,
            anchorPosition: 0,
            anchorDate: Date.now(),
            speed,
        };
        const syncAnchor = async () => {
            try {
                const { position } = await TrackPlayer.getProgress();
                syncData.current.anchorPosition = position;
                syncData.current.anchorDate = Date.now();
            } catch (e) {}
        };
        syncAnchor();
    }, [track?.id]);

    useEffect(() => {
        let frameId: number | null = null;
        let lastFrameTime = 0;

        const loop = (timestamp: number) => {
            const now = timestamp || Date.now();
            const elapsed = now - lastFrameTime;
            if (elapsed >= 33) {
                lastFrameTime = now;

                const data = syncData.current;
                let currentPos = data.anchorPosition;
                if (data.isPlaying) {
                    const timePassed = (Date.now() - data.anchorDate) / 1000;
                    currentPos = data.anchorPosition + timePassed * data.speed;
                }

                if (isSynced && parsedLyrics.length > 0) {
                    const total = parsedLyrics.length;
                    let index = -1;
                    const lastIdx = lastIndexRef.current;

                    if (lastIdx >= 0 && lastIdx < total) {
                        const currentLine = parsedLyrics[lastIdx];
                        const nextLine = lastIdx + 1 < total ? parsedLyrics[lastIdx + 1] : null;
                        if (currentPos >= currentLine.time && (!nextLine || currentPos < nextLine.time)) {
                            index = lastIdx;
                        }
                    }

                    if (index === -1 && lastIdx >= 0 && lastIdx + 1 < total) {
                        const nextLine = parsedLyrics[lastIdx + 1];
                        const afterNextLine = lastIdx + 2 < total ? parsedLyrics[lastIdx + 2] : null;
                        if (currentPos >= nextLine.time && (!afterNextLine || currentPos < afterNextLine.time)) {
                            index = lastIdx + 1;
                        }
                    }

                    if (index === -1) {
                        for (let i = 0; i < total; i++) {
                            if (currentPos >= parsedLyrics[i].time) {
                                index = i;
                            } else {
                                break;
                            }
                        }
                    }

                    lastIndexRef.current = index;
                    setActiveIndex(prev => {
                        if (prev !== index) {
                            return index;
                        }
                        return prev;
                    });
                } else {
                    setActiveIndex(prev => prev !== -1 ? -1 : prev);
                }
            }
            frameId = requestAnimationFrame(loop);
        };

        frameId = requestAnimationFrame(loop);

        const intervalId = setInterval(async () => {
            try {
                const state = await TrackPlayer.getPlaybackState();
                const { position } = await TrackPlayer.getProgress();
                const isPlayingReal = state.state === State.Playing;
                syncData.current.isPlaying = isPlayingReal;
                syncData.current.anchorPosition = position;
                syncData.current.anchorDate = Date.now();
            } catch (e) {}
        }, 1000);

        return () => {
            if (frameId !== null) {
                cancelAnimationFrame(frameId);
            }
            clearInterval(intervalId);
        };
    }, [isSynced, parsedLyrics]);

    return {
        parsedLyrics,
        activeIndex,
        isLoading,
        isSynced,
        lyricsText: track?.lyricsLRC || null,
    };
}

