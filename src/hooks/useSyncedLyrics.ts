import { useEffect, useMemo, useState, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import Track from '../database/models/Track';
import { LyricsService, parseLRC } from '../services/LyricsService';
import { usePlayerStore } from '../store/usePlayerStore';
import TrackPlayer, { State } from 'react-native-track-player';
import { usePlaybackState } from './usePlaybackState';

const sanitizePos = (pos: any): number => {
    return (typeof pos === 'number' && !isNaN(pos) && isFinite(pos) && pos >= 0) ? pos : 0;
};

export function useSyncedLyrics(track: Track | null) {
    const [prevTrackId, setPrevTrackId] = useState<string | null>(track?.id ?? null);
    const [activeIndex, setActiveIndex] = useState<number>(-1);

    // Synchronous reset during render if track changes so that new track lyrics
    // never get indexed with the previous track's activeIndex for even a single frame
    let effectiveActiveIndex = activeIndex;
    if (track?.id !== prevTrackId) {
        setPrevTrackId(track?.id ?? null);
        setActiveIndex(-1);
        effectiveActiveIndex = -1;
    }

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
        if (track.lyricsLRC || track.lyricsFetchFailed) {
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
    }, [track?.id, track?.lyricsLRC, track?.lyricsFetchFailed]);

    const lastIndexRef = useRef<number>(-1);
    const lastFrameTimeRef = useRef<number>(Date.now());
    const trackChangeTimeRef = useRef<number>(Date.now());

    const syncData = useRef({
        isPlaying: false,
        anchorPosition: 0,
        anchorDate: Date.now(),
        speed: 1.0,
    });

    const syncAnchor = async () => {
        try {
            const activeTP = await TrackPlayer.getActiveTrack();
            if (activeTP?.id && track?.id) {
                const cleanActiveId = activeTP.id.toString().split('-')[0];
                const cleanCurrentId = track.id.toString().split('-')[0];
                if (cleanActiveId !== cleanCurrentId) {
                    return;
                }
            }
            const { position } = await TrackPlayer.getProgress();
            const pos = sanitizePos(position);

            const timeSinceChange = Date.now() - trackChangeTimeRef.current;
            if (timeSinceChange < 1500 && pos > 2.0) {
                return;
            }

            syncData.current.anchorPosition = pos;
            syncData.current.anchorDate = Date.now();
        } catch (e) {}
    };

    useEffect(() => {
        syncData.current.speed = typeof speed === 'number' && speed > 0 ? speed : 1.0;
    }, [speed]);

    useEffect(() => {
        syncData.current.isPlaying = isPlaying;
        syncData.current.anchorDate = Date.now();
        syncAnchor();
    }, [isPlaying]);

    useEffect(() => {
        lastIndexRef.current = -1;
        trackChangeTimeRef.current = Date.now();
        syncData.current = {
            isPlaying,
            anchorPosition: 0,
            anchorDate: Date.now(),
            speed: typeof speed === 'number' && speed > 0 ? speed : 1.0,
        };
        // We do not call syncAnchor() immediately here to avoid reading the stale position of the previous track
    }, [track?.id]);

    // Resincronizar cuando la app vuelve del segundo plano o bloqueo de pantalla
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                syncAnchor();
            }
        });
        return () => {
            subscription.remove();
        };
    }, []);

    useEffect(() => {
        let frameId: number | null = null;
        let lastFrameTime = 0;
        let isMounted = true;

        const loop = (timestamp: number) => {
            if (!isMounted) return;

            try {
                const now = timestamp || Date.now();
                const elapsed = now - lastFrameTime;
                if (elapsed >= 33) {
                    lastFrameTime = now;
                    lastFrameTimeRef.current = Date.now();

                    const data = syncData.current;
                    let currentPos = sanitizePos(data.anchorPosition);
                    if (data.isPlaying) {
                        const timePassed = Math.max(0, (Date.now() - data.anchorDate) / 1000);
                        currentPos = currentPos + timePassed * data.speed;
                    }

                    if (isSynced && parsedLyrics.length > 0) {
                        const total = parsedLyrics.length;
                        let index = -1;
                        const lastIdx = lastIndexRef.current;

                        if (lastIdx >= 0 && lastIdx < total) {
                            const currentLine = parsedLyrics[lastIdx];
                            const nextLine = lastIdx + 1 < total ? parsedLyrics[lastIdx + 1] : null;
                            if (currentLine && currentPos >= currentLine.time && (!nextLine || currentPos < nextLine.time)) {
                                index = lastIdx;
                            }
                        }

                        if (index === -1 && lastIdx >= 0 && lastIdx + 1 < total) {
                            const nextLine = parsedLyrics[lastIdx + 1];
                            const afterNextLine = lastIdx + 2 < total ? parsedLyrics[lastIdx + 2] : null;
                            if (nextLine && currentPos >= nextLine.time && (!afterNextLine || currentPos < afterNextLine.time)) {
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
                        setActiveIndex(prev => (prev !== index ? index : prev));
                    } else {
                        lastIndexRef.current = -1;
                        setActiveIndex(prev => (prev !== -1 ? -1 : prev));
                    }
                }
            } catch (err) {
                console.warn("[useSyncedLyrics] Error in loop calculation:", err);
            } finally {
                if (isMounted) {
                    frameId = requestAnimationFrame(loop);
                }
            }
        };

        frameId = requestAnimationFrame(loop);

        const intervalId = setInterval(async () => {
            try {
                const [state, activeTP, progress] = await Promise.all([
                    TrackPlayer.getPlaybackState(),
                    TrackPlayer.getActiveTrack(),
                    TrackPlayer.getProgress(),
                ]);

                if (activeTP?.id && track?.id) {
                    const cleanActiveId = activeTP.id.toString().split('-')[0];
                    const cleanCurrentId = track.id.toString().split('-')[0];
                    if (cleanActiveId !== cleanCurrentId) {
                        return;
                    }
                }

                const pos = sanitizePos(progress.position);
                const timeSinceChange = Date.now() - trackChangeTimeRef.current;
                if (timeSinceChange < 1500 && pos > 2.0) {
                    return;
                }

                const isPlayingReal = state.state === State.Playing;
                syncData.current.isPlaying = isPlayingReal;
                syncData.current.anchorPosition = pos;
                syncData.current.anchorDate = Date.now();

                // Watchdog: Si requestAnimationFrame fue suspendido por el sistema (>300ms sin frame),
                // actualizamos activeIndex inmediatamente y revivimos el bucle
                const timeSinceLastFrame = Date.now() - lastFrameTimeRef.current;
                if (timeSinceLastFrame > 300 && isSynced && parsedLyrics.length > 0) {
                    const curPos = pos;
                    let index = -1;
                    for (let i = 0; i < parsedLyrics.length; i++) {
                        if (curPos >= parsedLyrics[i].time) {
                            index = i;
                        } else {
                            break;
                        }
                    }
                    lastIndexRef.current = index;
                    setActiveIndex(prev => (prev !== index ? index : prev));

                    if (isMounted) {
                        if (frameId !== null) {
                            cancelAnimationFrame(frameId);
                        }
                        frameId = requestAnimationFrame(loop);
                    }
                }
            } catch (e) {}
        }, 600);

        return () => {
            isMounted = false;
            if (frameId !== null) {
                cancelAnimationFrame(frameId);
            }
            clearInterval(intervalId);
        };
    }, [isSynced, parsedLyrics]);

    return {
        parsedLyrics,
        activeIndex: effectiveActiveIndex,
        isLoading,
        isSynced,
        lyricsText: track?.lyricsLRC || null,
    };
}

