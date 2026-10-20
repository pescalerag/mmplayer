import React from 'react';
import { withTiming } from 'react-native-reanimated';
import { ArtworkFadeIn } from '../components/player/ArtworkFadeIn';

jest.mock('react-native-reanimated', () => ({
    __esModule: true,
    default: { View: 'AnimatedView' },
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (callback: () => unknown) => callback(),
    withTiming: jest.fn((value: number) => value),
}));

let cleanup: (() => void) | undefined;
beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(React, 'useRef').mockImplementation((value: any) => ({ current: value }));
    jest.spyOn(React, 'useCallback').mockImplementation(callback => callback);
    jest.spyOn(React, 'useEffect').mockImplementation(effect => { cleanup = effect() || undefined; });
});
afterEach(() => { cleanup?.(); jest.restoreAllMocks(); });

function render(hasImage: boolean) {
    const children = jest.fn((_onReady: () => void) => null);
    const view = ArtworkFadeIn({ size: 300, hasImage, children });
    return { view, ready: children.mock.calls[0][0] as () => void };
}

it('keeps the artwork slot invisible until its image is ready, then fades only once', () => {
    const { view, ready } = render(true);
    expect(view.props.style).toEqual([{ width: 300, height: 300 }, { opacity: 0 }]);
    expect(view.props.onLayout).toBeUndefined();
    expect(withTiming).not.toHaveBeenCalled();
    ready();
    ready();
    expect(withTiming).toHaveBeenCalledTimes(1);
    expect(withTiming).toHaveBeenCalledWith(1, { duration: 220 });
});

it('reveals artwork without an image when its layout is ready', () => {
    const { view } = render(false);
    view.props.onLayout?.();
    expect(withTiming).toHaveBeenCalledTimes(1);
});

it('ignores a late image callback after its artwork has been replaced', () => {
    const { ready } = render(true);
    cleanup?.();
    ready();
    expect(withTiming).not.toHaveBeenCalled();
});
