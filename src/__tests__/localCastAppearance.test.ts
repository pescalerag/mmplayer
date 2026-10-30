import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettingsStore } from '../store/useSettingsStore';
import { getLocalCastThemeKey } from '../services/LocalCastHtml';

it('restores the custom LocalCast color across sessions independently of other appearance settings', async () => {
    const original = useSettingsStore.getState();
    const getItem = AsyncStorage.getItem as jest.Mock;
    try {
        useSettingsStore.setState({ userTier: 'VIP', customAccentColor: '#AABBCC', playerVisualizerCustomColor: '#FF0044' });
        useSettingsStore.getState().setLocalCastCustomColor('#12ABCD');
        const [key, json] = (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1);
        expect(key).toBe('mmplayer-settings');
        expect(JSON.parse(json).state).toMatchObject({ localCastTheme: 'custom', localCastCustomColor: '#12ABCD' });
        useSettingsStore.setState({ localCastTheme: 'default', localCastCustomColor: '#8B5CF6' });
        getItem.mockResolvedValueOnce(json);
        await useSettingsStore.persist.rehydrate();
        expect(useSettingsStore.getState()).toMatchObject({
            localCastTheme: 'custom', localCastCustomColor: '#12ABCD', customAccentColor: '#AABBCC', playerVisualizerCustomColor: '#FF0044',
        });
        expect(getLocalCastThemeKey('custom', useSettingsStore.getState().localCastCustomColor)).toBe('custom:#12ABCD');
    } finally {
        getItem.mockReset().mockResolvedValue(null);
        useSettingsStore.setState(original);
    }
});

it('persists LocalCast audio and visibility preferences without modifying app settings', async () => {
    const original = useSettingsStore.getState();
    const getItem = AsyncStorage.getItem as jest.Mock;
    try {
        useSettingsStore.setState({ isNormalizationEnabled: true, showTagColors: true });
        useSettingsStore.getState().setLocalCastReplayGainEnabled(false);
        useSettingsStore.getState().setLocalCastHideRatings(true);
        useSettingsStore.getState().setLocalCastHideTags(true);
        const [, json] = (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1);
        useSettingsStore.setState({ localCastReplayGainEnabled: null, localCastHideRatings: false, localCastHideTags: false });
        getItem.mockResolvedValueOnce(json);
        await useSettingsStore.persist.rehydrate();
        expect(useSettingsStore.getState()).toMatchObject({ localCastReplayGainEnabled: false, localCastHideRatings: true, localCastHideTags: true, isNormalizationEnabled: true, showTagColors: true });
    } finally {
        getItem.mockReset().mockResolvedValue(null); useSettingsStore.setState(original);
    }
});
