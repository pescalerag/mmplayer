import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettingsStore, UserTier } from '../store/useSettingsStore';
import { DEFAULT_VISUALIZER_COLOR, resolveVisualizerColor } from '../utils/visualizerColors';

describe('visualizer color selection', () => {
    const original = useSettingsStore.getState();
    beforeEach(() => {
        useSettingsStore.setState({ ...original, playerVisualizerColorMode: 'cover', playerVisualizerCustomColor: DEFAULT_VISUALIZER_COLOR });
        jest.clearAllMocks();
    });
    afterEach(() => useSettingsStore.setState(original));

    it('uses native cover and rainbow modes and follows the current accent', () => {
        expect(resolveVisualizerColor('cover', '#AABBCC', '#123456')).toBe('cover');
        expect(resolveVisualizerColor('rainbow', '#AABBCC', '#123456')).toBe('rainbow');
        expect(resolveVisualizerColor('accent', '#AABBCC', '#123456')).toBe('#AABBCC');
        expect(resolveVisualizerColor('accent', '#FF9A4B', '#123456')).toBe('#FF9A4B');
        expect(resolveVisualizerColor('custom', '#AABBCC', '#123456')).toBe('#123456');
    });

    it.each(['', '#FFFFF', 'invalid', 'rgba(0,0,0,0)'])('safely handles an invalid saved color: %s', custom => {
        expect(resolveVisualizerColor('custom', '#AABBCC', custom)).toBe(DEFAULT_VISUALIZER_COLOR);
    });

    it.each(['USER', 'SUPPORTER', 'VIP'] as UserTier[])('saves custom colors for %s without changing the app accent', tier => {
        useSettingsStore.setState({ userTier: tier, customAccentColor: '#AABBCC' });
        useSettingsStore.getState().setPlayerVisualizerCustomColor('#FF0044');
        expect(useSettingsStore.getState()).toMatchObject({
            playerVisualizerColorMode: 'custom', playerVisualizerCustomColor: '#FF0044', customAccentColor: '#AABBCC',
        });
        const [key, json] = (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1);
        expect(key).toBe('mmplayer-settings');
        expect(JSON.parse(json).state).toMatchObject({ playerVisualizerColorMode: 'custom', playerVisualizerCustomColor: '#FF0044' });

        useSettingsStore.getState().setPlayerVisualizerColorMode('rainbow');
        expect(useSettingsStore.getState().playerVisualizerColorMode).toBe('rainbow');
        expect(useSettingsStore.getState().playerVisualizerCustomColor).toBe('#FF0044');
        useSettingsStore.getState().setPlayerVisualizerColorMode('custom');
        expect(resolveVisualizerColor('custom', '#AABBCC', useSettingsStore.getState().playerVisualizerCustomColor)).toBe('#FF0044');
    });
});
