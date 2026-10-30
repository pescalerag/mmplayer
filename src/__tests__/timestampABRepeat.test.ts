import { useABRepeatStore } from '../store/useABRepeatStore';
import { useTimestampStore } from '../store/useTimestampStore';
import { TimestampService } from '../services/TimestampService';

const mockToast = jest.fn();
let mockNativeHandles = true;
jest.mock('../services/TimestampService', () => ({ TimestampService: { nativeHandlesAB: () => mockNativeHandles, seekAutomatically: jest.fn(async () => {}) } }));
jest.mock('../store/useCastStore', () => ({ useCastStore: { getState: () => ({ isServerRunning: false }) } }));
jest.mock('../store/useToastStore', () => ({ useToastStore: { getState: () => ({ showToast: mockToast }) } }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' } }));

beforeEach(() => {
    jest.clearAllMocks(); mockNativeHandles = true;
    useABRepeatStore.setState({ pointA: null, pointB: null });
    useTimestampStore.setState({ trackId: 'song', previewTrackId: null, previewConfig: null,
        config: { enabled: true, segments: [{ id: 'jump', startMs: 10000, endMs: 20000 }] } });
});

it('rejects an A–B range that has no audible audio left', () => {
    useABRepeatStore.getState().handleButtonPress(12);
    useABRepeatStore.getState().handleButtonPress(18);
    expect(useABRepeatStore.getState()).toMatchObject({ pointA: 12, pointB: null });
    expect(mockToast).toHaveBeenLastCalledWith(expect.any(String), 'warning');
});

it('allows an A–B range spanning an omitted section and delegates both boundaries to the native engine', async () => {
    useABRepeatStore.getState().handleButtonPress(5);
    useABRepeatStore.getState().handleButtonPress(25);
    expect(useABRepeatStore.getState()).toMatchObject({ pointA: 5, pointB: 25 });
    expect(await useABRepeatStore.getState().checkLoop(26)).toBeNull();
    expect(TimestampService.seekAutomatically).not.toHaveBeenCalled();
});

it('uses an automatic seek for the existing fallback loop so a skip containing A is respected', async () => {
    mockNativeHandles = false;
    useABRepeatStore.setState({ pointA: 12, pointB: 25 });
    expect(await useABRepeatStore.getState().checkLoop(26)).toBe(12);
    expect(TimestampService.seekAutomatically).toHaveBeenCalledWith(12);
});

it('leaves original audio available in the editor without the A–B loop moving playback', async () => {
    mockNativeHandles = false;
    useTimestampStore.setState({ previewTrackId: 'song' });
    useABRepeatStore.setState({ pointA: 5, pointB: 25 });
    expect(await useABRepeatStore.getState().checkLoop(30)).toBeNull();
    expect(TimestampService.seekAutomatically).not.toHaveBeenCalled();
});
