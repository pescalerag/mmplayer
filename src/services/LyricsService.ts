import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { database } from '../database';
import Track from '../database/models/Track';
import { usePlayerStore } from '../store/usePlayerStore';

export const parseLRC = (lrcText: string): { time: number; text: string }[] => {
    if (!lrcText) return [];
    
    const lines = lrcText.split(/\r?\n/);
    const parsedLines: { time: number; text: string }[] = [];
    
    // Matches timestamps like [01:23.45] or [01:23]
    const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
    
    for (const line of lines) {
        const matches = [...line.matchAll(timeRegex)];
        if (matches.length === 0) continue;
        
        // Extract lyrics text by removing all timestamp tags
        const text = line.replace(timeRegex, '').trim();
        
        for (const match of matches) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const msString = match[3] || '00';
            
            // Normalize centiseconds or milliseconds to 3-digit millisecond value
            const milliseconds = parseInt(msString.padEnd(3, '0').slice(0, 3), 10);
            const time = minutes * 60 + seconds + milliseconds / 1000;
            
            parsedLines.push({ time, text });
        }
    }
    
    return parsedLines.sort((a, b) => a.time - b.time);
};

const activeFetchingTrackIds = new Set<string>();

export const LyricsService = {
    isFetching: (): boolean => {
        return activeFetchingTrackIds.size > 0;
    },

    fetchLyrics: async (track: Track, force = false): Promise<string | null> => {
        // 1. Check if cached in DB
        if (!force && track.lyricsLRC) {
            return track.lyricsLRC;
        }

        if (activeFetchingTrackIds.has(track.id)) {
            console.log(`[LyricsService] Fetch ignored: search already in progress for track: ${track.title}`);
            return null;
        }

        activeFetchingTrackIds.add(track.id);
        usePlayerStore.getState().setIsFetchingLyrics(true);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            try {
                controller.abort();
            } catch {}
        }, 10000);

        // 2. Fetch from LRCLIB API
        try {
            const title = encodeURIComponent(track.title);

            // Resolve artist name from WatermelonDB relations
            let resolvedArtistName = '';
            try {
                const collaborators: any[] = await track.queryCollaborators.fetch();
                if (collaborators && collaborators.length > 0) {
                    resolvedArtistName = collaborators[0].name; // Use primary artist for best match
                } else {
                    const primaryArtist: any = await track.artist;
                    resolvedArtistName = primaryArtist?.name || '';
                }
            } catch {
                resolvedArtistName = '';
            }
            const artistName = encodeURIComponent(resolvedArtistName);

            const url = `https://lrclib.net/api/get?track_name=${title}&artist_name=${artistName}`;
            console.log(`[LyricsService] Fetching lyrics from: ${url}`);

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'MMPlayer V2.1.0 (https://github.com/pescalerag/mmplayer)'
                },
                signal: controller.signal
            });

            if (!response.ok) {
                console.log(`[LyricsService] Lyrics API response: ${response.status}`);
                return null;
            }

            const data = await response.json();
            const lyrics = data.syncedLyrics || data.plainLyrics || null;

            if (lyrics) {
                await database.write(async () => {
                    await track.update(t => {
                        t.lyricsLRC = lyrics;
                    });
                });
                console.log(`[LyricsService] Lyrics successfully saved to DB for track: ${track.title}`);
            }

            return lyrics;
        } catch (error: any) {
            if (error?.name === 'AbortError') {
                console.warn(`[LyricsService] Fetch timed out for track: ${track.title}`);
            } else {
                console.error("[LyricsService] Error fetching lyrics:", error);
            }
            return null;
        } finally {
            clearTimeout(timeoutId);
            activeFetchingTrackIds.delete(track.id);
            usePlayerStore.getState().setIsFetchingLyrics(activeFetchingTrackIds.size > 0);
        }
    },

    importCustomLyrics: async (track: Track): Promise<string | null> => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true
            });

            if (result.canceled || !result.assets || result.assets.length === 0) {
                return null;
            }

            const fileUri = result.assets[0].uri;
            const fileContent = await FileSystem.readAsStringAsync(fileUri, {
                encoding: 'utf8' as any
            });

            if (fileContent) {
                await database.write(async () => {
                    await track.update(t => {
                        t.lyricsLRC = fileContent;
                    });
                });
                console.log(`[LyricsService] Custom LRC lyrics imported for track: ${track.title}`);
                return fileContent;
            }

            return null;
        } catch (error) {
            console.error("[LyricsService] Error importing custom lyrics:", error);
            throw error;
        }
    },

    saveLyrics: async (track: Track, lyrics: string): Promise<void> => {
        await database.write(async () => {
            await track.update(t => {
                t.lyricsLRC = lyrics;
            });
        });
        console.log(`[LyricsService] Custom lyrics saved to DB for track: ${track.title}`);
    }
};
