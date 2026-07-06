import { create } from 'zustand';
import TrackPlayer from 'react-native-track-player';
import BackgroundTimer from 'react-native-background-timer';
import { AppState, AppStateStatus } from 'react-native';
import { useUIStore } from './useUIStore';

interface SleepTimerState {
    isVisible: boolean;
    isActive: boolean;
    timeLeft: number; // in seconds (solo para la UI)
    targetEndTime: number | null; // Timestamp exacto del final
    openSheet: () => void;
    closeSheet: () => void;
    startTimer: (minutes: number) => void;
    deactivate: () => void;
    tick: () => void;
    triggerExpire: () => void;
}

let uiIntervalId: any = null;
let bgTimeoutId: any = null;

// Helpers para gestionar los timers nativos de forma segura
const startUIInterval = (tickFn: () => void) => {
    if (uiIntervalId) {
        BackgroundTimer.clearInterval(uiIntervalId);
    }
    uiIntervalId = BackgroundTimer.setInterval(tickFn, 1000);
};

const stopUIInterval = () => {
    if (uiIntervalId) {
        BackgroundTimer.clearInterval(uiIntervalId);
        uiIntervalId = null;
    }
};

const startBackgroundTimeout = (delayMillis: number, onComplete: () => void) => {
    if (bgTimeoutId) {
        BackgroundTimer.clearTimeout(bgTimeoutId);
    }
    bgTimeoutId = BackgroundTimer.setTimeout(onComplete, delayMillis);
};

const stopBackgroundTimeout = () => {
    if (bgTimeoutId) {
        BackgroundTimer.clearTimeout(bgTimeoutId);
        bgTimeoutId = null;
    }
};

export const useSleepTimerStore = create<SleepTimerState>((set, get) => ({
    isVisible: false,
    isActive: false,
    timeLeft: 0,
    targetEndTime: null,
    
    openSheet: () => {
        useUIStore.getState().openSheet('sleep-timer');
    },
    closeSheet: () => {
        useUIStore.getState().closeSheet();
    },
    
    startTimer: (minutes: number) => {
        stopUIInterval();
        stopBackgroundTimeout();
        
        const totalSeconds = minutes * 60;
        const targetTime = Date.now() + totalSeconds * 1000; 
        
        set({ isActive: true, timeLeft: totalSeconds, targetEndTime: targetTime });
        
        // Si la aplicación está activa, iniciamos el intervalo visual
        if (AppState.currentState === 'active') {
            startUIInterval(() => get().tick());
        } else {
            // Si por alguna razón se inicia desde segundo plano, programamos el timeout directo
            const delay = Math.max(0, targetTime - Date.now());
            startBackgroundTimeout(delay, () => get().triggerExpire());
        }
    },
    
    deactivate: () => {
        stopUIInterval();
        stopBackgroundTimeout();
        set({ isActive: false, timeLeft: 0, targetEndTime: null });
    },
    
    tick: () => {
        const { targetEndTime } = get();
        if (!targetEndTime) return;

        const remainingMillis = targetEndTime - Date.now();
        const remainingSeconds = Math.max(0, Math.floor(remainingMillis / 1000));

        if (remainingSeconds <= 0) {
            get().triggerExpire();
        } else {
            set({ timeLeft: remainingSeconds });
        }
    },

    triggerExpire: () => {
        get().deactivate();
        TrackPlayer.pause().catch((err) => {
            console.error("Error pausing TrackPlayer via Sleep Timer:", err);
        });
    }
}));

// Sync with global UI store
useUIStore.subscribe((state) => {
    const isVisible = state.activeSheet === 'sleep-timer';
    if (useSleepTimerStore.getState().isVisible !== isVisible) {
        useSleepTimerStore.setState({ isVisible });
    }
});

// Suscribirse a cambios en el estado de la aplicación (AppState)
AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
    const store = useSleepTimerStore.getState();
    if (!store.isActive || !store.targetEndTime) return;

    if (nextAppState === 'active') {
        // Volvemos al primer plano:
        // Cancelamos el timeout de segundo plano y retomamos el intervalo visual de 1s
        stopBackgroundTimeout();
        
        const remainingMillis = store.targetEndTime - Date.now();
        const remainingSeconds = Math.max(0, Math.floor(remainingMillis / 1000));
        
        useSleepTimerStore.setState({ timeLeft: remainingSeconds });

        if (remainingSeconds <= 0) {
            store.triggerExpire();
        } else {
            startUIInterval(() => store.tick());
        }
    } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        // La app se minimiza / se apaga la pantalla:
        // Detenemos el intervalo visual (1s) para evitar desperdicio de batería/CPU
        stopUIInterval();
        
        // Programamos un ÚNICO timeout que pausará la reproducción exactamente a la hora fijada
        const delay = Math.max(0, store.targetEndTime - Date.now());
        startBackgroundTimeout(delay, () => store.triggerExpire());
    }
});
