import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeOpaqueColor } from '../utils/customColors';
import { resolveVisualizerColor } from '../utils/visualizerColors';
import { getLocalCastThemeCss, getLocalCastThemeKey } from '../services/LocalCastHtml';
import { openColorPickerModal, useColorPickerModalStore } from '../store/useColorPickerModalStore';
import { useSettingsStore } from '../store/useSettingsStore';

describe('picker output reaches both renderers', () => {
    const original = useSettingsStore.getState();
    afterEach(() => {
        useSettingsStore.setState(original);
        useColorPickerModalStore.getState().close();
    });

    it.each([
        ['#ff0000ff', '#FF0000'], ['#12abcdff', '#12ABCD'], ['#11223380', '#112233'],
        ['#123456', '#123456'], ['#0f0', '#00FF00'], ['#0f08', '#00FF00'],
    ])('accepts picker HEX %s and sends opaque RGB %s to Android and CSS', (input, expected) => {
        expect(normalizeOpaqueColor(input)).toBe(expected);
        expect(resolveVisualizerColor('custom', '#8B5CF6', input)).toBe(expected);
        expect(getLocalCastThemeKey('custom', input)).toBe('custom:' + expected);
        expect(getLocalCastThemeCss('custom', input)).toContain('--play-btn-hover-border: ' + expected);
    });

    it.each(['#12345', '#1234567', 'red;}', null, undefined])('rejects malformed input %s', value => {
        expect(normalizeOpaqueColor(value)).toBe('#8B5CF6');
    });

    it('confirms the visualizer picker into persistent settings and the actual native color prop', () => {
        const settings = useSettingsStore.getState();
        openColorPickerModal({ title: 'Visualizer', initialColor: '#8B5CF6FF', onConfirm: settings.setPlayerVisualizerCustomColor });
        const request = useColorPickerModalStore.getState().request!;
        expect(request.initialColor).toBe('#8B5CF6');
        useColorPickerModalStore.getState().confirm('#e62117ff', request.id);
        const saved = useSettingsStore.getState();
        expect(saved.playerVisualizerColorMode).toBe('custom');
        expect(saved.playerVisualizerCustomColor).toBe('#E62117');
        expect(resolveVisualizerColor(saved.playerVisualizerColorMode, '#8B5CF6', saved.playerVisualizerCustomColor)).toBe('#E62117');
        expect(JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)[1]).state.playerVisualizerCustomColor).toBe('#E62117');
    });

    it('confirms LocalCast into persistent settings and generates CSS using that same color', () => {
        useSettingsStore.setState({ userTier: 'VIP' });
        openColorPickerModal({ title: 'LocalCast', initialColor: '#8B5CF6', onConfirm: useSettingsStore.getState().setLocalCastCustomColor });
        const request = useColorPickerModalStore.getState().request!;
        useColorPickerModalStore.getState().confirm('#24c87aff', request.id);
        const saved = useSettingsStore.getState();
        expect(saved.localCastTheme).toBe('custom');
        expect(saved.localCastCustomColor).toBe('#24C87A');
        expect(getLocalCastThemeCss(saved.localCastTheme, saved.localCastCustomColor)).toContain('--play-btn-hover-border: #24C87A');
        expect(JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)[1]).state.localCastCustomColor).toBe('#24C87A');
    });

    it('keeps the current setting on cancel and ignores old or repeated confirmations', () => {
        const save = jest.fn();
        openColorPickerModal({ title: 'Old', initialColor: '#123456', onConfirm: save });
        const oldId = useColorPickerModalStore.getState().request!.id;
        useColorPickerModalStore.getState().close();
        useColorPickerModalStore.getState().confirm('#ff0000ff', oldId);
        expect(save).not.toHaveBeenCalled();
        openColorPickerModal({ title: 'New', initialColor: '#abcdef', onConfirm: save });
        const newId = useColorPickerModalStore.getState().request!.id;
        useColorPickerModalStore.getState().confirm('#ff0000ff', oldId);
        expect(useColorPickerModalStore.getState().request?.id).toBe(newId);
        useColorPickerModalStore.getState().confirm('#00ff00ff', newId);
        useColorPickerModalStore.getState().confirm('#ff0000ff', newId);
        expect(save).toHaveBeenCalledTimes(1);
        expect(save).toHaveBeenCalledWith('#00FF00');
        expect(useColorPickerModalStore.getState().request).toBeNull();
    });
});
