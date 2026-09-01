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
let serverSessionId = Date.now();
let initialResumePosition: number | null = null;
let initialResumeCleanId: string | null = null;

interface CastCommand {
    id: number;
    type: 'SEEK' | 'PLAY' | 'PAUSE' | 'STOP';
    position?: number;
}
let currentCommand: CastCommand | null = null;
let commandCounter = 0;

let isSeekingFromPc = false;

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
const coverCacheMap = new Map<string, string | null>(); // cleanId -> fileName (e.g. 'cast_cover_123.jpg') or null
const coverCachePromises = new Map<string, Promise<string | null>>();

async function prepareCoverFile(cleanId: string, albumModel: any): Promise<string | null> {
    if (!cleanId) return null;
    if (coverCacheMap.has(cleanId)) {
        const cached = coverCacheMap.get(cleanId);
        if (cached) {
            const targetUri = `${FileSystem.cacheDirectory}${cached}`;
            try {
                const info = await FileSystem.getInfoAsync(targetUri);
                if (info.exists && (info as any).size > 0) return cached;
            } catch { }
        }
    }

    if (coverCachePromises.has(cleanId)) {
        return coverCachePromises.get(cleanId)!;
    }

    if (!albumModel?.coverUrl) {
        return null;
    }

    const rawSource = albumModel.coverUrl;
    if (typeof rawSource === 'string' && (rawSource.includes('nullcover') || rawSource.includes('assets_images'))) {
        return null;
    }

    const promise = (async (): Promise<string | null> => {
        try {
            const fileName = `cast_cover_${cleanId}.jpg`;
            const targetUri = `${FileSystem.cacheDirectory}${fileName}`;

            // Check if file is already on disk
            const fileCheck = await FileSystem.getInfoAsync(targetUri);
            if (fileCheck.exists && (fileCheck as any).size > 0) {
                coverCacheMap.set(cleanId, fileName);
                return fileName;
            }

            let source = rawSource;
            if (typeof source === 'string') {
                // Strip query parameters (?t=...) which can break ContentResolver and FileSystem copy on Android
                source = source.split('?')[0];
                if (!source.startsWith('content://') && !source.startsWith('file://') && !source.startsWith('http://') && !source.startsWith('https://')) {
                    if (source.startsWith('/')) source = `file://${source}`;
                }
            }

            try { await FileSystem.deleteAsync(targetUri, { idempotent: true }); } catch { }

            if (source.startsWith('http://') || source.startsWith('https://')) {
                await FileSystem.downloadAsync(source, targetUri);
            } else {
                await FileSystem.copyAsync({ from: source, to: targetUri });
            }

            const finalCheck = await FileSystem.getInfoAsync(targetUri);
            if (finalCheck.exists && (finalCheck as any).size > 0) {
                coverCacheMap.set(cleanId, fileName);
                console.log(`[LocalCastService] Cover cached statically for trackId=${cleanId}: ${fileName}`);
                return fileName;
            } else {
                coverCacheMap.delete(cleanId);
                return null;
            }
        } catch (err) {
            console.warn(`[LocalCastService] Error preparing cover file for ${cleanId}:`, err);
            coverCacheMap.delete(cleanId);
            return null;
        } finally {
            coverCachePromises.delete(cleanId);
        }
    })();

    coverCachePromises.set(cleanId, promise);
    return promise;
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
            const albumModel = await trackModel.album.fetch().catch(() => null);
            if (albumModel?.coverUrl) {
                prepareCoverFile(nextCleanId, albumModel).catch(() => { });
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
        // Prune large audio files
        for (const [cleanId, info] of trackCacheMap.entries()) {
            if (!keepSet.has(cleanId)) {
                try { await FileSystem.deleteAsync(info.filePath, { idempotent: true }); } catch { }
                trackCacheMap.delete(cleanId);
            }
        }
        // Retain up to 30 recent covers instead of deleting immediately
        if (coverCacheMap.size > 30) {
            const entries = Array.from(coverCacheMap.entries());
            const toDelete = entries.slice(0, entries.length - 20);
            for (const [cleanId, fileName] of toDelete) {
                if (!keepSet.has(cleanId)) {
                    if (fileName) {
                        try { await FileSystem.deleteAsync(`${FileSystem.cacheDirectory}${fileName}`, { idempotent: true }); } catch { }
                    }
                    coverCacheMap.delete(cleanId);
                }
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
    setInitialResumePosition(pos: number, cleanId?: string | null) {
        initialResumePosition = pos > 0 ? pos : null;
        initialResumeCleanId = cleanId ?? null;
        console.log(`[LocalCastService] Set initial resume position: ${initialResumePosition}s for cleanId: ${initialResumeCleanId}`);
    },

    async start(port: number): Promise<void> {
        isServerStopping = false;
        serverSessionId = Date.now();
        if (server) {
            try { await server.stop(); } catch { }
        }

        server = new BridgeServer('local-cast', true);

        // ── Unified Pathname Router (100% immune to query parameter mismatches) ──
        server.use(async (req: any, res: any) => {
            try {
                const urlObj = new URL(req.url, 'http://localhost');
                const pathname = urlObj.pathname;
                const method = req.type || 'GET';

                // ── GET / — Web client HTML (LocalCast for PC) ──────────────────────
                if (method === 'GET' && pathname === '/') {
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
                    return;
                }

                // ── GET /cast & /chromecast — CAF Web Receiver HTML ─────────────────
                if (method === 'GET' && (pathname === '/cast' || pathname === '/chromecast')) {
                    res.html(getChromecastHtml(), 200);
                    return;
                }

                // ── GET /api/state ────────────────────────────────────────────────────
                if (method === 'GET' && pathname === '/api/state') {
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

                    const lastClientCmdId = parseInt(urlObj.searchParams.get('lastCmdId') || '0', 10);
                    const clientSessionId = urlObj.searchParams.get('sessionId') || '';
                    const clientFile = urlObj.searchParams.get('file') || '';
                    const isSameSession = clientSessionId === serverSessionId.toString();

                    const commandToSend = (currentCommand && currentCommand.id > lastClientCmdId && isSameSession) ? currentCommand : null;

                    const activeIndex = await TrackPlayer.getActiveTrackIndex();
                    if (activeIndex === null || activeIndex === undefined) {
                        res.json({ activeTrack: null, isPlaying: false, position: 0, duration: 0, command: commandToSend }, 200);
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
                    const isPlaying = castState.isCastPlaying;

                    const title = track?.title || 'Unknown Title';
                    const artist = track?.artist || 'Unknown Artist';
                    let lyricsLRC: string | null = null;
                    let coverFileName: string | null = null;
                    const cleanId = track?.id ? track.id.toString().split('-')[0] : '';
                    currentActiveCleanId = cleanId;

                    if (cleanId) {
                        try {
                            const trackModel = await database.get<Track>('tracks').find(cleanId);
                            lyricsLRC = trackModel.lyricsLRC || null;

                            const albumModel = await trackModel.album.fetch().catch(() => null);
                            if (albumModel?.coverUrl) {
                                coverFileName = await prepareCoverFile(cleanId, albumModel);
                            }
                        } catch (dbErr) {
                            console.error('[LocalCastService] DB error in /api/state:', dbErr);
                        }
                    }

                    const cacheInfo = await Promise.race([
                        prepareTrackCache(track),
                        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
                    ]);
                    const resolvedMime = cacheInfo?.mimeType ?? 'audio/mpeg';
                    const resolvedSize = cacheInfo?.fileSize ?? 0;
                    const fileName = cacheInfo?.filePath.split('/').pop() ?? null;

                    if (isSameSession && fileName) {
                        const clientPos = parseFloat(urlObj.searchParams.get('pos') || '-1');
                        const clientDur = parseFloat(urlObj.searchParams.get('dur') || '0');

                        // Only accept progress updates from client if it is playing the current active file
                        const isMatchingCurrentTrack = clientFile === fileName || (!clientFile && cleanId === initialResumeCleanId);
                        if (clientPos >= 0 && isMatchingCurrentTrack) {
                            try {
                                const { useCastStore } = require('../store/useCastStore');
                                useCastStore.getState().setCastPlayback(clientPos, undefined, clientDur);
                            } catch { }
                        }
                    }

                    // Determine position to send:
                    // 1. If starting a cast session mid-song, resume from initial position once.
                    // 2. If client is already playing current file, send current castPosition.
                    // 3. If track has changed (new file), always send 0 so it starts at the beginning.
                    let positionToSend = 0;
                    if (initialResumePosition !== null && (!initialResumeCleanId || initialResumeCleanId === cleanId)) {
                        positionToSend = initialResumePosition;
                        if (clientFile === fileName) {
                            initialResumePosition = null;
                            initialResumeCleanId = null;
                        }
                    } else if (clientFile === fileName) {
                        positionToSend = useCastStore.getState().castPosition || 0;
                    } else {
                        positionToSend = 0;
                    }

                    preloadNextTrack(activeIndex).catch(() => {});

                    console.log(`[LocalCastService] /api/state → "${title}" | playing:${isPlaying} | pos:${Math.round(positionToSend)}s | cmd:${commandToSend ? commandToSend.type : 'none'} | file:${fileName}`);

                    res.json({
                        title,
                        artist,
                        isPlaying,
                        position: positionToSend,
                        duration: progress.duration,
                        coverFileName,
                        lyricsLRC,
                        fileSize: resolvedSize,
                        mimeType: resolvedMime,
                        playIntent,
                        mediaFileName: fileName,
                        command: commandToSend,
                        sessionId: serverSessionId,
                    }, 200);
                    return;
                }

                // ── GET /api/cover ────────────────────────────────────────────────────
                if (method === 'GET' && pathname === '/api/cover') {
                    res.json({ cover: null }, 200);
                    return;
                }

                // ── POST /api/play ────────────────────────────────────────────────────
                if (method === 'POST' && pathname === '/api/play') {
                    playIntent = false;
                    await TrackPlayer.play();
                    res.json({ success: true }, 200);
                    return;
                }

                // ── POST /api/pause ───────────────────────────────────────────────────
                if (method === 'POST' && pathname === '/api/pause') {
                    await TrackPlayer.pause();
                    res.json({ success: true }, 200);
                    return;
                }

                // ── POST /api/seek ────────────────────────────────────────────────────
                if (method === 'POST' && pathname === '/api/seek') {
                    const position = parseFloat(urlObj.searchParams.get('position') || '0');
                    isSeekingFromPc = true;
                    try {
                        await TrackPlayer.seekTo(position);
                    } finally {
                        setTimeout(() => { isSeekingFromPc = false; }, 600);
                    }
                    res.json({ success: true }, 200);
                    return;
                }

                // ── POST /api/next ────────────────────────────────────────────────────
                if (method === 'POST' && pathname === '/api/next') {
                    await TrackPlayer.skipToNext();
                    await TrackPlayer.play();
                    res.json({ success: true }, 200);
                    return;
                }

                // ── GET /favicon.ico ──────────────────────────────────────────────────
                if (method === 'GET' && pathname === '/favicon.ico') {
                    res.send(204, 'image/x-icon', '');
                    return;
                }

                // ── POST /api/previous ────────────────────────────────────────────────
                if (method === 'POST' && pathname === '/api/previous') {
                    await TrackPlayer.skipToPrevious();
                    await TrackPlayer.play();
                    res.json({ success: true }, 200);
                    return;
                }

                res.json({ error: 'Not found' }, 404);
            } catch (err: any) {
                console.error('[LocalCastService] Route handler error:', err);
                try { res.json({ error: err?.message || 'Server error' }, 500); } catch { }
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

        // Clean up all cached track audio files and cover image files
        for (const info of trackCacheMap.values()) {
            try { await FileSystem.deleteAsync(info.filePath, { idempotent: true }); } catch { }
        }
        for (const fileName of coverCacheMap.values()) {
            if (fileName) {
                try { await FileSystem.deleteAsync(`${FileSystem.cacheDirectory}${fileName}`, { idempotent: true }); } catch { }
            }
        }
        trackCacheMap.clear();
        trackCopyPromises.clear();
        coverCacheMap.clear();
        coverCachePromises.clear();
        currentActiveCleanId = null;
        currentCommand = null;
        commandCounter = 0;
        isSeekingFromPc = false;
        playIntent = false;
        initialResumePosition = null;
        initialResumeCleanId = null;

        console.log('[LocalCastService] Server stopped, all track and cover caches cleared');
    },

    emitSeek(position: number) {
        if (isSeekingFromPc) return; // Don't echo seek initiated from PC back to PC
        commandCounter++;
        currentCommand = { id: commandCounter, type: 'SEEK', position };
        console.log(`[LocalCastService] emitSeek to position ${position} (cmdId ${commandCounter})`);
    },

    emitPlay() {
        commandCounter++;
        currentCommand = { id: commandCounter, type: 'PLAY' };
        console.log(`[LocalCastService] emitPlay (cmdId ${commandCounter})`);
    },

    emitPause() {
        commandCounter++;
        currentCommand = { id: commandCounter, type: 'PAUSE' };
        console.log(`[LocalCastService] emitPause (cmdId ${commandCounter})`);
    },

    emitStop() {
        commandCounter++;
        currentCommand = { id: commandCounter, type: 'STOP' };
        console.log(`[LocalCastService] emitStop (cmdId ${commandCounter})`);
    },

    async prepareTrack(track: any) {
        return prepareTrackCache(track);
    },

    async prepareCover(cleanId: string, albumModel: any): Promise<string | null> {
        return prepareCoverFile(cleanId, albumModel);
    },

    async triggerPreloadNext(currentIndex?: number) {
        return preloadNextTrack(currentIndex);
    },

    isServerRunning() {
        return server !== null;
    }
};
