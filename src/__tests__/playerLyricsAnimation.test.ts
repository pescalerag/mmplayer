import React from 'react';
import { usePlayerLyricsAnimation } from '../hooks/usePlayerLyricsAnimation';
import { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';

jest.mock('react-native-reanimated', () => ({
    useSharedValue: jest.fn(),
    useAnimatedStyle: jest.fn(),
    withTiming: jest.fn(value => value),
    cancelAnimation: jest.fn(),
}));

describe('PlayerScreen lyrics across navigation', () => {
    let values: { value: number }[];
    let cursor: number;
    let effect: (() => void | (() => void)) | undefined;
    let cleanup: (() => void) | undefined;
    let focusRef: { current: boolean };

    const LyricsHarness = (hasLyrics: boolean, phrase: string, focused: boolean) => {
        cursor = 0;
        const result = usePlayerLyricsAnimation(hasLyrics, phrase, focused);
        cleanup?.();
        cleanup = effect?.() || undefined;
        return result;
    };

    beforeEach(() => {
        values = [];
        cleanup = undefined;
        effect = undefined;
        focusRef = { current: true };
        (useSharedValue as jest.Mock).mockImplementation(value => {
            const index = cursor++;
            values[index] ??= { value };
            return values[index];
        });
        (useAnimatedStyle as jest.Mock).mockImplementation(callback => callback());
        jest.spyOn(React, 'useRef').mockReturnValue(focusRef);
        jest.spyOn(React, 'useEffect').mockImplementation(callback => { effect = callback; });
    });
    afterEach(() => { cleanup?.(); jest.restoreAllMocks(); });

    it('restores lyrics without remounting after opening LyricsScreen during a fade to silence', () => {
        LyricsHarness(true, 'First line', true);
        LyricsHarness(true, '', true);
        expect(values[2].value).toBe(0);
        LyricsHarness(true, '', false);
        LyricsHarness(true, 'Next line', false);
        // Simulate a native screen freeze leaving the old animation at zero.
        values[2].value = 0;
        const returning = LyricsHarness(true, 'Next line', true);
        expect(returning.activeLyricText).toBe('Next line');
        expect(values[2].value).toBe(1);
        expect(values[0].value).toBe(46);
        expect(values[1].value).toBe(1);
    });

    it('shows the latest of many lyric lines while the full lyrics screen covers PlayerScreen', () => {
        LyricsHarness(true, 'Line 0', true);
        for (let i = 1; i <= 100; i++) LyricsHarness(true, `Line ${i}`, false);
        values[2].value = 0;
        const returning = LyricsHarness(true, 'Line 100', true);
        expect(returning.activeLyricText).toBe('Line 100');
        expect(values[2].value).toBe(1);
    });

    it('keeps a genuine instrumental interval blank and shows the following phrase', () => {
        LyricsHarness(true, 'Before instrumental', true);
        expect(LyricsHarness(true, '', false).activeLyricText).toBe('');
        expect(LyricsHarness(true, '', true).activeLyricText).toBe('');
        expect(values[2].value).toBe(0);
        expect(LyricsHarness(true, 'After instrumental', true).activeLyricText).toBe('After instrumental');
        expect(values[2].value).toBe(1);
    });

    it('recovers container visibility when lyrics become available while PlayerScreen is covered', () => {
        LyricsHarness(false, '', true);
        LyricsHarness(false, '', false);
        LyricsHarness(true, 'New song lyrics', false);
        values[0].value = 0;
        values[1].value = 0;
        LyricsHarness(true, 'New song lyrics', true);
        expect(values.map(value => value.value)).toEqual([46, 1, 1]);
        expect(LyricsHarness(false, 'New song lyrics', true).activeLyricText).toBe('');
        expect(values.map(value => value.value)).toEqual([0, 0, 0]);
    });
});
