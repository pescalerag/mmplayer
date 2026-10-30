import React from 'react';
import { CassetteArtwork } from '../components/player/CassetteArtwork';

const mockShared: { value: number }[] = [];
const mockSetActive = jest.fn();
let mockFrame: (frame: { timeSincePreviousFrame: number | null }) => void;
const mockCleanups: (() => void)[] = [];
jest.mock('react-native', () => ({ View: 'View', Text: 'Text', Platform: { OS: 'android' }, StyleSheet: { create: (styles: any) => styles, absoluteFillObject: {} } }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Circle: 'Circle', Defs: 'Defs', G: 'G', LinearGradient: 'LinearGradient', Path: 'Path', Rect: 'Rect', Stop: 'Stop', Text: 'Text' }));
jest.mock('react-native-reanimated', () => ({
    __esModule: true, default: { View: 'AnimatedView' },
    useSharedValue: (value: number) => { const shared = { value }; mockShared.push(shared); return shared; },
    useAnimatedStyle: (callback: () => any) => callback(),
    withTiming: (value: number) => value,
    useFrameCallback: (callback: typeof mockFrame) => { mockFrame = callback; return { setActive: mockSetActive }; },
}));

beforeEach(() => {
    mockShared.length = 0; mockCleanups.length = 0; mockSetActive.mockClear();
    jest.spyOn(React, 'useCallback').mockImplementation(callback => callback);
    jest.spyOn(React, 'useEffect').mockImplementation(callback => { const cleanup = callback(); if (cleanup) mockCleanups.push(cleanup); });
});
afterEach(() => jest.restoreAllMocks());
const render = (props: any = {}) => (CassetteArtwork as any).type({ size: 300, coverUrl: 'file:///cover.jpg', ...props });
const nodes = (tree: any): any[] => tree && typeof tree === 'object' ? [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)] : [];

it('limits the handwritten album title to the two label lines with ellipsis', () => {
    expect(nodes(render()).some(node => node.type === 'Text')).toBe(false);
    const label = nodes(render({ albumTitle: '  A very long album name that cannot fit inside the cassette label  ' })).find(node => node.type === 'Text');
    expect(label.props.numberOfLines).toBe(2);
    expect(label.props.ellipsizeMode).toBe('tail');
    expect(label.props.style.fontFamily).toBe('cursive');
    expect(label.props.children).toBe('A very long album name that cannot fit inside the cassette label');
});

it('colors the tape from the cover and crops it inside a separate central window', () => {
    const tree = nodes(render({ coverColor: '#50a7cc' }));
    const tapes = tree.filter(node => Array.isArray(node.props.style) && node.props.style.some((style: any) => style?.backgroundColor === '#50a7cc'));
    expect(tapes).toHaveLength(2);
    const window = tree.find(node => node.props.style?.overflow === 'hidden');
    expect(window.props.style.width).toBe(63);
    expect(window.props.style.height).toBe(42);
    expect(tree.some(node => node.props.style?.backgroundColor === '#4e382a')).toBe(false);
});

it('replaces the tape color when the next cover palette arrives', () => {
    for (const coverColor of ['#d54f43', '#50a7cc', null]) {
        const expectedColor = coverColor || '#777b82';
        const tree = nodes(render({ coverColor }));
        const tapes = tree.filter(node => Array.isArray(node.props.style) && node.props.style.some((style: any) => style?.backgroundColor === expectedColor));
        expect(tapes).toHaveLength(2);
    }
});

it('keeps the player slot square and the physical cassette inside it', () => {
    const tree = render();
    expect(tree.props.style.width).toBe(300);
    expect(tree.props.style.height).toBe(300);
    expect(tree.props.children.props.style.height).toBe(195);
});

it('turns the empty reel faster and exchanges speeds after seeking to the end', () => {
    render({ isPlaying: true, progress: 0 });
    expect(mockSetActive).toHaveBeenLastCalledWith(true);
    mockFrame({ timeSincePreviousFrame: 16 });
    expect(mockShared[2].value).toBeGreaterThan(mockShared[1].value);
    mockShared[0].value = 1;
    const previousLeft = mockShared[1].value, previousRight = mockShared[2].value;
    mockFrame({ timeSincePreviousFrame: 16 });
    expect(mockShared[1].value - previousLeft).toBeGreaterThan(mockShared[2].value - previousRight);
});

it('does not animate static previews or paused playback and cleans up its frame callback', () => {
    render();
    expect(mockSetActive).toHaveBeenLastCalledWith(false);
    mockFrame({ timeSincePreviousFrame: null });
    expect(mockShared[1].value).toBe(0);
    expect(mockShared[2].value).toBe(0);
    mockCleanups.forEach(cleanup => cleanup());
    expect(mockSetActive).toHaveBeenLastCalledWith(false);
});
