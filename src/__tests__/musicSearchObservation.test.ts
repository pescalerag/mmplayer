import { Subject } from 'rxjs';
import { database } from '../database';
import { useMusicSearch } from '../hooks/useMusicSearch';
import { createHookHarness } from './helpers/hookHarness';

let mockFocused = true;
const mockJobs = new Set<() => void>();
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
jest.mock('react-native', () => ({ AppState: { currentState: 'active', addEventListener: () => ({ remove: jest.fn() }) } }));
jest.mock('../utils/scheduleScreenRefresh', () => ({ scheduleScreenRefresh: (run: () => void) => {
    mockJobs.add(run); return () => { mockJobs.delete(run); };
} }));
const paint = async () => { [...mockJobs].forEach(job => { mockJobs.delete(job); job(); }); for (let i = 0; i < 20; i++) await Promise.resolve(); };

it('defers first browse reads, does not duplicate them on mount and only refreshes a hidden tab after relevant changes', async () => {
    const writes = new Subject();
    const fetch = jest.fn(async () => []);
    (database.get as jest.Mock).mockReturnValue({ changes: writes });
    (database.collections.get as jest.Mock).mockReturnValue({ query: () => ({ fetch }) });
    const harness = createHookHarness();
    const render = () => harness.render(() => useMusicSearch(''));
    try {
        render(); expect(fetch).not.toHaveBeenCalled();
        await paint(); render(); await paint(); render();
        expect(fetch).toHaveBeenCalledTimes(4);
        changeFocus(false); changeFocus(true); await paint();
        expect(fetch).toHaveBeenCalledTimes(4);
        changeFocus(false);
        writes.next([{ type: 'created' }]); writes.next([{ type: 'updated' }]);
        await paint(); expect(fetch).toHaveBeenCalledTimes(4);
        changeFocus(true); await paint(); render();
        expect(fetch).toHaveBeenCalledTimes(8);
    } finally { harness.dispose(); jest.restoreAllMocks(); }
    expect(writes.observed).toBe(false);
});
