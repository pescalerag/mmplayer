import React from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Image } from 'expo-image';
import { PlayerArtwork } from '../components/player/PlayerArtwork';

jest.mock('@react-navigation/native', () => ({ useIsFocused: jest.fn() }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('react-native', () => ({
    AppState: { addEventListener: jest.fn() },
    View: 'View',
    StyleSheet: { absoluteFill: {} },
}));

describe('player artwork across navigation and track changes', () => {
    let states: any[];
    let refs: any[];
    let effects: { deps?: React.DependencyList; cleanup?: () => void }[];
    let stateCursor: number;
    let refCursor: number;
    let effectCursor: number;
    let pendingEffects: (() => void)[];
    let onAppState: (state: string) => void;
    const reload = jest.fn().mockResolvedValue(undefined);

    const render = (coverUrl: string | null, focused = true) => {
        stateCursor = refCursor = effectCursor = 0;
        pendingEffects = [];
        (useIsFocused as jest.Mock).mockReturnValue(focused);
        const tree = PlayerArtwork({ coverUrl, size: 300, cardBackgroundColor: '#222', textSecondaryColor: '#aaa' });
        const image = tree.props.children as React.ReactElement<any>;
        if (image.type === Image) image.props.ref.current = { reloadAsync: reload };
        pendingEffects.forEach(effect => effect());
        return image;
    };

    beforeEach(() => {
        jest.useFakeTimers();
        states = []; refs = []; effects = [];
        reload.mockClear();
        (AppState as any).addEventListener = jest.fn((_type, callback) => {
            onAppState = callback;
            return { remove: jest.fn() };
        });
        jest.spyOn(React, 'useState').mockImplementation(((initial: any) => {
            const index = stateCursor++;
            if (!(index in states)) states[index] = initial;
            return [states[index], (value: any) => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
        }) as any);
        jest.spyOn(React, 'useRef').mockImplementation((initial: any) => {
            const index = refCursor++;
            refs[index] ??= { current: initial };
            return refs[index];
        });
        jest.spyOn(React, 'useMemo').mockImplementation(callback => callback());
        jest.spyOn(React, 'useReducer').mockReturnValue([0, jest.fn()]);
        jest.spyOn(React, 'useEffect').mockImplementation((callback, deps) => {
            const index = effectCursor++;
            const previous = effects[index];
            if (previous && deps?.every((value, i) => Object.is(value, previous.deps?.[i]))) return;
            pendingEffects.push(() => {
                previous?.cleanup?.();
                effects[index] = { deps, cleanup: callback() || undefined };
            });
        });
    });

    afterEach(() => {
        effects.forEach(effect => effect.cleanup?.());
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    it('keeps the image view intact on focus and foreground recovery', () => {
        const first = render('file:///cover.jpg');
        render('file:///cover.jpg', false);
        const focused = render('file:///cover.jpg', true);
        onAppState('active');
        const recovered = render('file:///cover.jpg');
        for (const image of [focused, recovered]) {
            expect(image.type).toBe(first.type);
            expect(image.key).toBe(first.key);
            expect(image.props.ref).toBe(first.props.ref);
            expect(image.props.source).toEqual(first.props.source);
            expect(image.props.recyclingKey).toBeUndefined();
        }
        expect(reload).not.toHaveBeenCalled();
    });

    it('retains the image during an unresolved cover and replaces its source without recreating it', () => {
        const first = render('file:///first.jpg');
        const pending = render(null);
        expect(pending.type).toBe(Image);
        expect(pending.props.source.uri).toBe('file:///first.jpg');
        const second = render('file:///second.jpg');
        expect(second.key).toBe(first.key);
        expect(second.props.ref).toBe(first.props.ref);
        expect(second.props.source.uri).toBe('file:///second.jpg');
        expect(second.props.transition).toBe(0);
    });

    it('ignores an error from a previous cover after switching songs', () => {
        const first = render('file:///first.jpg');
        render('file:///second.jpg');
        first.props.onError();
        const current = render('file:///second.jpg');
        expect(current.type).toBe(Image);
        expect(current.props.source.uri).toBe('file:///second.jpg');
        expect(reload).not.toHaveBeenCalled();
    });
});
