import { create } from 'zustand';
import { LocalCastService } from '../services/LocalCastService';
import * as Network from 'expo-network';
import TrackPlayer from 'react-native-track-player';
import { useABRepeatStore } from './useABRepeatStore';

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
            throw error;
        }
    },

    stopServer: async () => {
        try {
            await LocalCastService.stop();
            // Restore previous volume safely
            const prevVol = (get().previousVolume !== undefined && get().previousVolume > 0.05)
                ? get().previousVolume
                : 1.0;
            await TrackPlayer.setVolume(prevVol);
            set({ isServerRunning: false, isLocalCastActive: false, serverIp: '' });
        } catch (error) {
            console.error("[useCastStore] Failed to stop cast server:", error);
        }
    },

    startLocalCast: async () => {
        const url = await get().startServer();
        set({ isLocalCastActive: true, selectedMode: 'local' });
        return url;
    },

    stopLocalCast: async () => {
        set({ isLocalCastActive: false });
        if (!get().isChromecastConnected) {
            await get().stopServer();
        }
    }
}));
