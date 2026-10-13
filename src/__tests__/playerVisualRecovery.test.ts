import React from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { usePlayerVisualRecovery } from '../hooks/usePlayerVisualRecovery';

jest.mock('react-native', () => ({
    AppState: { currentState: 'active', addEventListener: jest.fn() },
}));

describe('PlayerScreen visuals after returning from the background', () => {
    let revision: number;
    let refs: { current: any }[];
    let refCursor: number;
    let onState: (state: AppStateStatus) => void;
    let cleanup: (() => void) | undefined;
    const remove = jest.fn();

    function PlayerHarness(focused: boolean) {
        cleanup?.();
        refCursor = 0;
        return usePlayerVisualRecovery(focused);
    }
    function changeState(state: AppStateStatus) {
        Object.assign(AppState, { currentState: state });
        onState(state);
    }

    beforeEach(() => {
        jest.clearAllMocks();
        revision = 0;
        refs = [];
        cleanup = undefined;
        Object.assign(AppState, { currentState: 'active' });
        jest.spyOn(React, 'useState').mockImplementation(() =>
            [revision, (update: (value: number) => number) => { revision = update(revision); }] as any
        );
        jest.spyOn(React, 'useRef').mockImplementation(initial => {
            const index = refCursor++;
            refs[index] ??= { current: initial };
            return refs[index];
        });
        jest.spyOn(React, 'useEffect').mockImplementation(effect => { cleanup = effect() || undefined; });
        (AppState.addEventListener as jest.Mock).mockImplementation((_event, callback) => {
            onState = callback;
            return { remove };
        });
    });
    afterEach(() => { cleanup?.(); jest.restoreAllMocks(); });

    it('refreshes once when returning to an already visible player', () => {
        expect(PlayerHarness(true)).toBe(0);
        changeState('background');
        expect(revision).toBe(0);
        changeState('active');
        expect(PlayerHarness(true)).toBe(1);
        changeState('active');
        expect(revision).toBe(1);
        changeState('background');
        changeState('active');
        expect(revision).toBe(2);
    });

    it('defers recovery until the player opens after returning through the notification', () => {
        PlayerHarness(false);
        changeState('background');
        changeState('active');
        expect(revision).toBe(0);
        PlayerHarness(true);
        expect(revision).toBe(1);
        PlayerHarness(false);
        PlayerHarness(true);
        expect(revision).toBe(1);
    });

    it('does not recreate artwork on ordinary navigation to and from lyrics', () => {
        PlayerHarness(true);
        PlayerHarness(false);
        PlayerHarness(true);
        changeState('active');
        expect(revision).toBe(0);
    });

    it('recovers from inactive state and removes its listener when disposed', () => {
        PlayerHarness(true);
        changeState('inactive');
        changeState('active');
        expect(revision).toBe(1);
        cleanup?.();
        cleanup = undefined;
        expect(remove).toHaveBeenCalledTimes(1);
    });
});
