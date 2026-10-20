jest.mock('../utils/scheduleScreenRefresh', () => ({ scheduleScreenRefresh: (run: () => void) => { run(); return () => {}; } }));
import { Subject } from 'rxjs';
import { useRetainedRanking } from '../hooks/useRetainedRanking';
import { createHookHarness } from './helpers/hookHarness';
import { database } from '../database';

let mockFocused = true;
const mockFocusListeners = { focus: new Set<() => void>(), blur: new Set<() => void>() };
const mockNavigation = {
    isFocused: () => mockFocused,
    addListener: (event: 'focus' | 'blur', listener: () => void) => {
        mockFocusListeners[event].add(listener); return () => { mockFocusListeners[event].delete(listener); };
    },
};
const changeFocus = (focused: boolean) => {
    mockFocused = focused;
    mockFocusListeners[focused ? 'focus' : 'blur'].forEach(listener => listener());
};
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNavigation }));

it('keeps ranking data without reconnecting on unchanged focus and observes mutations after reconnecting', () => {
    const writes = new Subject(); const rankings = new Subject<number[]>();
    (database.get as jest.Mock).mockReturnValue({ changes: writes });
    const observe = jest.fn(() => rankings);
    const harness = createHookHarness();
    const render = () => harness.render(() => useRetainedRanking(observe, ['tracks'], () => [] as number[], true));
    try {
        render(); rankings.next([4]);
        expect(render().data).toEqual([4]);
        const updates = harness.stateUpdates;
        changeFocus(false); expect(rankings.observed).toBe(false);
        changeFocus(true);
        expect(harness.stateUpdates).toBe(updates);
        expect(observe).toHaveBeenCalledTimes(1);
        expect(render().loading).toBe(false);
        writes.next([{ type: 'updated' }]);
        expect(observe).toHaveBeenCalledTimes(2);
        rankings.next([5]); expect(render().data).toEqual([5]);
        changeFocus(false);
        writes.next([{ type: 'created' }]); writes.next([{ type: 'destroyed' }]);
        expect(observe).toHaveBeenCalledTimes(2);
        changeFocus(true); expect(observe).toHaveBeenCalledTimes(3);
        expect(render().data).toEqual([5]); expect(render().loading).toBe(false);
        rankings.next([]); expect(render().data).toEqual([]);
    } finally { harness.dispose(); jest.restoreAllMocks(); }
    expect(rankings.observed).toBe(false); expect(writes.observed).toBe(false);
});
