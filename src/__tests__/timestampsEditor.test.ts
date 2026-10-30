import React from 'react';
import { Alert } from 'react-native';
import TrackPlayer from 'react-native-track-player';
import TimestampsEditorScreen from '../screens/player/TimestampsEditorScreen';

const mockSave = jest.fn(async (..._args: any[]) => {});
const mockPrepare = jest.fn(async (..._args: any[]) => {});
const mockSeek = jest.fn(async (..._args: any[]) => {});
const mockSetPreview = jest.fn();
let mockPlaybackState = 'playing';
const mockNavigation = { goBack: jest.fn(), dispatch: jest.fn(), addListener: jest.fn(() => jest.fn()) };
jest.mock('../services/TimestampService', () => ({ TimestampService: { save: (...args: any[]) => mockSave(...args), prepareEditorTrack: (...args: any[]) => mockPrepare(...args), seekAutomatically: (...args: any[]) => mockSeek(...args) } }));
jest.mock('../store/useTimestampStore', () => ({ useTimestampStore: { setState: (...args: any[]) => mockSetPreview(...args) } }));
jest.mock('../components/common/TimestampSliderMarkers', () => ({ TimestampSliderMarkers: 'Markers' }));
jest.mock('../components/player/TimestampPlaybackTimeline', () => ({ TimestampPlaybackTimeline: 'Timeline' }));
jest.mock('../database', () => ({ database: {} }));
jest.mock('../store/usePlayerStore', () => ({ usePlayerStore: (selector: any) => selector({ activeTrack: { id: 'song' } }) }));
jest.mock('../store/useCastStore', () => ({ useCastStore: (selector: any) => selector({ castPosition: 0, isLocalCastActive: false, isChromecastConnected: false }) }));
jest.mock('../hooks/usePlaybackState', () => ({ usePlaybackState: () => ({ state: mockPlaybackState }) }));
jest.mock('../hooks/useAppTheme', () => ({ useAppTheme: () => ({ colors: { accent: '#f00', text: '#fff' }, fonts: { regular: 'regular' }, fontWeights: { bold: '700' } }) }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNavigation, useRoute: () => ({ params: { trackId: 'song' } }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 20 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('@react-native-community/slider', () => 'Slider');
jest.mock('react-native-track-player', () => ({ __esModule: true, default: { play: jest.fn(async () => {}), pause: jest.fn(async () => {}), seekTo: jest.fn(async (_value: number) => {}) }, State: { Playing: 'playing' }, useProgress: () => ({ position: 5 }) }));
jest.mock('react-native', () => ({ View: 'View', Text: 'Text', TextInput: 'Input', TouchableOpacity: 'Button', ScrollView: 'ScrollView', Switch: 'Switch', Alert: { alert: jest.fn() }, StyleSheet: { create: (styles: any) => styles } }));

let states: any[], stateIndex: number, refs: any[], refIndex: number, effects: any[];
const track = { id: 'song', title: 'Song', duration: 120 };
const segment = { id: 'one', startMs: 10000, endMs: 20000 };
const nodes = (tree: any): any[] => tree && typeof tree === 'object' ? [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)] : [];
const render = () => { stateIndex = 0; refIndex = 0; effects = []; return nodes(TimestampsEditorScreen()); };
const settle = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };
const save = async () => {
    render().find(node => node.type === 'Button' && node.props.children?.props?.children === 'actions.save').props.onPress();
    await settle();
};
beforeEach(() => {
    jest.clearAllMocks(); mockSave.mockResolvedValue(undefined); mockPlaybackState = 'playing';
    // A loaded song, one committed interval, and an untouched interval form.
    states = [track, [segment], true, null, '0:00.000', '0:00.000', false, false, false, false, null]; refs = [];
    jest.spyOn(React, 'useEffect').mockImplementation(callback => { effects.push(callback); });
    jest.spyOn(React, 'useCallback').mockImplementation(callback => callback);
    jest.spyOn(React, 'useRef').mockImplementation((initial: any) => { const index = refIndex++; refs[index] ??= { current: initial }; return refs[index]; });
    jest.spyOn(React, 'useState').mockImplementation(((initial: any) => {
        const index = stateIndex++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
        return [states[index], (value: any) => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    }) as any);
});
afterEach(() => jest.restoreAllMocks());

it('saves a valid unfinished form instead of silently losing it', async () => {
    const form = render();
    form.find(node => node.type === 'Input' && node.props.accessibilityLabel === 'timestamps.from').props.onChangeText('0:30');
    form.find(node => node.type === 'Input' && node.props.accessibilityLabel === 'timestamps.to').props.onChangeText('0:40');
    await save();
    expect(mockSave).toHaveBeenCalledWith(track, { enabled: true, segments: [segment, expect.objectContaining({ startMs: 30000, endMs: 40000 })] });
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
});

it('rejects a backwards draft and leaves the editor open', async () => {
    const form = render();
    form.find(node => node.type === 'Input' && node.props.accessibilityLabel === 'timestamps.from').props.onChangeText('0:40');
    form.find(node => node.type === 'Input' && node.props.accessibilityLabel === 'timestamps.to').props.onChangeText('0:30');
    await save();
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockNavigation.goBack).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('common.error', 'timestamps.range');
});

it('seeks manually in original audio and previews a committed jump with draft rules', async () => {
    const form = render();
    await form.find(node => node.type === 'Timeline').props.onSeek(15);
    await settle();
    expect(mockSetPreview).toHaveBeenCalledWith({ previewConfig: null });
    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(15);
    render().find(node => node.type === 'Button' && node.props.accessibilityLabel === 'timestamps.preview').props.onPress();
    await settle();
    expect(mockSetPreview).toHaveBeenLastCalledWith({ previewConfig: { enabled: true, segments: [segment] } });
    expect(mockSeek).toHaveBeenCalledWith(8);
    expect(TrackPlayer.play).toHaveBeenCalled();
});

it('pauses and resumes immediately without preparing the current track or disabling the timeline', async () => {
    render().find(node => node.type === 'Button' && node.props.accessibilityLabel === 'timestamps.play_pause').props.onPress();
    await settle();
    expect(TrackPlayer.pause).toHaveBeenCalledWith(true);
    expect(render().find(node => node.type === 'Timeline').props.disabled).toBe(false);
    mockPlaybackState = 'paused';
    render().find(node => node.type === 'Button' && node.props.accessibilityLabel === 'timestamps.play_pause').props.onPress();
    await settle();
    expect(TrackPlayer.play).toHaveBeenCalledWith(true);
    expect(mockPrepare).not.toHaveBeenCalled();
    expect(render().find(node => node.type === 'Timeline').props.disabled).toBe(false);
});

it('ignores simultaneous transport taps while a playback command is pending', async () => {
    let finish!: () => void;
    (TrackPlayer.pause as jest.Mock).mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
    const button = render().find(node => node.type === 'Button' && node.props.accessibilityLabel === 'timestamps.play_pause');
    button.props.onPress(); button.props.onPress();
    expect(TrackPlayer.pause).toHaveBeenCalledTimes(1);
    finish(); await settle();
    button.props.onPress(); await settle();
    expect(TrackPlayer.pause).toHaveBeenCalledTimes(2);
});

it('uses the latest timeline position for timestamp input without polling in the form', () => {
    const form = render();
    form.find(node => node.type === 'Timeline').props.onPosition(37.2);
    form.find(node => node.type === 'Button' && node.props.children?.props?.children === 'timestamps.use_position').props.onPress();
    expect(render().find(node => node.type === 'Input' && node.props.accessibilityLabel === 'timestamps.from').props.value).toBe('0:37.200');
});

it('requires an explicit discard before leaving with unsaved changes', () => {
    states[6] = true; render(); effects[1]();
    const listener = (mockNavigation.addListener as jest.Mock).mock.calls[0][1];
    const event = { preventDefault: jest.fn(), data: { action: { type: 'GO_BACK' } } };
    listener(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(mockNavigation.dispatch).not.toHaveBeenCalled();
    const choices = (Alert.alert as jest.Mock).mock.calls[0][2];
    expect(choices[0].style).toBe('cancel'); choices[1].onPress();
    expect(mockNavigation.dispatch).toHaveBeenCalledWith(event.data.action);
});
