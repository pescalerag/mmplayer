import React from 'react';
import LyricsEditorScreen from '../screens/player/LyricsEditorScreen';
import LyricsSyncScreen from '../screens/player/LyricsSyncScreen';
import { LyricsService } from '../services/LyricsService';
import { createHookHarness } from './helpers/hookHarness';

const mockTrack = { id: 'edited-a', lyricsLRC: 'Original', duration: 180, _raw: { _status: 'synced' } };
let mockActiveTrack = mockTrack;
const mockNavigation = { goBack: jest.fn(), dispatch: jest.fn() };
jest.mock('../hooks/useLyricsDocument', () => ({ useLyricsDocument: () => ({ document: { track: mockTrack, text: 'First\nSecond' }, missing: false }) }));
jest.mock('../store/usePlayerStore', () => ({ usePlayerStore: Object.assign((selector: (state: any) => unknown) => selector({ activeTrack: mockActiveTrack }), { getState: () => ({ activeTrack: mockActiveTrack, setIsSyncingLyrics: jest.fn() }) }) }));
jest.mock('../services/LyricsService', () => ({ LyricsService: { saveLyrics: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNavigation, useRoute: () => ({ params: { trackId: 'edited-a' } }), usePreventRemove: jest.fn() }));
jest.mock('../hooks/useAppTheme', () => ({ useAppTheme: () => ({ colors: {}, fonts: {}, fontWeights: {}, spacing: {} }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@react-native-community/slider', () => 'Slider');
jest.mock('../hooks/usePlaybackState', () => ({ usePlaybackState: () => ({ state: 'playing' }) }));
jest.mock('react-native-track-player', () => ({ __esModule: true, default: { pause: jest.fn(), play: jest.fn(), seekTo: jest.fn() }, State: { Playing: 'playing', Buffering: 'buffering' }, useProgress: () => ({ position: 42, duration: 180 }) }));
jest.mock('react-native', () => ({ FlatList: 'List', Text: 'Text', View: 'View', TextInput: 'Input', TouchableOpacity: 'Button', KeyboardAvoidingView: 'Keyboard', ScrollView: 'Scroll', Platform: { OS: 'android' }, Alert: { alert: jest.fn() }, StyleSheet: { create: (styles: any) => styles } }));

const nodes = (tree: any): any[] => tree && typeof tree === 'object' ? [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)] : [];

it('saves the draft into the opened document after playback switches to a different song', async () => {
    const outer = LyricsEditorScreen() as React.ReactElement<any>;
    const Component = outer.type as (props: any) => React.ReactElement;
    const harness = createHookHarness();
    const render = () => harness.render(() => Component(outer.props));
    try {
        nodes(render()).find(node => node.type === 'Input').props.onChangeText('Edited text');
        mockActiveTrack = { ...mockTrack, id: 'playing-b' };
        const save = nodes(render()).find(node => node.type === 'Button' && nodes(node).some(child => child.type === 'Text' && child.props.children === 'actions.save'));
        await save.props.onPress();
        expect(LyricsService.saveLyrics).toHaveBeenCalledWith(mockTrack, 'Edited text');
        expect((LyricsService.saveLyrics as jest.Mock).mock.calls[0][0].id).toBe('edited-a');
    } finally { harness.dispose(); jest.restoreAllMocks(); }
});

it('keeps synchronized lines when playback changes, blocks new marks and resumes editing the same draft', async () => {
    mockActiveTrack = mockTrack;
    const outer = LyricsSyncScreen() as React.ReactElement<any>;
    const Component = outer.type as (props: any) => React.ReactElement;
    const harness = createHookHarness();
    const render = () => harness.render(() => Component(outer.props));
    const next = (tree: any) => nodes(tree).find(node => node.type === 'Button' && nodes(node).some(child => child.type === 'Text' && child.props.children === 'lyrics.next_phrase'));
    try {
        next(render()).props.onPress();
        expect(nodes(render()).find(node => node.type === 'List').props.data[0].time).toBe(41.8);
        mockActiveTrack = { ...mockTrack, id: 'playing-b' };
        const switched = render();
        expect(next(switched).props.disabled).toBe(true);
        expect(nodes(switched).find(node => node.type === 'Slider').props.disabled).toBe(true);
        // A stale press callback must also be safe before React commits disabled UI.
        next(switched).props.onPress();
        expect(nodes(render()).find(node => node.type === 'List').props.data[1].time).toBeNull();
        mockActiveTrack = mockTrack;
        expect(next(render()).props.disabled).toBe(false);
        expect(nodes(render()).find(node => node.type === 'List').props.data[0].time).toBe(41.8);
        const save = nodes(render()).find(node => node.type === 'Button' && nodes(node).some(child => child.type === 'Text' && child.props.children === 'actions.save'));
        await save.props.onPress();
        expect((LyricsService.saveLyrics as jest.Mock).mock.lastCall?.[0].id).toBe('edited-a');
    } finally { harness.dispose(); jest.restoreAllMocks(); }
});
