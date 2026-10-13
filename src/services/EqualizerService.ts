import {
    initializeEqualizer, setEqualizerEnabled, setEqualizerBandLevel, setEqualizerBassBoost,
    getEqualizerBandFrequencies, getEqualizerBandLevelRange, getEqualizerNumberOfBands,
} from '../../modules/native-equalizer';
import TrackPlayer, { Event } from 'react-native-track-player';
import { useSettingsStore } from '../store/useSettingsStore';

export type BandLevelRange = { min: number; max: number };
let initialized = false;
let initialization: Promise<boolean> | null = null;
let commands: Promise<void> = Promise.resolve();
let bandFrequencies: number[] = [];
let bandLevelRange: BandLevelRange = { min: -1500, max: 1500 };
let numberOfBands = 0;

function enqueue(command: () => Promise<void>): Promise<void> {
    const request = commands.then(command);
    commands = request.catch(error => { console.error('[EQ] Audio command failed:', error); });
    return commands;
}

export const EqualizerService = {
    initialize(): Promise<boolean> {
        if (initialization) return initialization;
        initialization = (async () => {
            await initializeEqualizer(0);
            const [frequencies, range, count] = await Promise.all([
                getEqualizerBandFrequencies(), getEqualizerBandLevelRange(), getEqualizerNumberOfBands(),
            ]);
            bandFrequencies = frequencies;
            bandLevelRange = range;
            numberOfBands = count;
            initialized = count > 0 && frequencies.length === count;
            if (!initialized) return false;
            const { equalizerBands, setEqualizerBands } = useSettingsStore.getState();
            if (equalizerBands.length !== count) {
                setEqualizerBands(Array.from({ length: count }, (_, i) => equalizerBands[i] ?? 0));
            }
            return true;
        })().catch(error => {
            initialized = false;
            console.error('[EQ] Initialization failed:', error);
            return false;
        }).finally(() => { initialization = null; });
        return initialization;
    },

    applyCurrentSettings(refreshSession = false): Promise<void> {
        return enqueue(async () => {
            if (refreshSession || !initialized) await EqualizerService.initialize();
            if (!initialized) return;
            const { isEqualizerEnabled, equalizerBands, bassBoostStrength } = useSettingsStore.getState();
            await setEqualizerEnabled(isEqualizerEnabled);
            for (let i = 0; i < numberOfBands; i++) await setEqualizerBandLevel(i, equalizerBands[i] ?? 0);
            await setEqualizerBassBoost(bassBoostStrength);
        });
    },

    setBandLevel(band: number, levelMb: number): Promise<void> {
        if (!Number.isInteger(band) || band < 0 || !Number.isFinite(levelMb)) return Promise.resolve();
        useSettingsStore.getState().setEqualizerBand(band, Math.round(levelMb));
        return enqueue(async () => {
            if (!initialized) await EqualizerService.initialize();
            if (!initialized || band >= numberOfBands) return;
            const level = Math.max(bandLevelRange.min, Math.min(bandLevelRange.max, useSettingsStore.getState().equalizerBands[band]));
            if (level !== useSettingsStore.getState().equalizerBands[band]) useSettingsStore.getState().setEqualizerBand(band, level);
            await setEqualizerBandLevel(band, level);
        });
    },

    setBassBoost(strength: number): Promise<void> {
        if (!Number.isFinite(strength)) return Promise.resolve();
        useSettingsStore.getState().setBassBoostStrength(Math.max(0, Math.min(1000, Math.round(strength))));
        return enqueue(async () => {
            if (!initialized) await EqualizerService.initialize();
            if (initialized) await setEqualizerBassBoost(useSettingsStore.getState().bassBoostStrength);
        });
    },

    setEnabled(enabled: boolean): Promise<void> {
        useSettingsStore.getState().setIsEqualizerEnabled(enabled);
        return EqualizerService.applyCurrentSettings();
    },

    subscribeToPlayback(): () => void {
        const refresh = () => {
            if (useSettingsStore.getState().isEqualizerEnabled) void EqualizerService.applyCurrentSettings(true);
        };
        const state = TrackPlayer.addEventListener(Event.PlaybackState, refresh);
        const track = TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, refresh);
        const stopHydrationListener = useSettingsStore.persist.onFinishHydration(refresh);
        refresh();
        return () => { state.remove(); track.remove(); stopHydrationListener(); };
    },

    getBandFrequencies: () => bandFrequencies,
    getBandLevelRange: () => bandLevelRange,
    getNumberOfBands: () => numberOfBands,
};
