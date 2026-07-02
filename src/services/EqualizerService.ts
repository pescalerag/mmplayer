import {
    initializeEqualizer,
    setEqualizerEnabled,
    setEqualizerBandLevel,
    setEqualizerBassBoost,
    getEqualizerBandFrequencies,
    getEqualizerBandLevelRange,
    getEqualizerNumberOfBands,
} from '../../modules/native-equalizer';
import { useSettingsStore } from '../store/useSettingsStore';

export type BandLevelRange = { min: number; max: number };

let initialized = false;
let bandFrequencies: number[] = [];
let bandLevelRange: BandLevelRange = { min: -1500, max: 1500 };
let numberOfBands = 0;

export const EqualizerService = {
    async initialize(): Promise<void> {
        try {
            await initializeEqualizer(0);
            bandFrequencies = await getEqualizerBandFrequencies();
            bandLevelRange = await getEqualizerBandLevelRange();
            numberOfBands = await getEqualizerNumberOfBands();

            const { equalizerBands, setEqualizerBands } = useSettingsStore.getState();
            if (numberOfBands > 0 && equalizerBands.length !== numberOfBands) {
                const resized = Array.from({ length: numberOfBands }, (_, i) => equalizerBands[i] ?? 0);
                setEqualizerBands(resized);
            }

            initialized = true;
        } catch (e) {
            console.error('[EQ] Initialization failed:', e);
        }
    },

    async applyCurrentSettings(): Promise<void> {
        if (!initialized) await this.initialize();
        const { isEqualizerEnabled, equalizerBands, bassBoostStrength } = useSettingsStore.getState();
        try {
            await setEqualizerEnabled(isEqualizerEnabled);
            for (let i = 0; i < equalizerBands.length; i++) {
                await setEqualizerBandLevel(i, equalizerBands[i]);
            }
            await setEqualizerBassBoost(bassBoostStrength);
        } catch (e) {
            console.error('[EQ] Apply settings failed:', e);
        }
    },

    async setBandLevel(band: number, levelMb: number): Promise<void> {
        if (!initialized) await this.initialize();
        try {
            await setEqualizerBandLevel(band, levelMb);
        } catch (e) {
            console.error('[EQ] setBandLevel failed:', e);
        }
    },

    async setBassBoost(strength: number): Promise<void> {
        if (!initialized) await this.initialize();
        try {
            await setEqualizerBassBoost(strength);
        } catch (e) {
            console.error('[EQ] setBassBoost failed:', e);
        }
    },

    async setEnabled(enabled: boolean): Promise<void> {
        if (!initialized) await this.initialize();
        try {
            await setEqualizerEnabled(enabled);
        } catch (e) {
            console.error('[EQ] setEnabled failed:', e);
        }
    },

    getBandFrequencies(): number[] {
        return bandFrequencies;
    },

    getBandLevelRange(): BandLevelRange {
        return bandLevelRange;
    },

    getNumberOfBands(): number {
        return numberOfBands;
    },
};
