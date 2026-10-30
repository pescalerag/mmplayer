import React from 'react';
import { Platform } from 'react-native';
import { PlayerBackground } from '../components/player/PlayerBackground';

jest.mock('react-native', () => ({
    Platform: { OS: 'android' }, View: 'View', AppState: { addEventListener: jest.fn() },
    StyleSheet: { absoluteFillObject: {} },
}));
jest.mock('react-native-reanimated', () => ({
    __esModule: true, default: { View: 'AnimatedView' },
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (factory: () => unknown) => factory(),
    withTiming: (value: number) => value,
}));
jest.mock('expo-video', () => ({
    VideoView: 'VideoView', useVideoPlayer: (uri: string) => ({ uri }),
}));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'Gradient' }));
jest.mock('../components/layouts/BlurredBackground', () => ({ __esModule: true, default: 'BlurredBackground' }));

function nodes(tree: any): any[] {
    if (!React.isValidElement(tree)) return [];
    const element = tree as React.ReactElement<any>;
    if (typeof element.type === 'object' && 'type' in element.type) {
        return nodes((element.type as any).type(element.props));
    }
    return [element, ...React.Children.toArray(element.props.children).flatMap(nodes)];
}

describe('PlayerScreen canvas updates without reopening the player', () => {
    beforeEach(() => {
        jest.spyOn(React, 'useMemo').mockImplementation(factory => factory());
        jest.spyOn(React, 'useRef').mockImplementation(initial => ({ current: initial }));
        jest.spyOn(React, 'useEffect').mockImplementation(() => {});
    });
    afterEach(() => jest.restoreAllMocks());

    function props(track: any, overrides: Partial<React.ComponentProps<typeof PlayerBackground>> = {}): React.ComponentProps<typeof PlayerBackground> {
        return {
            width: 360, bgSwipeAnimatedStyle: {}, track,
            prevTrackModel: null, nextTrackModel: null,
            currentBgVideo: track.bgVideo, prevBgVideo: null, nextBgVideo: null,
            currentCoverUrl: 'file:///cover.jpg', prevCoverUrl: null, nextCoverUrl: null,
            showCanvas: true, isImmersive: false, isFocused: true, isTransitioning: false,
            playerBackgroundStyle: 'cover', coverColor: null,
            topGradientColor: '#111111', bottomGradientColor: '#222222', backgroundColor: '#000000',
            ...overrides,
        };
    }
    function render(input: ReturnType<typeof props>) {
        return nodes((PlayerBackground as any).type(input));
    }
    function videos(input: ReturnType<typeof props>) {
        return render(input).filter(node => node.type === 'VideoView').map(node => node.props.player.uri);
    }

    it('adds, replaces and removes a canvas while retaining the same mutable song model and focus', () => {
        const track = { id: 'song', bgVideo: null as string | null };
        const initial = props(track);
        expect(videos(initial)).toEqual([]);
        track.bgVideo = 'file:///first.mp4';
        const added = props(track);
        expect(initial.track).toBe(added.track);
        expect(initial.currentBgVideo).not.toBe(added.currentBgVideo);
        expect(videos(added)).toEqual(['file:///first.mp4']);
        track.bgVideo = 'file:///replacement.mp4';
        const replaced = props(track);
        expect(videos(replaced)).toEqual(['file:///replacement.mp4']);
        track.bgVideo = null;
        expect(videos(props(track))).toEqual([]);
        expect(render(props(track)).filter(node => node.type === 'BlurredBackground')).toHaveLength(3);
    });

    it('fills desktop Canvas and limits darkening to the controls', () => {
        const track = { id: 'song', bgVideo: 'file:///current.mp4' };
        const originalOS = Platform.OS;
        try {
            (Platform as any).OS = 'web';
            const output = render(props(track));
            const video = output.find(node => node.type === 'VideoView');
            expect(video.props.contentFit).toBe('cover');
            expect(video.props.style).toContainEqual({ width: '100%', height: '100%' });
            expect(output.filter(node => node.type === 'BlurView')).toHaveLength(0);
            const gradients = output.filter(node => node.type === 'Gradient');
            expect(gradients).toHaveLength(1);
            expect(gradients[0].props.style).toMatchObject({ bottom: 0, height: '45%' });
        } finally { (Platform as any).OS = originalOS; }
        const video = render(props(track)).find(node => node.type === 'VideoView');
        expect(video.props.contentFit).toBe('cover');
    });

    it('updates adjacent canvases and keeps the canvas setting respected', () => {
        const track = { id: 'song', bgVideo: 'file:///current.mp4' };
        const input = props(track, {
            prevTrackModel: { id: 'prev' } as any, nextTrackModel: { id: 'next' } as any,
            prevBgVideo: 'file:///prev.mp4', nextBgVideo: 'file:///next.mp4',
        });
        expect(videos(input)).toEqual(['file:///prev.mp4', 'file:///current.mp4', 'file:///next.mp4']);
        expect(videos({ ...input, nextBgVideo: 'file:///new-next.mp4' })).toContain('file:///new-next.mp4');
        expect(videos({ ...input, showCanvas: false })).toEqual([]);
    });
});
