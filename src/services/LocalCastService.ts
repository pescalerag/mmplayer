import { BridgeServer } from 'react-native-http-bridge-refurbished';
import TrackPlayer from 'react-native-track-player';
import * as FileSystem from 'expo-file-system/legacy';
import { database } from '../database';
import Track from '../database/models/Track';
import { readFileChunk } from '../../modules/native-audio-scanner';
import { getClientHtml } from './LocalCastHtml';

// ─── Server instance ─────────────────────────────────────────────────────────
let server: BridgeServer | null = null;
let playIntent = false;

// ─── Audio track cache ────────────────────────────────────────────────────────
// The track file is copied to app-private cache so range-requests work on
// scoped-storage Android. We keep only the last track in cache.
let currentCachedTrackId: string | null = null;
let currentCachedTrackPath: string | null = null;
let cachePromise: Promise<string | null> | null = null;
let cachedMimeType = 'audio/mpeg';
let cachedFileSize = 0;

// Generation counter: detects when a newer track request came in while we were
// still copying an older one, so the stale result is discarded.
let cacheVersion = 0;

// ─── Cover image cache ────────────────────────────────────────────────────────
// The cover is read from disk ONCE per track change and kept in memory as
// base64. /api/state returns only a `coverToken` (track ID string); the web
// client fetches /api/cover separately when the token changes. This prevents
// re-reading a potentially large image file on every 1.5 s poll.
let cachedCoverTrackId: string | null = null;
let cachedCoverB64: string | null = null;
let coverCachePending: string | null = null; // Prevents redundant concurrent reads

async function prepareCoverB64(trackId: string, albumModel: any): Promise<void> {
    if (cachedCoverTrackId === trackId) return;   // Already cached
    if (coverCachePending === trackId) return;     // Being read right now

    coverCachePending = trackId;
    cachedCoverTrackId = null;
    cachedCoverB64 = null;

    if (!albumModel?.coverUrl) {
        coverCachePending = null;
        cachedCoverTrackId = trackId; // Mark as "no cover"
        return;
    }

    try {
        let b64: string | null = null;
        if (albumModel.coverUrl.startsWith('content://')) {
            const tempUri = `${FileSystem.cacheDirectory}temp_cover_${albumModel.id || 'art'}.jpg`;
            await FileSystem.copyAsync({ from: albumModel.coverUrl, to: tempUri });
            b64 = await FileSystem.readAsStringAsync(tempUri, { encoding: FileSystem.EncodingType.Base64 });
            try { await FileSystem.deleteAsync(tempUri, { idempotent: true }); } catch {}
        } else {
            let coverPath = albumModel.coverUrl;
            if (coverPath.startsWith('/')) coverPath = `file://${coverPath}`;
            b64 = await FileSystem.readAsStringAsync(coverPath, { encoding: FileSystem.EncodingType.Base64 });
        }
        cachedCoverB64 = b64;
        console.log(`[LocalCastService] Cover cached for trackId=${trackId} (${b64 ? Math.round(b64.length / 1024) + ' KB b64' : 'null'})`);
    } catch (err) {
        console.error('[LocalCastService] Error reading cover art:', err);
    } finally {
        cachedCoverTrackId = trackId;
        coverCachePending = null;
    }
}

// ─── Audio file cache ─────────────────────────────────────────────────────────
async function prepareTrackCache(track: any): Promise<{ filePath: string; fileSize: number; mimeType: string } | null> {
    if (!track || !track.url) return null;
    const trackId = track.id.toString();

    // Return already-cached result for the same track
    if (currentCachedTrackId === trackId && cachePromise) {
        const filePath = await cachePromise;
        if (filePath) return { filePath, fileSize: cachedFileSize, mimeType: cachedMimeType };
    }

    // Bump generation so any in-flight copy for a previous track is flagged as stale
    const myVersion = ++cacheVersion;
    currentCachedTrackId = null;

    cachePromise = (async () => {
        try {
            let filePath = track.url;

            if (!filePath.startsWith('content://') && !filePath.startsWith('file://')) {
                if (filePath.startsWith('/')) filePath = `file://${filePath}`;
            }

            // Derive extension to preserve audio format in the temp file
            let ext = 'mp3';
            const lastDot = filePath.lastIndexOf('.');
            if (lastDot !== -1 && !filePath.startsWith('content://')) {
                const parsedExt = filePath.substring(lastDot + 1).toLowerCase();
                if (parsedExt && parsedExt.length <= 4) ext = parsedExt;
            }

            const tempUri = `${FileSystem.cacheDirectory}temp_audio_cast.${ext}`;

            try { await FileSystem.deleteAsync(tempUri, { idempotent: true }); } catch {}
            try { await FileSystem.deleteAsync(`${FileSystem.cacheDirectory}temp_audio_cast.mp3`, { idempotent: true }); } catch {}

            await FileSystem.copyAsync({ from: filePath, to: tempUri });
            filePath = tempUri;

            // Stale check: another track was requested while we were copying
            if (myVersion !== cacheVersion) {
                console.log(`[LocalCastService] Stale cache discarded (version ${myVersion} < ${cacheVersion})`);
                try { await FileSystem.deleteAsync(tempUri, { idempotent: true }); } catch {}
                return null;
            }

            // MIME detection via magic bytes (format-agnostic, works for content:// URIs)
            let mimeType = 'audio/mpeg';
            try {
                const headerB64 = await readFileChunk(tempUri, 0, 16);
                if (headerB64) {
                    if      (headerB64.startsWith('ZkxhQ'))                            mimeType = 'audio/flac';
                    else if (headerB64.startsWith('T2dnUw'))                           mimeType = 'audio/ogg';
                    else if (headerB64.startsWith('UklGR'))                            mimeType = 'audio/wav';
                    else if (headerB64.startsWith('AAAA') || headerB64.startsWith('AAAB')) mimeType = 'audio/mp4';
                    else {
                        const urlLower = track.url ? track.url.toLowerCase() : '';
                        if      (urlLower.endsWith('.m4a') || urlLower.endsWith('.aac') || urlLower.endsWith('.mp4')) mimeType = 'audio/mp4';
                        else if (urlLower.endsWith('.flac')) mimeType = 'audio/flac';
                        else if (urlLower.endsWith('.wav'))  mimeType = 'audio/wav';
                        else if (urlLower.endsWith('.ogg'))  mimeType = 'audio/ogg';
                    }
                }
            } catch (err) {
                console.warn('[LocalCastService] Error reading magic bytes:', err);
            }

            cachedMimeType = mimeType;

            const fileInfo = await FileSystem.getInfoAsync(filePath);
            cachedFileSize = fileInfo.exists ? (fileInfo as any).size ?? 0 : 0;

            currentCachedTrackId   = trackId;
            currentCachedTrackPath = filePath;
            return filePath;
        } catch (err) {
            console.error('[LocalCastService] Error preparing track cache:', err);
            currentCachedTrackId   = null;
            currentCachedTrackPath = null;
            cachePromise           = null;
            return null;
        }
    })();

    const filePath = await cachePromise;
    if (!filePath) return null;
    return { filePath, fileSize: cachedFileSize, mimeType: cachedMimeType };
}

// ─── Service ──────────────────────────────────────────────────────────────────
export const LocalCastService = {
    setPlayIntent(value: boolean) { playIntent = value; },
    getPlayIntent() { return playIntent; },

    async start(port: number): Promise<void> {
        if (server) {
            try { await server.stop(); } catch {}
        }

        server = new BridgeServer('local-cast', true);

        // ── GET / — Web client HTML ──────────────────────────────────────────
        server.get('/', async (_req, res) => {
            res.html(getClientHtml(), 200);
        });

        // ── GET /api/state ────────────────────────────────────────────────────
        // Returns playback metadata. Cover is NOT included here; the client
        // uses `coverToken` to detect track changes and fetches /api/cover once.
        server.get('/api/state', async (_req, res) => {
            try {
                const activeIndex = await TrackPlayer.getActiveTrackIndex();
                if (activeIndex === null || activeIndex === undefined) {
                    res.json({ activeTrack: null, isPlaying: false, position: 0, duration: 0 }, 200);
                    return;
                }

                const track    = await TrackPlayer.getTrack(activeIndex);
                const progress = await TrackPlayer.getProgress();
                const state    = await TrackPlayer.getPlaybackState();
                const isPlaying = state.state === 'playing';

                const title  = track?.title  || 'Unknown Title';
                const artist = track?.artist || 'Unknown Artist';
                let lyricsLRC: string | null = null;
                let coverToken: string | null = null;

                if (track?.id) {
                    try {
                        const cleanId    = track.id.toString().split('-')[0];
                        const trackModel = await database.get<Track>('tracks').find(cleanId);
                        lyricsLRC = trackModel.lyricsLRC || null;

                        const albumModel = await trackModel.album.fetch();
                        if (albumModel?.coverUrl) {
                            // Fire-and-forget: first call starts the read, subsequent calls are instant
                            prepareCoverB64(cleanId, albumModel).catch(() => {});
                            // Return token only once the cover is actually cached
                            coverToken = cachedCoverTrackId === cleanId ? cleanId : null;
                        }
                    } catch (dbErr) {
                        console.error('[LocalCastService] DB error in /api/state:', dbErr);
                    }
                }

                const cacheInfo    = await prepareTrackCache(track);
                const resolvedMime = cacheInfo?.mimeType ?? 'audio/mpeg';
                const resolvedSize = cacheInfo?.fileSize ?? 0;
                const fileName     = cacheInfo?.filePath.split('/').pop() ?? null;

                console.log(`[LocalCastService] /api/state → "${title}" | playing:${isPlaying} | pos:${Math.round(progress.position)}s | coverToken:${coverToken}`);

                res.json({
                    title,
                    artist,
                    isPlaying,
                    position:      progress.position,
                    duration:      progress.duration,
                    coverToken,           // ID used by client to detect cover changes
                    lyricsLRC,
                    fileSize:      resolvedSize,
                    mimeType:      resolvedMime,
                    playIntent,
                    mediaFileName: fileName,
                }, 200);
            } catch (err: any) {
                console.error('[LocalCastService] Error in /api/state:', err);
                res.json({ error: err.message }, 500);
            }
        });

        // ── GET /api/cover ────────────────────────────────────────────────────
        // Serves the cached cover art base64. Called by the client only when
        // coverToken changes, not on every poll — so disk I/O is minimal.
        server.get('/api/cover', async (_req, res) => {
            res.json({
                cover: cachedCoverB64 ? `data:image/jpeg;base64,${cachedCoverB64}` : null,
                token: cachedCoverTrackId,
            }, 200);
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
                const url      = new URL(req.url, 'http://localhost');
                const position = parseFloat(url.searchParams.get('position') || '0');
                await TrackPlayer.seekTo(position);
                res.json({ success: true }, 200);
            } catch (err: any) {
                res.json({ error: err.message }, 500);
            }
        });

        server.listen(port);
        console.log(`[LocalCastService] Server started on port ${port}`);
    },

    async stop(): Promise<void> {
        if (server) {
            try { await server.stop(); } catch {}
            server = null;
        }
        // Clean up temp audio file
        if (currentCachedTrackPath) {
            try { await FileSystem.deleteAsync(currentCachedTrackPath, { idempotent: true }); } catch {}
            currentCachedTrackPath = null;
        }
        try {
            await FileSystem.deleteAsync(`${FileSystem.cacheDirectory}temp_audio_cast.mp3`, { idempotent: true });
        } catch {}
        // Reset all caches
        currentCachedTrackId = null;
        cachePromise         = null;
        cacheVersion         = 0;
        playIntent           = false;
        cachedCoverTrackId   = null;
        cachedCoverB64       = null;
        coverCachePending    = null;
        console.log('[LocalCastService] Server stopped, caches cleared');
    },
};
