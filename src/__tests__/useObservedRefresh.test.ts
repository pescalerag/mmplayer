import { Subject } from 'rxjs';
import { AppState } from 'react-native';
import { useObservedRefresh } from '../hooks/useObservedRefresh';
import { database } from '../database';
import { createHookHarness } from './helpers/hookHarness';
import { useSyncStore } from '../store/useSyncStore';

let mockFocused = true;
const mockJobs = new Set<() => void>();
const mockAppListeners = new Set<(state: string) => void>();
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
jest.mock('react-native', () => ({ AppState: {
    currentState: 'active',
    addEventListener: (_event: string, listener: (state: string) => void) => {
        mockAppListeners.add(listener); return { remove: () => mockAppListeners.delete(listener) };
    },
} }));
jest.mock('../utils/scheduleScreenRefresh', () => ({ scheduleScreenRefresh: (run: () => void) => {
    mockJobs.add(run); return () => { mockJobs.delete(run); };
} }));
const paint = async () => { [...mockJobs].forEach(job => { mockJobs.delete(job); job(); }); for (let i = 0; i < 8; i++) await Promise.resolve(); };

it('observes writes while hidden, batches scanner writes and never reloads simply because focus returns', async () => {
    mockFocused = true;
    const writes = new Subject();
    (database.get as jest.Mock).mockReturnValue({ changes: writes });
    const load = jest.fn().mockResolvedValue(undefined);
    const harness = createHookHarness();
    const render = () => harness.render(() => useObservedRefresh(load, ['tracks']));
    try {
        render(); await paint(); expect(load).toHaveBeenCalledTimes(1);
        const updates = harness.stateUpdates;
        changeFocus(false); changeFocus(true); await paint();
        expect(load).toHaveBeenCalledTimes(1);
        expect(harness.stateUpdates).toBe(updates);
        changeFocus(false); writes.next([{ type: 'updated' }]); await paint();
        expect(load).toHaveBeenCalledTimes(1);
        changeFocus(true); await paint(); expect(load).toHaveBeenCalledTimes(2);
        useSyncStore.getState().setIsScanning(true);
        for (let i = 0; i < 50; i++) { writes.next([{ type: 'created' }]); await paint(); }
        expect(load).toHaveBeenCalledTimes(2);
        useSyncStore.getState().setIsScanning(false); await paint();
        expect(load).toHaveBeenCalledTimes(3);
    } finally { harness.dispose(); jest.restoreAllMocks(); useSyncStore.getState().setIsScanning(false); }
    expect(writes.observed).toBe(false); expect(mockAppListeners.size).toBe(0);
    expect(mockFocusListeners.focus.size).toBe(0); expect(mockFocusListeners.blur.size).toBe(0);
});

it('updates date-based results at midnight and waits for foreground without scanning', async () => {
    jest.useFakeTimers(); jest.setSystemTime(new Date(2026, 9, 19, 23, 59, 30));
    const harness = createHookHarness(); const load = jest.fn().mockResolvedValue(undefined);
    (database.get as jest.Mock).mockReturnValue({ changes: new Subject() });
    try {
        harness.render(() => useObservedRefresh(load, ['playback_history'])); await paint();
        (AppState as any).currentState = 'background'; mockAppListeners.forEach(listener => listener('background'));
        await jest.advanceTimersByTimeAsync(60_000); await paint();
        expect(load).toHaveBeenCalledTimes(1);
        (AppState as any).currentState = 'active'; mockAppListeners.forEach(listener => listener('active')); await paint();
        expect(load).toHaveBeenCalledTimes(2);
        mockAppListeners.forEach(listener => listener('active')); await paint();
        expect(load).toHaveBeenCalledTimes(2);
    } finally { harness.dispose(); jest.restoreAllMocks(); jest.useRealTimers(); }
});
