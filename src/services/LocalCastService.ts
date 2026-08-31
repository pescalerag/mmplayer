import * as FileSystem from 'expo-file-system/legacy';
import { BridgeServer } from 'react-native-http-bridge-refurbished';
import TrackPlayer from 'react-native-track-player';
import { readFileChunk } from '../../modules/native-audio-scanner';
import { database } from '../database';
import Track from '../database/models/Track';
import i18n from '../constants/i18n';
import { getClientHtml, LocalCastTranslations } from './LocalCastHtml';
import { getChromecastHtml } from './ChromecastHtml';

// ─── Server instance ─────────────────────────────────────────────────────────
let server: BridgeServer | null = null;
let playIntent = false;
let isServerStopping = false;

// ─── Audio track cache ────────────────────────────────────────────────────────
// Each track is copied to its own file: `cast_track_${cleanId}.${ext}`
// This allows background pre-buffering of the next track while the current one is playing.
interface CachedAudioInfo {
    filePath: string;
    fileSize: number;
    mimeType: string;
}

const trackCacheMap = new Map<string, CachedAudioInfo>();
const trackCopyPromises = new Map<string, Promise<CachedAudioInfo | null>>();
let currentActiveCleanId: string | null = null;

// ─── Cover image cache ────────────────────────────────────────────────────────
const coverCacheMap = new Map<string, string | null>(); // cleanId -> base64 (or null if no cover)
const coverCachePending = new Set<string>();

async function prepareCoverB64(cleanId: string, albumModel: any): Promise<void> {
    if (coverCacheMap.has(cleanId)) return; // Already cached
    if (coverCachePending.has(cleanId)) return; // Being read right now

    coverCachePending.add(cleanId);

    if (!albumModel?.coverUrl) {
        coverCachePending.delete(cleanId);
        coverCacheMap.set(cleanId, null);
        return;
    }

    try {
        let b64: string | null = null;
        const staticCoverUri = `${FileSystem.cacheDirectory}temp_cover_${cleanId}.jpg`;
        if (albumModel.coverUrl.startsWith('content://')) {
            try { await FileSystem.deleteAsync(staticCoverUri, { idempotent: true }); } catch { }
            await FileSystem.copyAsync({ from: albumModel.coverUrl, to: staticCoverUri });
            b64 = await FileSystem.readAsStringAsync(staticCoverUri, { encoding: FileSystem.EncodingType.Base64 });
            try { await FileSystem.deleteAsync(staticCoverUri, { idempotent: true }); } catch { }
        } else {
            let coverPath = albumModel.coverUrl;
            if (coverPath.startsWith('/')) coverPath = `file://${coverPath}`;
            b64 = await FileSystem.readAsStringAsync(coverPath, { encoding: FileSystem.EncodingType.Base64 });
        }
        coverCacheMap.set(cleanId, b64);
        console.log(`[LocalCastService] Cover cached for trackId=${cleanId} (${b64 ? Math.round(b64.length / 1024) + ' KB b64' : 'null'})`);
    } catch (err) {
        console.error('[LocalCastService] Error reading cover art:', err);
        coverCacheMap.set(cleanId, null);
    } finally {
        coverCachePending.delete(cleanId);
    }
}

// ─── Audio file cache with Pre-Buffering ──────────────────────────────────────
async function prepareTrackCache(track: any): Promise<CachedAudioInfo | null> {
    if (!track) return null;
    const fileSource = track.url || track.fileUrl;
    if (!fileSource) return null;
    const trackId = (track.id || 'current').toString();
    const cleanId = trackId.split('-')[0];

    // 1. Check existing in-memory cache and file existence
    const existing = trackCacheMap.get(cleanId);
    if (existing) {
        try {
            const info = await FileSystem.getInfoAsync(existing.filePath);
            if (info.exists && (info as any).size > 0) {
                return existing;
            }
        } catch { }
    }

    // 2. Check if a copy operation is already in flight
    if (trackCopyPromises.has(cleanId)) {
        return trackCopyPromises.get(cleanId)!;
    }

    // 3. Initiate asynchronous copy
    const copyPromise = (async (): Promise<CachedAudioInfo | null> => {
        try {
            let filePath = fileSource;

            if (!filePath.startsWith('content://') && !filePath.startsWith('file://')) {
                if (filePath.startsWith('/')) filePath = `file://${filePath}`;
            }

            // Derive extension
            let ext = 'mp3';
            const lastDot = filePath.lastIndexOf('.');
            if (lastDot !== -1 && !filePath.startsWith('content://')) {
                const parsedExt = filePath.substring(lastDot + 1).toLowerCase();
                if (parsedExt && parsedExt.length <= 4) ext = parsedExt;
            }

            const targetUri = `${FileSystem.cacheDirectory}cast_track_${cleanId}.${ext}`;

            const fileCheck = await FileSystem.getInfoAsync(targetUri);
            if (!fileCheck.exists || (fileCheck as any).size === 0) {
                try { await FileSystem.deleteAsync(targetUri, { idempotent: true }); } catch { }
                await FileSystem.copyAsync({ from: filePath, to: targetUri });
            }

            // MIME detection via magic bytes
            let mimeType = 'audio/mpeg';
            try {
                const headerB64 = await readFileChunk(targetUri, 0, 16);
                if (headerB64) {
                    if (headerB64.startsWith('ZkxhQ')) mimeType = 'audio/flac';
                    else if (headerB64.startsWith('T2dnUw')) mimeType = 'audio/ogg';
                    else if (headerB64.startsWith('UklGR')) mimeType = 'audio/wav';
                    else if (headerB64.startsWith('AAAA') || headerB64.startsWith('AAAB')) mimeType = 'audio/mp4';
                    else {
                        const urlLower = fileSource.toLowerCase();
                        if (urlLower.endsWith('.m4a') || urlLower.endsWith('.aac') || urlLower.endsWith('.mp4')) mimeType = 'audio/mp4';
                        else if (urlLower.endsWith('.flac')) mimeType = 'audio/flac';
                        else if (urlLower.endsWith('.wav')) mimeType = 'audio/wav';
                        else if (urlLower.endsWith('.ogg')) mimeType = 'audio/ogg';
                    }
                }
            } catch (err) {
                console.warn('[LocalCastService] Error reading magic bytes:', err);
            }

            const fileInfo = await FileSystem.getInfoAsync(targetUri);
            const fileSize = fileInfo.exists ? (fileInfo as any).size ?? 0 : 0;

            const result: CachedAudioInfo = { filePath: targetUri, fileSize, mimeType };
            trackCacheMap.set(cleanId, result);
            console.log(`[LocalCastService] Audio cached for trackId=${cleanId} (${(fileSize / (1024 * 1024)).toFixed(2)} MB, ${mimeType})`);
            return result;
        } catch (err) {
            console.error(`[LocalCastService] Error preparing track cache for ${cleanId}:`, err);
            return null;
        } finally {
            trackCopyPromises.delete(cleanId);
        }
    })();

    trackCopyPromises.set(cleanId, copyPromise);
    return copyPromise;
}

// ─── Proactive Next-Track Preloader ──────────────────────────────────────────
async function preloadNextTrack(currentTrackIndex?: number): Promise<void> {
    try {
        const queue = await TrackPlayer.getQueue();
        if (!queue || queue.length <= 1) return;

        let idx = currentTrackIndex;
        if (idx === undefined || idx === null) {
            idx = await TrackPlayer.getActiveTrackIndex() ?? -1;
        }
        if (idx < 0 || idx >= queue.length) return;

        const nextIdx = (idx + 1) % queue.length;
        const nextTrack = queue[nextIdx];
        if (!nextTrack) return;

        const nextCleanId = nextTrack.id ? nextTrack.id.toString().split('-')[0] : '';
        if (!nextCleanId) return;

        // 1. Proactively cache audio in background
        prepareTrackCache(nextTrack).catch(err => {
            console.warn('[LocalCastService] Background pre-cache next audio error:', err);
        });

        // 2. Proactively cache album cover in background
        try {
            const trackModel = await database.get<Track>('tracks').find(nextCleanId);
            const albumModel = await trackModel.album.fetch();
            if (albumModel?.coverUrl) {
                prepareCoverB64(nextCleanId, albumModel).catch(() => { });
            }
        } catch { }

        // 3. Prune older tracks from cache to save storage space
        pruneOldCaches([currentActiveCleanId || '', nextCleanId]);
    } catch (err) {
        console.warn('[LocalCastService] Error in preloadNextTrack:', err);
    }
}

async function pruneOldCaches(keepCleanIds: string[]) {
    try {
        const keepSet = new Set(keepCleanIds.filter(Boolean));
        for (const [cleanId, info] of trackCacheMap.entries()) {
            if (!keepSet.has(cleanId)) {
                try { await FileSystem.deleteAsync(info.filePath, { idempotent: true }); } catch { }
                trackCacheMap.delete(cleanId);
            }
        }
        // Limit cover cache memory
        for (const cleanId of coverCacheMap.keys()) {
            if (!keepSet.has(cleanId)) {
                coverCacheMap.delete(cleanId);
            }
        }
    } catch (e) {
        console.warn('[LocalCastService] Error pruning old caches:', e);
    }
}

// ─── Service ──────────────────────────────────────────────────────────────────
export const LocalCastService = {
    setPlayIntent(value: boolean) { playIntent = value; },
    getPlayIntent() { return playIntent; },

    async start(port: number): Promise<void> {
        isServerStopping = false;
        if (server) {
            try { await server.stop(); } catch { }
        }

        server = new BridgeServer('local-cast', true);

        // ── GET / — Web client HTML (LocalCast for PC) ──────────────────────
        server.get('/', async (_req, res) => {
            const currentLang = i18n.language?.startsWith('es') ? 'es' : 'en';
            const translations: LocalCastTranslations = {
                appTitle: i18n.t('localcast_client.app_title', { defaultValue: 'MMPlayer LocalCast' }),
                noSong: i18n.t('localcast_client.no_song', { defaultValue: 'No hay canción' }),
                noLyrics: i18n.t('localcast_client.no_lyrics', { defaultValue: 'No hay letras cargadas' }),
                streaming: i18n.t('localcast_client.streaming', { defaultValue: 'Transmitiendo' }),
                playing: i18n.t('localcast_client.playing', { defaultValue: 'Reproduciendo' }),
                retryingAudio: i18n.t('localcast_client.retrying_audio', { defaultValue: 'Reintentando audio...' }),
                clickToUnmute: i18n.t('localcast_client.click_to_unmute', { defaultValue: 'Clic para activar audio' }),
                clickToUnmuteLong: i18n.t('localcast_client.click_to_unmute_long', { defaultValue: 'Haga clic para activar audio' }),
                brandName: 'MMPlayer',
                lang: currentLang,
            };
            res.html(getClientHtml(translations), 200);
        });

        // ── GET /cast & /chromecast — CAF Web Receiver HTML ─────────────────
        server.get('/cast', async (_req, res) => {
            res.html(getChromecastHtml(), 200);
        });
        server.get('/chromecast', async (_req, res) => {
            res.html(getChromecastHtml(), 200);
        });

        // ── GET /api/state ────────────────────────────────────────────────────
        server.get('/api/state', async (_req, res) => {
            try {
                const { useCastStore } = require('../store/useCastStore');
                const castState = useCastStore.getState();

                if (isServerStopping || !castState.isLocalCastActive) {
                    res.json({
                        title: castState.isChromecastConnected ? 'Transmitiendo en Chromecast' : null,
                        artist: castState.connectedDeviceName || 'MMPlayer',
                        isPlaying: false,
                        isStopped: true,
                        isLocalCastActive: castState.isLocalCastActive,
                    }, 200);
                    return;
                }

                const activeIndex = await TrackPlayer.getActiveTrackIndex();
                if (activeIndex === null || activeIndex === undefined) {
                    res.json({ activeTrack: null, isPlaying: false, position: 0, duration: 0 }, 200);
                    return;
                }

                let track = await TrackPlayer.getTrack(activeIndex);

                try {
                    const { usePlayerStore } = require('../store/usePlayerStore');
                    const playerState = usePlayerStore.getState();
                    if (playerState.isQueueLoading && playerState.activeTrack) {
                        const expectedId = playerState.activeTrack.id.toString().split('-')[0];
                        const currentId = track?.id ? track.id.toString().split('-')[0] : '';
                        if (expectedId !== currentId) {
                            const queue = await TrackPlayer.getQueue();
                            const foundTrack = queue.find(t => t.id?.toString().split('-')[0] === expectedId);
                            if (foundTrack) {
                                track = foundTrack;
                                console.log(`[LocalCastService] /api/state: Overriding temporary active track "${track.title}" with expected "${foundTrack.title}" during queue load.`);
                            }
                        }
                    }
                } catch (loadErr) {
                    console.error('[LocalCastService] Error resolving expected track during load:', loadErr);
                }

                const progress = await TrackPlayer.getProgress();
                const state = await TrackPlayer.getPlaybackState();
                const isPlaying = state.state === 'playing';

                const title = track?.title || 'Unknown Title';
                const artist = track?.artist || 'Unknown Artist';
                let lyricsLRC: string | null = null;
                let coverToken: string | null = null;
                const cleanId = track?.id ? track.id.toString().split('-')[0] : '';
                currentActiveCleanId = cleanId;

                if (cleanId) {
                    try {
                        const trackModel = await database.get<Track>('tracks').find(cleanId);
                        lyricsLRC = trackModel.lyricsLRC || null;

                        const albumModel = await trackModel.album.fetch();
                        if (albumModel?.coverUrl) {
                            prepareCoverB64(cleanId, albumModel).catch(() => { });
                            coverToken = coverCacheMap.has(cleanId) ? cleanId : null;
                        }
                    } catch (dbErr) {
                        console.error('[LocalCastService] DB error in /api/state:', dbErr);
                    }
                }

                // Use Promise.race so a slow file copy never blocks the HTTP response beyond 3s.
                // If the timeout wins, respond with cached info or null — the next poll will retry.
                const cacheInfo = await Promise.race([
                    prepareTrackCache(track),
                    new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
                ]);
                const resolvedMime = cacheInfo?.mimeType ?? 'audio/mpeg';
                const resolvedSize = cacheInfo?.fileSize ?? 0;
                const fileName = cacheInfo?.filePath.split('/').pop() ?? null;

                // Fire-and-forget next track pre-caching to eliminate transition wait
                preloadNextTrack(activeIndex).catch(() => {});

                console.log(`[LocalCastService] /api/state → "${title}" | playing:${isPlaying} | pos:${Math.round(progress.position)}s | file:${fileName}`);

                res.json({
                    title,
                    artist,
                    isPlaying,
                    position: progress.position,
                    duration: progress.duration,
                    coverToken,
                    lyricsLRC,
                    fileSize: resolvedSize,
                    mimeType: resolvedMime,
                    playIntent,
                    mediaFileName: fileName,
                }, 200);
            } catch (err: any) {
                console.error('[LocalCastService] Error in /api/state:', err);
                res.json({ error: err.message }, 500);
            }
        });

        // ── GET /api/cover ────────────────────────────────────────────────────
        server.get('/api/cover', async (req, res) => {
            try {
                const url = new URL(req.url, 'http://localhost');
                const requestedToken = url.searchParams.get('token') || currentActiveCleanId;
                const b64 = requestedToken ? coverCacheMap.get(requestedToken) : null;
                res.json({
                    cover: b64 ? `data:image/jpeg;base64,${b64}` : null,
                    token: requestedToken,
                }, 200);
            } catch {
                res.json({ cover: null, token: null }, 200);
            }
        });

        // ── POST /api/play ────────────────────────────────────────────────────
        server.post('/api/play', async (_req, res) => {
            try {
                playIntent = false;
                await TrackPlayer.play();
                res.json({ success: true }, 200);
            } catch (err: any) {
                res.json({ error: err.message }, 500);
            }
        });

        // ── POST /api/pause ───────────────────────────────────────────────────
        server.post('/api/pause', async (_req, res) => {
            try {
                await TrackPlayer.pause();
                res.json({ success: true }, 200);
            } catch (err: any) {
                res.json({ error: err.message }, 500);
            }
        });

        // ── POST /api/seek ────────────────────────────────────────────────────
        server.post('/api/seek', async (req, res) => {
            try {
                const url = new URL(req.url, 'http://localhost');
                const position = parseFloat(url.searchParams.get('position') || '0');
                await TrackPlayer.seekTo(position);
                res.json({ success: true }, 200);
            } catch (err: any) {
                res.json({ error: err.message }, 500);
            }
        });

        // ── POST /api/next ────────────────────────────────────────────────────
        server.post('/api/next', async (_req, res) => {
            try {
                await TrackPlayer.skipToNext();
                await TrackPlayer.play();
                res.json({ success: true }, 200);
            } catch (err: any) {
                res.json({ error: err.message }, 500);
            }
        });

        server.listen(port);
        console.log(`[LocalCastService] Server started on port ${port}`);
    },

    async stop(): Promise<void> {
        isServerStopping = true;
        if (server) {
            try { await server.stop(); } catch { }
            server = null;
        }

        // Clean up all cached track audio files
        for (const info of trackCacheMap.values()) {
            try { await FileSystem.deleteAsync(info.filePath, { idempotent: true }); } catch { }
        }
        trackCacheMap.clear();
        trackCopyPromises.clear();
        coverCacheMap.clear();
        coverCachePending.clear();
        currentActiveCleanId = null;
        playIntent = false;

        console.log('[LocalCastService] Server stopped, all track caches cleared');
    },

    async prepareTrack(track: any) {
        return prepareTrackCache(track);
    },

    async prepareCover(cleanId: string, albumModel: any) {
        if (albumModel?.coverUrl) {
            const staticCoverUri = `${FileSystem.cacheDirectory}temp_cover.jpg`;
            try {
                if (albumModel.coverUrl.startsWith('content://')) {
                    try { await FileSystem.deleteAsync(staticCoverUri, { idempotent: true }); } catch { }
                    await FileSystem.copyAsync({ from: albumModel.coverUrl, to: staticCoverUri });
                } else {
                    let coverPath = albumModel.coverUrl;
                    if (coverPath.startsWith('/')) coverPath = `file://${coverPath}`;
                    try { await FileSystem.deleteAsync(staticCoverUri, { idempotent: true }); } catch { }
                    await FileSystem.copyAsync({ from: coverPath, to: staticCoverUri });
                }
            } catch (e) {
                console.error('[LocalCastService] Error preparing static cover for Chromecast:', e);
            }
        }
        return prepareCoverB64(cleanId, albumModel);
    },

    async triggerPreloadNext(currentIndex?: number) {
        return preloadNextTrack(currentIndex);
    },

    isServerRunning() {
        return server !== null;
    }
};
