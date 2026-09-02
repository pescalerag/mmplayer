import AsyncStorage from '@react-native-async-storage/async-storage';
import fallbackData from '../constants/hall_of_fame.json';

export interface HallOfFameMember {
    id: string;
    name: string;
    date: string;
    badge?: string;
    quote?: string;
}

export interface HallOfFameData {
    vip: HallOfFameMember[];
    supporters: HallOfFameMember[];
    lastUpdated?: string;
}

const STORAGE_KEY = '@mmplayer_hall_of_fame_cache';
// URL del JSON remoto en GitHub Pages y Raw GitHub
const REMOTE_HOF_URL = 'https://pescalerag.github.io/mmplayer-hall-of-fame/mmplayer-hall-of-fame.json';
const FALLBACK_REMOTE_URL = 'https://raw.githubusercontent.com/pescalerag/mmplayer-hall-of-fame/main/mmplayer-hall-of-fame.json';
const FALLBACK_REMOTE_URL_2 = 'https://raw.githubusercontent.com/pescalerag/mmplayer-hall-of-fame/main/hall_of_fame.json';
const FETCH_TIMEOUT_MS = 6000;

class HallOfFameServiceImpl {
    /**
     * Obtiene la lista de miembros del Salón de la Fama.
     * Intenta descargar del JSON remoto con timeout; si falla, recurre a la caché de AsyncStorage
     * o al archivo de fallback empaquetado.
     */
    public async getHallOfFameData(): Promise<HallOfFameData> {
        const urlsToTry = [REMOTE_HOF_URL, FALLBACK_REMOTE_URL, FALLBACK_REMOTE_URL_2];

        for (const url of urlsToTry) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

                const response = await fetch(url, {
                    signal: controller.signal,
                    headers: {
                        'Cache-Control': 'no-cache',
                    },
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    const data: HallOfFameData = await response.json();
                    if (Array.isArray(data.vip) && Array.isArray(data.supporters)) {
                        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                        return data;
                    }
                }
            } catch (error) {
                // Intenta la siguiente URL o pasa a caché local
            }
        }

        // Fallback 1: Caché local persistida en AsyncStorage
        try {
            const cached = await AsyncStorage.getItem(STORAGE_KEY);
            if (cached) {
                const parsed: HallOfFameData = JSON.parse(cached);
                if (Array.isArray(parsed.vip) && Array.isArray(parsed.supporters)) {
                    return parsed;
                }
            }
        } catch (e) {
            console.warn('Error reading Hall of Fame cache:', e);
        }

        // Fallback 2: Datos bundled por defecto
        return fallbackData as HallOfFameData;
    }
}

export const HallOfFameService = new HallOfFameServiceImpl();
