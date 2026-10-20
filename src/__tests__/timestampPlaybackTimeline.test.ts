import React from 'react';
import TrackPlayer from 'react-native-track-player';
import { TimestampPlaybackTimeline } from '../components/player/TimestampPlaybackTimeline';

let mockPosition = 12;
jest.mock('react-native-track-player', () => ({ __esModule: true, default: { pause: jest.fn(async (_bypass?: boolean) => {}) }, useProgress: () => ({ position: mockPosition }) }));
jest.mock('../store/usePlayerStore', () => ({ usePlayerStore: (select: any) => select({ activeTrack: { id: 'song' } }) }));
jest.mock('../store/useCastStore', () => ({ useCastStore: (select: any) => select({ castPosition: 0, isLocalCastActive: false }) }));
jest.mock('../hooks/useAppTheme', () => ({ useAppTheme: () => ({ colors: {}, fonts: {} }) }));
jest.mock('../components/common/TimestampSliderMarkers', () => ({ TimestampSliderMarkers: 'Markers' }));
jest.mock('@react-native-community/slider', () => 'Slider');
jest.mock('react-native', () => ({ View: 'View', Text: 'Text' }));

let states: any[], refs: any[], stateIndex: number, refIndex: number, effects: any[];
let props: any;
const nodes = (tree: any): any[] => tree && typeof tree === 'object' ? [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)] : [];
const render = () => {
    stateIndex = 0; refIndex = 0; effects = [];
    const tree = nodes((TimestampPlaybackTimeline as any).type(props));
    effects.forEach(effect => effect());
    return tree;
};
const slider = () => render().find(node => node.type === 'Slider');
beforeEach(() => {
    jest.useFakeTimers(); jest.clearAllMocks(); mockPosition = 12; states = []; refs = [];
    props = { trackId: 'song', duration: 120, segments: [], disabled: false, onSeek: jest.fn(async () => {}),
        onPosition: jest.fn(), previewEnd: null, previewStarted: { current: 0 }, onPreviewEnd: jest.fn() };
    jest.spyOn(React, 'useEffect').mockImplementation(callback => { effects.push(callback); });
    jest.spyOn(React, 'useRef').mockImplementation((initial: any) => { const index = refIndex++; refs[index] ??= { current: initial }; return refs[index]; });
    jest.spyOn(React, 'useState').mockImplementation(((initial: any) => {
        const index = stateIndex++; if (!(index in states)) states[index] = initial;
        return [states[index], (value: any) => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    }) as any);
});
afterEach(() => { jest.restoreAllMocks(); jest.clearAllTimers(); jest.useRealTimers(); });

it('keeps the dragged position stable when new playback progress arrives', () => {
    slider().props.onSlidingStart();
    slider().props.onValueChange(45);
    mockPosition = 13;
    expect(slider().props.value).toBe(45);
    expect(props.onSeek).not.toHaveBeenCalled();
    expect(props.onPosition).toHaveBeenLastCalledWith(13);
});

it('holds a seek target until the media clock catches up instead of jumping back', async () => {
    let finish!: () => void;
    props.onSeek.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
    const pending = slider().props.onSlidingComplete(60);
    expect(slider().props.value).toBe(60);
    expect(props.onSeek).toHaveBeenCalledWith(60);
    finish(); await pending; await Promise.resolve();
    expect(slider().props.value).toBe(60);
    mockPosition = 60.1; render();
    expect(slider().props.value).toBe(60.1);
});

it('releases a stale target after a seek timeout', async () => {
    slider().props.onSlidingComplete(60);
    await Promise.resolve(); await Promise.resolve();
    expect(slider().props.value).toBe(60);
    jest.advanceTimersByTime(1500);
    expect(slider().props.value).toBe(12);
});

it('ends a preview without applying the global audio fade', async () => {
    props.previewEnd = 30;
    props.previewStarted.current = Date.now() - 1000;
    mockPosition = 31; render();
    expect(props.onPreviewEnd).toHaveBeenCalledTimes(1);
    expect(TrackPlayer.pause).toHaveBeenCalledWith(true);
});
