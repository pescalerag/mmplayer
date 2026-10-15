import * as FileSystem from 'expo-file-system/legacy';
import { BridgeServer } from 'react-native-http-bridge-refurbished';
import TrackPlayer from 'react-native-track-player';
import { readFileChunk } from '../../modules/native-audio-scanner';
import { database } from '../database';
import Track from '../database/models/Track';
import i18n from '../constants/i18n';
import { getClientHtml, getLocalCastThemeCss, resolveLocalCastTheme, LocalCastTranslations } from './LocalCastHtml';
import { getChromecastHtml } from './ChromecastHtml';
import { useSettingsStore } from '../store/useSettingsStore';
import { handleCastReportRoute, LocalCastPlaybackService } from './LocalCastPlaybackService';
import { LocalCastQueueService } from './LocalCastQueueService';

// ─── Server instance ─────────────────────────────────────────────────────────
let server: BridgeServer | null = null;
let playIntent = false;
let isServerStopping = false;
let serverSessionId = Date.now();

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

// ─── Active Track Metadata Cache (Avoid repeated DB/I/O per second) ─────────
interface ActiveTrackMetadataCache {
    cleanId: string;
    title: string;
    artist: string;
    lyricsLRC: string | null;
    coverFileName: string | null;
    fileName: string | null;
    fileSize: number;
    mimeType: string;
    replayGain: number | null;
    replayPeak: number | null;
}
let activeMetadataCache: ActiveTrackMetadataCache | null = null;
let lastPreloadedIndex: number | null = null;

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
    currentActiveCleanId = cleanId;

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
            if (filePath.startsWith('content://')) {
                filePath = filePath.split('?')[0];
            } else if (filePath.startsWith('file://')) {
                try { filePath = `file://${decodeURIComponent(filePath.replace('file://', ''))}`; } catch { }
            } else if (filePath.startsWith('/')) {
                try { filePath = `file://${decodeURIComponent(filePath)}`; } catch { filePath = `file://${filePath}`; }
            }

            // Derive extension
            let ext = 'mp3';
            const lastDot = filePath.lastIndexOf('.');
            if (lastDot !== -1 && !filePath.startsWith('content://')) {
                const parsedExt = filePath.substring(lastDot + 1).toLowerCase();
                if (parsedExt && parsedExt.length <= 4) ext = parsedExt;
            }

            const targetUri = `${FileSystem.cacheDirectory}cast_track_${cleanId}.${ext}`;

            const fileCheck = await FileSystem.getInfoAsync(targetUri).catch(() => ({ exists: false, size: 0 }));
            if (!fileCheck.exists || (fileCheck as any).size === 0) {
                try { await FileSystem.deleteAsync(targetUri, { idempotent: true }); } catch { }
                try {
                    await FileSystem.copyAsync({ from: filePath, to: targetUri });
                } catch (copyErr) {
                    console.warn(`[LocalCastService] Copy failed for ${cleanId} from ${filePath}:`, copyErr);
                    try {
                        await FileSystem.copyAsync({ from: fileSource, to: targetUri });
                    } catch (rawErr) {
                        console.error(`[LocalCastService] Raw copy also failed for ${cleanId}:`, rawErr);
                    }
                }
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
                        const urlLower = (track.fileUrl || fileSource).toLowerCase();
                        if (urlLower.endsWith('.m4a') || urlLower.endsWith('.aac') || urlLower.endsWith('.mp4')) mimeType = 'audio/mp4';
                        else if (urlLower.endsWith('.flac')) mimeType = 'audio/flac';
                        else if (urlLower.endsWith('.wav')) mimeType = 'audio/wav';
                        else if (urlLower.endsWith('.ogg')) mimeType = 'audio/ogg';
                    }
                }
            } catch (err) {
                console.warn('[LocalCastService] Error reading magic bytes:', err);
            }

            const mimeToExt: Record<string, string> = {
                'audio/flac': 'flac',
                'audio/ogg': 'ogg',
                'audio/wav': 'wav',
                'audio/mp4': 'm4a',
                'audio/mpeg': 'mp3',
            };
            const correctExt = mimeToExt[mimeType] || ext;
            let finalTargetUri = targetUri;
            if (correctExt !== ext) {
                const correctedUri = `${FileSystem.cacheDirectory}cast_track_${cleanId}.${correctExt}`;
                try {
                    await FileSystem.copyAsync({ from: targetUri, to: correctedUri });
                    await FileSystem.deleteAsync(targetUri, { idempotent: true });
                    finalTargetUri = correctedUri;
                } catch { }
            }

            let fileInfo = await FileSystem.getInfoAsync(finalTargetUri).catch(() => ({ exists: false, size: 0 }));
            if (fileInfo.exists && (fileInfo as any).size > 0) {
                const fileSize = (fileInfo as any).size ?? 0;
                const result: CachedAudioInfo = { filePath: finalTargetUri, fileSize, mimeType };
                trackCacheMap.set(cleanId, result);
                console.log(`[LocalCastService] Audio cached for trackId=${cleanId} (${(fileSize / (1024 * 1024)).toFixed(2)} MB, ${mimeType}, ${correctExt})`);
                return result;
            }

            // Fallback: check if the original source file is directly accessible on device storage
            const sourceCheck = await FileSystem.getInfoAsync(filePath).catch(() => ({ exists: false, size: 0 }));
            if (sourceCheck.exists && (sourceCheck as any).size > 0) {
                const fileSize = (sourceCheck as any).size ?? 0;
                const result: CachedAudioInfo = { filePath: filePath, fileSize, mimeType };
                trackCacheMap.set(cleanId, result);
                console.log(`[LocalCastService] Using direct source audio for trackId=${cleanId} (${(fileSize / (1024 * 1024)).toFixed(2)} MB)`);
                return result;
            }

            console.error(`[LocalCastService] Audio file preparation failed for trackId=${cleanId} - target does not exist`);
            trackCacheMap.delete(cleanId);
            return null;
        } catch (err) {
            console.error(`[LocalCastService] Error preparing track cache for ${cleanId}:`, err);
            trackCacheMap.delete(cleanId);
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
        // Retain up to 8 recent audio files in cache (FIFO / LRU style)
        if (trackCacheMap.size > 8) {
            const entries = Array.from(trackCacheMap.entries());
            const toDelete = entries.slice(0, entries.length - 5);
            for (const [cleanId, info] of toDelete) {
                if (!keepSet.has(cleanId)) {
                    try { await FileSystem.deleteAsync(info.filePath, { idempotent: true }); } catch { }
                    trackCacheMap.delete(cleanId);
                }
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


function initialCastMetadata(track: any): ActiveTrackMetadataCache {
    return { cleanId: track?.id ? String(track.id).split('-')[0] : '',
        title: track?.title || 'Unknown Title', artist: track?.artist || 'Unknown Artist',
        lyricsLRC: null, coverFileName: null, fileName: null, fileSize: 0, mimeType: 'audio/mpeg',
        replayGain: track?.replayGain ?? null, replayPeak: track?.replayPeak ?? null };
}

async function loadCastDatabaseMetadata(metadata: ActiveTrackMetadataCache) {
    try {
        const model = await database.get<Track>('tracks').find(metadata.cleanId);
        metadata.lyricsLRC = model.lyricsLRC || null;
        metadata.replayGain = model.replayGain ?? metadata.replayGain;
        metadata.replayPeak = model.replayPeak ?? metadata.replayPeak;
        const album = await model.album.fetch().catch(() => null);
        if (album?.coverUrl) metadata.coverFileName = await prepareCoverFile(metadata.cleanId, album);
    } catch (error) {
        console.error('[LocalCastService] DB error in /api/state:', error);
    }
}

async function getCastMetadata(track: any): Promise<ActiveTrackMetadataCache> {
    const metadata = initialCastMetadata(track);
    currentActiveCleanId = metadata.cleanId;
    if (activeMetadataCache?.cleanId === metadata.cleanId && activeMetadataCache.fileName) return activeMetadataCache;
    if (!metadata.cleanId) return metadata;
    await loadCastDatabaseMetadata(metadata);
    const cached = await Promise.race([
        prepareTrackCache(track),
        new Promise<null>(resolve => setTimeout(() => resolve(null), 5000)),
    ]);
    metadata.fileName = cached?.filePath.split('/').pop() ?? null;
    metadata.fileSize = cached?.fileSize ?? 0;
    metadata.mimeType = cached?.mimeType ?? 'audio/mpeg';
    if (metadata.fileName) activeMetadataCache = metadata;
    return metadata;
}
async function resolveExpectedCastTrack(track: any) {
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
    }
    catch (loadErr) {
        console.error('[LocalCastService] Error resolving expected track during load:', loadErr);
    }
    return track;
}

async function getLocalCastTrack() {
    const activeIndex = await TrackPlayer.getActiveTrackIndex();
    let track: any = null;
    let fallback = false;
    if (activeIndex !== null && activeIndex !== undefined) {
        track = await TrackPlayer.getTrack(activeIndex);
    }
    // Fallback to usePlayerStore activeTrack if TrackPlayer is temporarily resolving track switch
    if (!track) {
        fallback = true;
        try {
            const { usePlayerStore } = require('../store/usePlayerStore');
            track = usePlayerStore.getState().activeTrack;
        }
        catch { }
    }
    track = await resolveExpectedCastTrack(track);
    return { activeIndex, track, fallback };
}

function selectLocalCastTrack(track: any, fallback: boolean) {
    const currentId = LocalCastPlaybackService.getState()?.activeTrackId;
    if (fallback && currentId?.split('-')[0] === String(track.id)) return;
    LocalCastPlaybackService.selectTrack(String(track.id));
}

function preloadCurrentTrack(activeIndex: number | undefined) {
    if (activeIndex == null || activeIndex === lastPreloadedIndex)
        return;
    lastPreloadedIndex = activeIndex;
    preloadNextTrack(activeIndex).catch(() => { });
}
function getLocalCastAppearance(knownTheme?: string | null) {
    const settings = useSettingsStore.getState();
    const theme = resolveLocalCastTheme(settings.userTier === 'VIP' ? settings.localCastTheme : 'default');
    return { theme, ...(knownTheme === theme ? {} : { themeCss: getLocalCastThemeCss(theme) }) };
}

function respondThemedState(res: any, urlObj: URL, state: object, status: number) {
    res.json({ ...state, ...getLocalCastAppearance(urlObj.searchParams.get('theme')) }, status);
}

function respondMissingTrack(res: any, castState: any, command: CastCommand | null, urlObj: URL) {
    if (activeMetadataCache && !isServerStopping) {
        respondThemedState(res, urlObj, { ...activeMetadataCache,
            isPlaying: castState.isCastPlaying, position: castState.castPosition,
            mediaFileName: activeMetadataCache.fileName, fileSize: activeMetadataCache.fileSize,
            duration: 0, command, sessionId: String(serverSessionId), isStopped: false, isTransitioning: true,
        }, 200);
        return;
    }
    respondThemedState(res, urlObj, { activeTrack: null, isPlaying: false, position: 0, duration: 0, command, isStopped: false }, 200);
}
async function respondLocalCastState(res: any, urlObj: URL) {
    const { useCastStore } = require('../store/useCastStore');
    const castState = useCastStore.getState();
    if (isServerStopping || !castState.isLocalCastActive) {
        respondThemedState(res, urlObj, { title: castState.isChromecastConnected ? 'Transmitiendo en Chromecast' : null,
            artist: castState.connectedDeviceName || 'MMPlayer', isPlaying: false, isStopped: true,
            isLocalCastActive: castState.isLocalCastActive }, 200);
        return;
    }
    const session = LocalCastPlaybackService.getState();
    if (session?.stopping) {
        respondThemedState(res, urlObj, { handoff: true, sessionId: String(serverSessionId) }, 200);
        return;
    }
    const lastCmd = Number(urlObj.searchParams.get('lastCmdId') || '0');
    const matchingSession = urlObj.searchParams.get('sessionId') === String(serverSessionId);
    const command = currentCommand && currentCommand.id > lastCmd && matchingSession ? currentCommand : null;
    const { activeIndex, track, fallback } = await getLocalCastTrack();
    if (!track) {
        respondMissingTrack(res, castState, command, urlObj);
        return;
    }
    selectLocalCastTrack(track, fallback);
    LocalCastPlaybackService.receive(urlObj.searchParams);
    const progress = await TrackPlayer.getProgress();
    const metadata = await getCastMetadata(track);
    const { isNormalizationEnabled, preampLevel, fallbackGainDB } = useSettingsStore.getState();
    const current = LocalCastPlaybackService.getState();
    const queue = await LocalCastQueueService.read(String(serverSessionId), urlObj.searchParams.get('queueVersion'), activeIndex);
    preloadCurrentTrack(activeIndex);
    respondThemedState(res, urlObj, { title: metadata.title, artist: metadata.artist, isPlaying: castState.isCastPlaying,
        position: current?.position(useCastStore.getState().castPosition) ?? 0,
        playbackToken: current?.token, handoff: current?.stopping ?? false, ...queue,
        duration: progress.duration, coverFileName: metadata.coverFileName, lyricsLRC: metadata.lyricsLRC,
        fileSize: metadata.fileSize, mimeType: metadata.mimeType, playIntent,
        replayGain: { enabled: isNormalizationEnabled, gainDb: metadata.replayGain, peak: metadata.replayPeak, preampDb: preampLevel, fallbackDb: fallbackGainDB },
        mediaFileName: metadata.fileName, command, sessionId: String(serverSessionId), isStopped: false }, 200);
}

function respondClientHtml(_req: any, res: any, urlObj: URL) {
    const currentLang = i18n.language || 'en';
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
        queueTitle: i18n.t('localcast_client.queue_title'),
        queueCurrent: i18n.t('localcast_client.queue_current'),
        queueEmpty: i18n.t('localcast_client.queue_empty'),
        queueMore: i18n.t('localcast_client.queue_more'),
        shuffleEnabled: i18n.t('localcast_client.shuffle_enabled'),
        shuffleDisabled: i18n.t('localcast_client.shuffle_disabled'),
    };
    const { theme: localCastTheme } = getLocalCastAppearance();
    res.html(getClientHtml(translations, localCastTheme), 200);
}

function handleCast(_req: any, res: any, urlObj: URL) {
    res.html(getChromecastHtml(), 200);
}

async function handleApiState(_req: any, res: any, urlObj: URL) { await respondLocalCastState(res, urlObj); }

function handleApiCover(_req: any, res: any, urlObj: URL) {
    res.json({ cover: null }, 200);
}

async function handleApiPlay(_req: any, res: any, urlObj: URL) {
    playIntent = false;
    await TrackPlayer.play();
    res.json({ success: true }, 200);
}

async function handleApiPause(_req: any, res: any, urlObj: URL) {
    await TrackPlayer.pause();
    res.json({ success: true }, 200);
}

async function handleApiSeek(_req: any, res: any, urlObj: URL) {
    const position = parseFloat(urlObj.searchParams.get('position') || '0');
    isSeekingFromPc = true;
    try {
        await TrackPlayer.seekTo(position);
    }
    finally {
        setTimeout(() => { isSeekingFromPc = false; }, 600);
    }
    res.json({ success: true }, 200);
}

async function handleApiNext(_req: any, res: any, urlObj: URL) {
    LocalCastPlaybackService.receive(urlObj.searchParams);
    const success = await LocalCastPlaybackService.advance();
    res.json({ success }, 200);
}

async function handleApiQueueSelect(_req: any, res: any, urlObj: URL) {
    const success = await LocalCastPlaybackService.selectQueueItem(urlObj.searchParams);
    res.json({ success }, success ? 200 : 409);
}

async function handleApiQueueCover(_req: any, res: any, urlObj: URL) {
    const index = Number(urlObj.searchParams.get('index') ?? '-1');
    const id = urlObj.searchParams.get('id') ?? '';
    const coverUrl = await LocalCastQueueService.cover(index, id, prepareCoverFile);
    res.json({ coverUrl }, 200);
}

function handleFavicon(_req: any, res: any, urlObj: URL) {
    res.send(204, 'image/x-icon', '');
}

async function handleApiPrevious(_req: any, res: any, urlObj: URL) {
    LocalCastPlaybackService.receive(urlObj.searchParams);
    await TrackPlayer.skipToPrevious();
    await TrackPlayer.play();
    res.json({ success: true }, 200);
}

const localCastRoutes: Record<string, (req: any, res: any, urlObj: URL) => void | Promise<void>> = {
    "GET /": respondClientHtml,
    "GET /cast": handleCast,
    "GET /chromecast": handleCast,
    "GET /api/state": handleApiState,
    "GET /api/cover": handleApiCover,
    "POST /api/play": handleApiPlay,
    "POST /api/pause": handleApiPause,
    "POST /api/seek": handleApiSeek,
    "POST /api/next": handleApiNext,
    "POST /api/queue/select": handleApiQueueSelect,
    "GET /api/queue/cover": handleApiQueueCover,
    "GET /favicon.ico": handleFavicon,
    "POST /api/previous": handleApiPrevious,
};

// ─── Service ──────────────────────────────────────────────────────────────────
export const LocalCastService = {
    getSessionId() { return String(serverSessionId); },
    createSessionId() {
        serverSessionId = Math.max(Date.now(), serverSessionId + 1);
        currentCommand = null;
        commandCounter = 0;
        playIntent = false;
        return String(serverSessionId);
    },
    setPlayIntent(value: boolean) { playIntent = value; },
    getPlayIntent() { return playIntent; },

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
                const method = req.type || 'GET';
                if (await handleCastReportRoute(method, urlObj.pathname, urlObj.searchParams, body => res.json(body, 200))) return;
                const handler = localCastRoutes[method + ' ' + urlObj.pathname];
                if (handler) { await handler(req, res, urlObj); return; }
                res.json({ error: 'Not found' }, 404);
            } catch (error: any) {
                console.error('[LocalCastService] Route handler error:', error);
                res.json({ error: error?.message || 'Server error' }, 500);
            }
        });

        server.listen(port);
        console.log(`[LocalCastService] Server started on port ${port}`);
    },

    async stop(): Promise<void> {
        LocalCastPlaybackService.clear();
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
        activeMetadataCache = null;
        lastPreloadedIndex = null;

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
