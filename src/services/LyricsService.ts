import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { database } from '../database';
import Track from '../database/models/Track';
import { usePlayerStore } from '../store/usePlayerStore';

import { parseLRC } from '../../packages/core/src/lyrics';
export { parseLRC };

import { foregroundLyricsRequests as activeFetchingTrackIds } from './lyricsRequests';

export const LyricsService = {
    isFetchingTrack: (id: string): boolean => activeFetchingTrackIds.has(id),
    isFetching: (): boolean => {
        return activeFetchingTrackIds.size > 0;
    },

    fetchLyrics: async (track: Track, force = false): Promise<string | null> => {
        // 1. Check if cached in DB
        if (!force && track.lyricsLRC) {
            return track.lyricsLRC;
        }

        // If not forced and lyrics were deleted or search failed previously, do not search
        if (!force && track.lyricsFetchFailed) {
            return null;
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
                    'User-Agent': 'MMPlayer V3.0.0 (https://github.com/pescalerag/mmplayer)'
                },
                signal: controller.signal
            });

            if (!response.ok) {
                console.log(`[LyricsService] Lyrics API response: ${response.status}`);
                await database.write(async () => {
                    await track.update(t => {
                        t.lyricsFetchFailed = true;
                    });
                });
                return null;
            }

            const data = await response.json();
            const lyrics = data.syncedLyrics || data.plainLyrics || null;

            await database.write(async () => {
                await track.update(t => {
                    if (lyrics) {
                        t.lyricsLRC = lyrics;
                        t.lyricsFetchFailed = false;
                    } else {
                        t.lyricsFetchFailed = true;
                    }
                });
            });

            if (lyrics) {
                console.log(`[LyricsService] Lyrics successfully saved to DB for track: ${track.title}`);
            } else {
                console.log(`[LyricsService] No lyrics found for track: ${track.title}`);
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
            let fileContent: string;
            try {
                fileContent = (await FileSystem.readAsStringAsync(fileUri, { encoding: 'utf8' as any })).replace(/^\uFEFF/, '');
            } finally {
                if (Platform.OS === 'web' && fileUri.startsWith('blob:')) await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {});
            }

            if (fileContent.trim()) {
                await database.write(async () => {
                    await track.update(t => {
                        t.lyricsLRC = fileContent;
                        t.lyricsFetchFailed = false;
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

    exportLyrics: async (track: Track): Promise<boolean> => {
        if (!track?.lyricsLRC?.trim()) {
            return false;
        }

        try {
            let resolvedArtistName = '';
            try {
                if (typeof (track as any).artist === 'string') {
                    resolvedArtistName = (track as any).artist;
                } else if ((track as any).artist?.fetch) {
                    const fetched = await (track as any).artist.fetch();
                    resolvedArtistName = fetched?.name || '';
                } else if ((track as any).artist?.name) {
                    resolvedArtistName = (track as any).artist.name;
                } else {
                    const primaryArtist: any = await track.artist;
                    resolvedArtistName = primaryArtist?.name || '';
                }
            } catch {
                resolvedArtistName = '';
            }

            const sanitize = (name: string) => name.replace(/[/\\?%*:|"<>\x00-\x1f]/g, '_').trim().replace(/[. ]+$/, '');
            const artistStr = sanitize(resolvedArtistName);
            const titleStr = sanitize(track.title) || 'track';
            const baseName = (artistStr ? `${artistStr} - ${titleStr}` : titleStr).slice(0, 180);
            const fileName = `${/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(baseName) ? '_' : ''}${baseName}.lrc`;
            const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

            await FileSystem.writeAsStringAsync(fileUri, track.lyricsLRC, {
                encoding: FileSystem.EncodingType.UTF8,
            });

            const isAvailable = await Sharing.isAvailableAsync();
            if (!isAvailable) {
                throw new Error('Sharing is not available on this device');
            }

            await Sharing.shareAsync(fileUri, {
                mimeType: 'text/plain',
                dialogTitle: fileName,
                UTI: 'public.plain-text',
            });

            return true;
        } catch (error) {
            if ((error as any)?.code === 'USER_CANCELLED') return false;
            console.error('[LyricsService] Error exporting lyrics:', error);
            throw error;
        }
    },

    saveLyrics: async (track: Track, lyrics: string): Promise<void> => {
        const hasLyrics = !!lyrics?.trim();
        await database.write(async () => {
            await track.update(t => {
                t.lyricsLRC = hasLyrics ? lyrics : null;
                t.lyricsFetchFailed = !hasLyrics;
            });
        });
        console.log(`[LyricsService] Custom lyrics saved to DB for track: ${track.title}`);
    },

    deleteLyrics: async (track: Track): Promise<void> => {
        await database.write(async () => {
            await track.update(t => {
                t.lyricsLRC = null;
                t.lyricsFetchFailed = true;
            });
        });
        console.log(`[LyricsService] Lyrics deleted and auto-fetch suppressed for track: ${track.title}`);
    }
};
