import CastContext, {
    CastSession,
    MediaStreamType,
    RemoteMediaClient,
} from 'react-native-google-cast';
import TrackPlayer from 'react-native-track-player';
import { LocalCastService } from './LocalCastService';

import { useCastStore } from '../store/useCastStore';
import { useToastStore } from '../store/useToastStore';
import { database } from '../database';
import Track from '../database/models/Track';

const CAST_NAMESPACE = 'urn:x-cast:com.pescalerag.mmplayer';

let isInitialized = false;
let sessionListenersAttached = false;
let activeCastChannel: any = null;
let lastSkipTime = 0;


export const ChromecastService = {
    init() {
        if (isInitialized) return;
        isInitialized = true;

        this.setupSessionListeners();
    },

    setupSessionListeners() {
        if (sessionListenersAttached) return;
        sessionListenersAttached = true;

        try {
            const sessionManager = CastContext.getSessionManager();

            sessionManager.onSessionStarting(() => {
                console.log('[ChromecastService] Session starting...');
                useCastStore.getState().setChromecastConnecting(true);
            });

            sessionManager.onSessionStarted(async (session: CastSession) => {
                console.log('[ChromecastService] Session started successfully');
                let deviceName = 'Chromecast';
                try {
                    const device = await session.getCastDevice();
                    if (device?.friendlyName) {
                        deviceName = device.friendlyName;
                    }
                } catch (e) {
                    console.warn('[ChromecastService] Could not get cast device:', e);
                }

                useCastStore.getState().setChromecastConnected(true, deviceName, session);
                useToastStore.getState().showToast(
                    `Conectado a ${deviceName}`,
                    'tv-outline',
                    '#60A5FA'
                );

                let initialTrackLoaded = false;
                let loadInitialTrackFn: (() => Promise<void>) | null = null;

                // Setup custom bidirectional message channel
                try {
                    if (activeCastChannel) {
                        try { activeCastChannel.offMessage(); activeCastChannel.remove(); } catch (e) {}
                        activeCastChannel = null;
                    }
                    activeCastChannel = await session.addChannel(CAST_NAMESPACE);
                    if (activeCastChannel) {
                        activeCastChannel.onMessage((msg: any) => {
                            try {
                                const data = typeof msg === 'string' ? JSON.parse(msg) : msg;
                                console.log('[ChromecastService] Message received from TV:', data);
                                if (data?.action === 'RECEIVER_READY') {
                                    console.log('[ChromecastService] TV Receiver ready signal received!');
                                    if (loadInitialTrackFn) {
                                        loadInitialTrackFn();
                                    }
                                } else if (data?.action === 'TRACK_ENDED' || data?.action === 'NEXT_TRACK') {
                                    const now = Date.now();
                                    if (now - lastSkipTime > 2000) {
                                        lastSkipTime = now;
                                        console.log('[ChromecastService] Advancing queue from TV message...');
                                        TrackPlayer.skipToNext().then(() => TrackPlayer.play()).catch(() => {});
                                    }
                                }
                            } catch (err) {
                                console.warn('[ChromecastService] Error processing TV message:', err);
                            }
                        });
                    }
                } catch (channelErr) {
                    console.warn('[ChromecastService] Error setting up Cast channel:', channelErr);
                }

                try {
                    // Ensure the local HTTP media server is running so Chromecast can fetch audio
                    let serverUrl = useCastStore.getState().serverIp;
                    if (!serverUrl || !useCastStore.getState().isServerRunning) {
                        serverUrl = await useCastStore.getState().startServer();
                    }

                    // Sync the currently playing track to the Chromecast
                    let trackToLoad: any = null;
                    const activeIndex = await TrackPlayer.getActiveTrackIndex();
                    if (activeIndex !== null && activeIndex !== undefined) {
                        trackToLoad = await TrackPlayer.getTrack(activeIndex);
                    }
                    if (!trackToLoad) {
                        try {
                            const { usePlayerStore } = require('../store/usePlayerStore');
                            trackToLoad = usePlayerStore.getState().activeTrack;
                        } catch (e) {}
                    }
                    if (trackToLoad) {
                        console.log('[ChromecastService] Preparing initial track on connect:', trackToLoad.title);
                        const { LocalCastService } = require('./LocalCastService');
                        const preparePromise = LocalCastService.prepareTrack(trackToLoad).catch((e: any) => {
                            console.warn('[ChromecastService] Early prepareTrack failed:', e);
                            return null;
                        });

                        const progress = await TrackPlayer.getProgress().catch(() => ({ position: 0, duration: 0 }));
                        const initialPosition = progress.position || 0;

                        loadInitialTrackFn = async () => {
                            if (initialTrackLoaded) return;
                            initialTrackLoaded = true;
                            try {
                                await preparePromise;
                                await this.loadTrack(trackToLoad, session.client, initialPosition);
                            } catch (loadErr) {
                                console.warn('[ChromecastService] Initial loadTrack attempt failed, retrying in 1s with position 0...', loadErr);
                                setTimeout(() => {
                                    this.loadTrack(trackToLoad, null, 0).catch(() => {});
                                }, 1000);
                            }
                        };

                        // Fallback trigger after 1.2s if RECEIVER_READY message was not caught
                        setTimeout(() => {
                            if (!initialTrackLoaded && loadInitialTrackFn) {
                                console.log('[ChromecastService] Triggering initial track load via timeout fallback...');
                                loadInitialTrackFn();
                            }
                        }, 1200);
                    } else {
                        console.log('[ChromecastService] No active track found to load on connect');
                    }
                } catch (err: any) {
                    console.error('[ChromecastService] Error on session started:', err);
                    useToastStore.getState().showToast(
                        `Error al sincronizar con Chromecast: ${err?.message || 'Error del servidor local'}`,
                        'alert-circle-outline',
                        '#EF4444'
                    );
                }
            });

            sessionManager.onSessionEnding(() => {
                console.log('[ChromecastService] Session ending...');
            });

            sessionManager.onSessionEnded(async () => {
                console.log('[ChromecastService] Session ended');
                if (activeCastChannel) {
                    try { activeCastChannel.offMessage(); activeCastChannel.remove(); } catch (e) {}
                    activeCastChannel = null;
                }

                useCastStore.getState().setChromecastConnected(false, null, null);
                if (!useCastStore.getState().isLocalCastActive) {
                    await useCastStore.getState().stopServer();
                }
            });

            sessionManager.onSessionStartFailed(async (session: CastSession, error: string) => {
                console.error('[ChromecastService] Session start failed:', error, session);
                if (activeCastChannel) {
                    try { activeCastChannel.offMessage(); activeCastChannel.remove(); } catch (e) {}
                    activeCastChannel = null;
                }
                const errorDetails = error || 'Error al iniciar conexión';
                useToastStore.getState().showToast(
                    `Fallo al conectar con Chromecast: ${errorDetails}`,
                    'alert-circle-outline',
                    '#EF4444'
                );
                useCastStore.getState().setChromecastConnecting(false);
                if (!useCastStore.getState().isLocalCastActive) {
                    await useCastStore.getState().stopServer();
                }
            });

            sessionManager.onSessionSuspended(() => {
                console.log('[ChromecastService] Session suspended');
            });

            sessionManager.onSessionResumed(async (session: CastSession) => {
                console.log('[ChromecastService] Session resumed');
                let deviceName = 'Chromecast';
                try {
                    const device = await session.getCastDevice();
                    if (device?.friendlyName) {
                        deviceName = device.friendlyName;
                    }
                } catch (e) {
                    console.warn('[ChromecastService] Could not get cast device on resume:', e);
                }
                useCastStore.getState().setChromecastConnected(true, deviceName, session);
            });
        } catch (error) {
            console.warn('[ChromecastService] Failed to set up session listeners:', error);
        }
    },

    async startSession(deviceId?: string): Promise<void> {
        try {
            this.init();
            useCastStore.getState().setChromecastConnecting(true);

            const sessionManager = CastContext.getSessionManager();
            if (deviceId) {
                console.log('[ChromecastService] Starting session with deviceId:', deviceId);
                const started = await sessionManager.startSession(deviceId);
                if (!started) {
                    console.log('[ChromecastService] startSession returned false, showing dialog');
                    await CastContext.showCastDialog();
                }
            } else {
                console.log('[ChromecastService] Opening system Cast dialog...');
                await CastContext.showCastDialog();
            }
        } catch (e: any) {
            console.warn('[ChromecastService] startSession failed:', e);
            useCastStore.getState().setChromecastConnecting(false);
            if (!useCastStore.getState().isLocalCastActive) {
                await useCastStore.getState().stopServer();
            }
            throw e;
        }
    },

    async endSession(): Promise<void> {
        try {
            const sessionManager = CastContext.getSessionManager();
            await sessionManager.endCurrentSession(true);
        } catch (error: any) {
            console.error('[ChromecastService] Failed to end session:', error);
        } finally {
            if (activeCastChannel) {
                try { activeCastChannel.offMessage(); activeCastChannel.remove(); } catch (e) {}
                activeCastChannel = null;
            }
            useCastStore.getState().setChromecastConnected(false, null, null);
            if (!useCastStore.getState().isLocalCastActive) {
                await useCastStore.getState().stopServer();
            }
        }
    },

    async sendLyricsUpdate(lyricsLRC: string): Promise<void> {
        try {
            if (activeCastChannel) {
                await activeCastChannel.sendMessage({
                    action: 'UPDATE_LYRICS',
                    lyricsLRC,
                });
                console.log('[ChromecastService] Sent out-of-band lyrics to TV via activeCastChannel');
                return;
            }
            const sessionManager = CastContext.getSessionManager();
            const session = await sessionManager.getCurrentCastSession();
            if (session) {
                const channel = await session.addChannel(CAST_NAMESPACE);
                if (channel) {
                    await channel.sendMessage({
                        action: 'UPDATE_LYRICS',
                        lyricsLRC,
                    });
                    console.log('[ChromecastService] Sent out-of-band lyrics to TV');
                }
            }
        } catch (err) {
            console.warn('[ChromecastService] Failed to send out-of-band lyrics:', err);
        }
    },

    async loadTrack(track: any, clientOverride?: RemoteMediaClient | null, startPosition: number = 0): Promise<void> {
        try {
            const sessionManager = CastContext.getSessionManager();
            const session = await sessionManager.getCurrentCastSession();
            const client = clientOverride || session?.client;

            if (!client || !track) {
                console.warn('[ChromecastService] client or track not available for loadTrack');
                return;
            }

            let serverUrl = useCastStore.getState().serverIp;
            if (!serverUrl || !useCastStore.getState().isServerRunning) {
                serverUrl = await useCastStore.getState().startServer();
            }

            const baseUrl = serverUrl;
            console.log(`[ChromecastService] Using baseUrl for Chromecast: ${baseUrl}`);

            const cacheInfo = await LocalCastService.prepareTrack(track);
            if (!cacheInfo || !cacheInfo.filePath) {
                const errMsg = 'No se pudo preparar el archivo de audio para transmitir.';
                console.error('[ChromecastService]', errMsg);
                useToastStore.getState().showToast(errMsg, 'alert-circle-outline', '#EF4444');
                return;
            }

            const fileName = cacheInfo.filePath.split('/').pop() || 'temp_audio_cast.mp3';
            const mimeType = cacheInfo.mimeType || 'audio/mpeg';

            let cleanCoverUrl: string | null = null;
            let lyricsLRC: string | null = null;
            let title = track.title || 'Desconocido';
            let artist = track.artist || 'Desconocido';
            let albumTitle = track.album || track.albumTitle || '';

            const cleanId = track.id ? track.id.toString().split('-')[0] : '';
            if (cleanId) {
                try {
                    const trackModel = await database.get<Track>('tracks').find(cleanId);
                    if (trackModel) {
                        lyricsLRC = trackModel.lyricsLRC || null;
                        title = trackModel.title || title;
                        const albumModel = await trackModel.album.fetch().catch(() => null);
                        if (albumModel) {
                            albumTitle = albumModel.title || albumTitle;
                            if (albumModel.coverUrl) {
                                const coverFileName = await LocalCastService.prepareCover(cleanId, albumModel);
                                if (coverFileName) {
                                    cleanCoverUrl = `${baseUrl}/static/${coverFileName}`;
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error('[ChromecastService] Error preparing metadata for Chromecast:', e);
                }
            }

            const cleanAudioUrl = `${baseUrl}/static/${fileName}`;

            console.log(`[ChromecastService] Official loadMedia: "${title}" -> ${cleanAudioUrl} (startPosition: ${startPosition})`);

            // Proactively preload next track audio & cover
            const activeIndex = await TrackPlayer.getActiveTrackIndex().catch(() => null);
            if (activeIndex !== null && activeIndex !== undefined) {
                LocalCastService.triggerPreloadNext(activeIndex).catch(() => {});
            }

            const mediaPayload = {
                autoplay: true,
                startTime: startPosition > 0 ? startPosition : 0,
                customData: {
                    serverUrl: baseUrl,
                    lyricsLRC: lyricsLRC || null,
                },
                mediaInfo: {
                    contentId: cleanAudioUrl,
                    contentUrl: cleanAudioUrl,
                    streamType: MediaStreamType.BUFFERED,
                    contentType: mimeType,
                    customData: {
                        serverUrl: baseUrl,
                        lyricsLRC: lyricsLRC || null,
                    },
                    metadata: {
                        type: 'musicTrack' as const,
                        title,
                        artist,
                        albumTitle,
                        images: cleanCoverUrl ? [{ url: cleanCoverUrl }] : undefined,
                    },
                },
            };

            // 1. Carga Ligera Oficial con reintento automático
            try {
                await client.loadMedia(mediaPayload as any);
            } catch (firstErr: any) {
                console.warn('[ChromecastService] loadMedia attempt 1 failed, retrying in 800ms...', firstErr);
                await new Promise(res => setTimeout(res, 800));
                await client.loadMedia(mediaPayload as any);
            }

            console.log('[ChromecastService] Official loadMedia accepted by Cast SDK!');

            // 2. Silenciar el reproductor local para evitar audio doble
            await TrackPlayer.setVolume(0);

            // 3. Reset castPosition in store so UI shows startPosition for the track
            useCastStore.setState({ castPosition: startPosition > 0 ? startPosition : 0 });

            // 4. Datos Fuera de Banda: Asegurar envío de letras LRC por canal personalizado
            if (lyricsLRC) {
                setTimeout(() => {
                    this.sendLyricsUpdate(lyricsLRC!).catch(() => {});
                }, 300);
            }
        } catch (error: any) {
            console.error('[ChromecastService] Error loading track on Chromecast:', error);
            const msg = error?.message || 'Error desconocido';
            useToastStore.getState().showToast(
                `Error al cargar en Chromecast: ${msg}`,
                'alert-circle-outline',
                '#EF4444'
            );
            throw error;
        }
    },

    async play(): Promise<void> {
        try {
            const session = await CastContext.getSessionManager().getCurrentCastSession();
            if (session?.client) {
                await session.client.play();
            }
        } catch (e) {
            console.error('[ChromecastService] play error:', e);
        }
    },

    async pause(): Promise<void> {
        try {
            const session = await CastContext.getSessionManager().getCurrentCastSession();
            if (session?.client) {
                await session.client.pause();
            }
        } catch (e) {
            console.error('[ChromecastService] pause error:', e);
        }
    },

    async seekTo(position: number): Promise<void> {
        try {
            const session = await CastContext.getSessionManager().getCurrentCastSession();
            if (session?.client) {
                await session.client.seek({ position });
            }
        } catch (e) {
            console.error('[ChromecastService] seek error:', e);
        }
    },

    async setVolume(volume: number): Promise<void> {
        try {
            const session = await CastContext.getSessionManager().getCurrentCastSession();
            if (session?.client) {
                await session.client.setStreamVolume(volume);
            }
        } catch (e) {
            console.error('[ChromecastService] setVolume error:', e);
        }
    },
};


