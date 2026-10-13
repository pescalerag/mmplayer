import TrackPlayer, { Event } from 'react-native-track-player';
import { requireNativeModule } from 'expo-modules-core';
import { EqualizerService } from '../services/EqualizerService';
import { useSettingsStore } from '../store/useSettingsStore';
import { changeEqualizerBandFromTouch } from '../utils/equalizerControls';

jest.mock('react-native-track-player', () => ({
    __esModule: true,
    Event: { PlaybackState: 'state', PlaybackActiveTrackChanged: 'track' },
    default: { addEventListener: jest.fn() },
}));

const native = requireNativeModule('NativeEqualizer');
const frequencies = [60, 230, 910, 3600, 14000];
const range = { min: -1500, max: 1500 };

describe('audio EQ and bass controls reach the native effects', () => {
    beforeEach(async () => {
        native.getNumberOfBands.mockResolvedValue(5);
        native.getBandFrequencies.mockResolvedValue(frequencies);
        native.getBandLevelRange.mockResolvedValue(range);
        useSettingsStore.setState({ isEqualizerEnabled: true, equalizerBands: [0, 0, 0, 0, 0], bassBoostStrength: 0 });
        await EqualizerService.initialize();
        jest.clearAllMocks();
    });

    it.each([0, 1, 2, 3, 4])('applies movement of frequency band %i to the saved setting and native effect', async band => {
        await changeEqualizerBandFromTouch(band, 25, 100, range);
        expect(useSettingsStore.getState().equalizerBands[band]).toBe(750);
        expect(native.setBandLevel).toHaveBeenLastCalledWith(band, 750);
        await changeEqualizerBandFromTouch(band, 75, 100, range);
        expect(useSettingsStore.getState().equalizerBands[band]).toBe(-750);
        expect(native.setBandLevel).toHaveBeenLastCalledWith(band, -750);
        await changeEqualizerBandFromTouch(band, 50, 100, range);
        expect(useSettingsStore.getState().equalizerBands[band]).toBe(0);
        expect(native.setBandLevel).toHaveBeenLastCalledWith(band, 0);
    });

    it('clamps gestures outside the track and ignores gestures before height is known', async () => {
        await changeEqualizerBandFromTouch(1, -20, 100, range);
        expect(native.setBandLevel).toHaveBeenLastCalledWith(1, 1500);
        await changeEqualizerBandFromTouch(1, 140, 100, range);
        expect(native.setBandLevel).toHaveBeenLastCalledWith(1, -1500);
        native.setBandLevel.mockClear();
        await changeEqualizerBandFromTouch(1, 20, 0, range);
        await changeEqualizerBandFromTouch(1, NaN, 100, range);
        expect(native.setBandLevel).not.toHaveBeenCalled();
    });

    it('applies bass movements and clamps strength to Android’s supported 0–1000 range', async () => {
        await EqualizerService.setBassBoost(640);
        expect(useSettingsStore.getState().bassBoostStrength).toBe(640);
        expect(native.setBassBoost).toHaveBeenLastCalledWith(640);
        await EqualizerService.setBassBoost(1500);
        expect(native.setBassBoost).toHaveBeenLastCalledWith(1000);
        await EqualizerService.setBassBoost(-20);
        expect(native.setBassBoost).toHaveBeenLastCalledWith(0);
    });

    it('keeps the last values when controls move rapidly', async () => {
        await Promise.all([
            changeEqualizerBandFromTouch(2, 0, 100, range),
            changeEqualizerBandFromTouch(2, 20, 100, range),
            changeEqualizerBandFromTouch(2, 80, 100, range),
            EqualizerService.setBassBoost(900), EqualizerService.setBassBoost(300),
        ]);
        expect(useSettingsStore.getState().equalizerBands[2]).toBe(-900);
        expect(native.setBandLevel).toHaveBeenLastCalledWith(2, -900);
        expect(native.setBassBoost).toHaveBeenLastCalledWith(300);
    });

    it('does not mark session zero as ready and applies pending movements when audio becomes available', async () => {
        native.getNumberOfBands.mockResolvedValue(0);
        native.getBandFrequencies.mockResolvedValue([]);
        expect(await EqualizerService.initialize()).toBe(false);
        await changeEqualizerBandFromTouch(0, 25, 100, range);
        await EqualizerService.setBassBoost(600);
        expect(native.setBandLevel).not.toHaveBeenCalled();
        expect(native.setBassBoost).not.toHaveBeenCalled();
        expect(useSettingsStore.getState().equalizerBands[0]).toBe(750);
        native.getNumberOfBands.mockResolvedValue(5);
        native.getBandFrequencies.mockResolvedValue(frequencies);
        await EqualizerService.applyCurrentSettings(true);
        expect(native.setEnabled).toHaveBeenCalledWith(true);
        expect(native.setBandLevel).toHaveBeenCalledWith(0, 750);
        expect(native.setBassBoost).toHaveBeenCalledWith(600);
    });

    it('reattaches saved effects on playback and track changes and removes listeners on cleanup', async () => {
        const callbacks: Record<string, () => void> = {};
        const remove = jest.fn();
        (TrackPlayer.addEventListener as jest.Mock).mockImplementation((event, callback) => {
            callbacks[event] = callback;
            return { remove };
        });
        const dispose = EqualizerService.subscribeToPlayback();
        await EqualizerService.applyCurrentSettings();
        jest.clearAllMocks();
        useSettingsStore.getState().setEqualizerBand(4, 1200);
        useSettingsStore.getState().setBassBoostStrength(700);
        callbacks[Event.PlaybackState]();
        callbacks[Event.PlaybackActiveTrackChanged]();
        await EqualizerService.applyCurrentSettings();
        expect(native.initialize).toHaveBeenCalledWith(0);
        expect(native.setBandLevel).toHaveBeenCalledWith(4, 1200);
        expect(native.setBassBoost).toHaveBeenCalledWith(700);
        dispose();
        expect(remove).toHaveBeenCalledTimes(2);
    });

    it('applies persisted effects after settings finish loading at startup', async () => {
        let hydrate: (() => void) | undefined;
        const unsubscribe = jest.fn();
        const hydration = jest.spyOn(useSettingsStore.persist, 'onFinishHydration').mockImplementation(callback => {
            hydrate = () => callback(useSettingsStore.getState());
            return unsubscribe;
        });
        (TrackPlayer.addEventListener as jest.Mock).mockReturnValue({ remove: jest.fn() });
        useSettingsStore.setState({ isEqualizerEnabled: false });
        const dispose = EqualizerService.subscribeToPlayback();
        useSettingsStore.setState({ isEqualizerEnabled: true, equalizerBands: [400, 0, 0, 0, 0], bassBoostStrength: 800 });
        hydrate!();
        await EqualizerService.applyCurrentSettings();
        expect(native.initialize).toHaveBeenCalledWith(0);
        expect(native.setBandLevel).toHaveBeenCalledWith(0, 400);
        expect(native.setBassBoost).toHaveBeenCalledWith(800);
        dispose();
        expect(unsubscribe).toHaveBeenCalledTimes(1);
        hydration.mockRestore();
    });

    it('enables with all saved values and disables both effects through the native bridge', async () => {
        useSettingsStore.setState({ equalizerBands: [100, 200, 300, 400, 500], bassBoostStrength: 450 });
        await EqualizerService.setEnabled(true);
        expect(native.setBandLevel).toHaveBeenCalledWith(4, 500);
        expect(native.setBassBoost).toHaveBeenCalledWith(450);
        await EqualizerService.setEnabled(false);
        expect(useSettingsStore.getState().isEqualizerEnabled).toBe(false);
        expect(native.setEnabled).toHaveBeenLastCalledWith(false);
    });
});
