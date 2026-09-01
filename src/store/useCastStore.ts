import { create } from 'zustand';
import { LocalCastService } from '../services/LocalCastService';
import * as Network from 'expo-network';
import TrackPlayer from 'react-native-track-player';
import { useABRepeatStore } from './useABRepeatStore';
import { acquireCastWakeLock, releaseCastWakeLock } from '../../modules/native-audio-scanner';

interface CastState {
    isServerRunning: boolean;
    isLocalCastActive: boolean;
    serverIp: string;
    previousVolume: number;
    selectedMode: 'local' | 'chromecast' | null;
    isChromecastConnected: boolean;
    isChromecastConnecting: boolean;
    connectedDeviceName: string | null;
    chromecastSession: any | null;
    castPosition: number;
    castDuration: number;
    isCastPlaying: boolean;
    castVolume: number;

    setCastPlayback: (pos: number, isPlaying: boolean, dur?: number) => void;
    setCastPlaying: (isPlaying: boolean) => void;
    setCastVolume: (volume: number) => void;
    setSelectedMode: (mode: 'local' | 'chromecast' | null) => void;
    startServer: () => Promise<string>;
    stopServer: () => Promise<void>;
    startLocalCast: () => Promise<string>;
    stopLocalCast: () => Promise<void>;
    setChromecastConnecting: (connecting: boolean) => void;
    setChromecastConnected: (connected: boolean, deviceName: string | null, session?: any) => void;
    disconnectChromecast: () => Promise<void>;
}

export const useCastStore = create<CastState>((set, get) => ({
    isServerRunning: false,
    isLocalCastActive: false,
    serverIp: '',

    previousVolume: 1.0,
    selectedMode: null,
    isChromecastConnected: false,
    isChromecastConnecting: false,
    connectedDeviceName: null,
    chromecastSession: null,
    castPosition: 0,
    castDuration: 0,
    isCastPlaying: false,
    castVolume: 0.8,

    setCastPlayback: (pos, isPlaying, dur) => {
        set((state) => ({
            castPosition: pos >= 0 ? pos : state.castPosition,
            isCastPlaying: typeof isPlaying === 'boolean' ? isPlaying : state.isCastPlaying,
            castDuration: (dur && dur > 0) ? dur : state.castDuration,
        }));
    },

    setCastPlaying: (isPlaying) => {
        set({ isCastPlaying: isPlaying });
    },

    setCastVolume: (volume) => {
        set({ castVolume: volume });
    },

    setSelectedMode: (mode) => set({ selectedMode: mode }),

    setChromecastConnecting: (connecting) => set({ isChromecastConnecting: connecting }),

    setChromecastConnected: (connected, deviceName, session = null) => {
        set({
            isChromecastConnected: connected,
            isChromecastConnecting: false,
            connectedDeviceName: deviceName,
            chromecastSession: session,
        });
    },

    disconnectChromecast: async () => {
        try {
            const { ChromecastService } = require('../services/ChromecastService');
            await ChromecastService.endSession();
        } catch (err) {
            console.error('[useCastStore] Failed to disconnect Chromecast:', err);
        } finally {
            // If local cast is not active, stop HTTP server and restore volume
            if (!get().isLocalCastActive) {
                await get().stopServer();
            }
            set({
                isChromecastConnected: false,
                isChromecastConnecting: false,
                connectedDeviceName: null,
                chromecastSession: null,
            });
        }
    },

    startServer: async () => {
        try {
            if (get().isServerRunning && get().serverIp) {
                return get().serverIp;
            }

            // Check network state
            const networkState = await Network.getNetworkStateAsync();
            if (!networkState.isConnected) {
                throw new Error('No hay conexión de red activa.');
            }

            const ip = await Network.getIpAddressAsync();
            if (!ip || ip === '0.0.0.0' || ip.includes(':')) {
                // If it is an IPv6 or fallback, raise a Wi-Fi warning
                throw new Error('No se pudo detectar una IP local de Wi-Fi válida.');
            }

            const port = 8080;
            const serverUrl = `http://${ip}:${port}`;

            await LocalCastService.start(port);

            // Acquire CPU WakeLock and High Performance Wi-Fi Lock
            await acquireCastWakeLock();

            // Read the current volume to restore it later, then set volume to 0
            const currentVol = await TrackPlayer.getVolume();
            const safeVolume = (currentVol !== undefined && currentVol > 0.05) 
                ? currentVol 
                : ((get().previousVolume !== undefined && get().previousVolume > 0.05) ? get().previousVolume : 1.0);

            // Clean up A-B loop points
            useABRepeatStore.getState().clearAB();

            // Reset speed, pitch, and sleep timer to default values
            try {
                const { usePlayerStore } = require('./usePlayerStore');
                const { useSleepTimerStore } = require('./useSleepTimerStore');
                await usePlayerStore.getState().setPlaybackSpeed(1.0);
                await usePlayerStore.getState().setPlaybackPitch(1.0);
                useSleepTimerStore.getState().deactivate();
            } catch (err) {
                console.error("Error resetting player state on cast start:", err);
            }

            set({ isServerRunning: true, serverIp: serverUrl, previousVolume: safeVolume });
            await TrackPlayer.setVolume(0);
            return serverUrl;
        } catch (error: any) {
            console.error("[useCastStore] Failed to start cast server:", error);
            await releaseCastWakeLock();
            throw error;
        }
    },

    stopServer: async () => {
        try {
            await LocalCastService.stop();
            // Release CPU & Wi-Fi locks
            await releaseCastWakeLock();

            // Restore previous volume safely
            const prevVol = (get().previousVolume !== undefined && get().previousVolume > 0.05)
                ? get().previousVolume
                : 1.0;
            
            try {
                await TrackPlayer.setVolume(prevVol);
            } catch (err) {
                console.error("[useCastStore] Failed to restore volume", err);
            }

            set({
                isServerRunning: false,
                isLocalCastActive: false,
                serverIp: '',
                castPosition: 0,
                castDuration: 0,
                isCastPlaying: false,
            });
        } catch (error) {
            console.error("[useCastStore] Failed to stop cast server:", error);
            await releaseCastWakeLock();
        }
    },

    startLocalCast: async () => {
        let nativePos = 0;
        let isPlaying = false;
        let activeCleanId: string | null = null;
        try {
            const progress = await TrackPlayer.getProgress();
            nativePos = progress.position;
            const state = await TrackPlayer.getPlaybackState();
            isPlaying = state.state === 'playing';
            const { usePlayerStore } = require('./usePlayerStore');
            const track = usePlayerStore.getState().activeTrack;
            if (track?.id) {
                activeCleanId = track.id.toString().split('-')[0];
            }
        } catch (e) {}

        LocalCastService.setInitialResumePosition(nativePos, activeCleanId);
        const url = await get().startServer();
        set({ 
            isLocalCastActive: true, 
            selectedMode: 'local',
            castPosition: nativePos,
            isCastPlaying: isPlaying
        });
        return url;
    },

    stopLocalCast: async () => {
        try {
            // 1. Capture current playback position, playing state, and volume before stopping
            const currentCastPos = get().castPosition;
            const wasPlaying = get().isCastPlaying;
            const prevVol = (get().previousVolume !== undefined && get().previousVolume > 0.05)
                ? get().previousVolume
                : 1.0;

            // 2. Cut PC playback immediately by sending STOP command
            LocalCastService.emitStop();

            // 3. Mark LocalCast inactive in store so native hooks resume local control
            set({ isLocalCastActive: false, isCastPlaying: false });

            // 4. Seek native TrackPlayer to the exact point the song was at on the PC
            if (currentCastPos > 0) {
                await TrackPlayer.seekTo(currentCastPos);
            }

            // 5. Restore volume on the mobile
            await TrackPlayer.setVolume(prevVol);

            // 6. Resume or keep paused according to what the PC was doing
            if (wasPlaying) {
                await TrackPlayer.play();
            } else {
                await TrackPlayer.pause();
            }

            // 7. Grace period for PC to receive the final STOP event before shutting down the socket.
            // Since the PC polls every 1.5s - 2.5s, we need to keep the server alive slightly longer 
            // in the background so it can respond with 'isStopped: true'
            await new Promise((resolve) => setTimeout(resolve, 2500));

            // 8. Shut down HTTP server and clear all cast caches
            if (!get().isChromecastConnected) {
                await get().stopServer();
            }
        } catch (error) {
            console.error('[useCastStore] Error stopping local cast:', error);
            set({ isLocalCastActive: false });
            if (!get().isChromecastConnected) {
                await get().stopServer();
            }
        }
    }
}));
