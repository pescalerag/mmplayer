import { create } from 'zustand';
import { LocalCastService } from '../services/LocalCastService';
import * as Network from 'expo-network';
import TrackPlayer from 'react-native-track-player';
import { useABRepeatStore } from './useABRepeatStore';

interface CastState {
    isServerRunning: boolean;
    serverIp: string;
    previousVolume: number;
    startServer: () => Promise<string>;
    stopServer: () => Promise<void>;
}

export const useCastStore = create<CastState>((set, get) => ({
    isServerRunning: false,
    serverIp: '',
    previousVolume: 1.0,
    startServer: async () => {
        try {
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
            await TrackPlayer.setVolume(0);

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

            set({ isServerRunning: true, serverIp: serverUrl, previousVolume: currentVol });
            return serverUrl;
        } catch (error: any) {
            console.error("[useCastStore] Failed to start cast server:", error);
            throw error;
        }
    },
    stopServer: async () => {
        try {
            await LocalCastService.stop();
            // Restore previous volume
            const prevVol = get().previousVolume;
            await TrackPlayer.setVolume(prevVol);
            set({ isServerRunning: false, serverIp: '' });
        } catch (error) {
            console.error("[useCastStore] Failed to stop cast server:", error);
        }
    }
}));
