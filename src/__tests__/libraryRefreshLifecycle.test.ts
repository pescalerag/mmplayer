import { AppState } from 'react-native';
import { ScannerService } from '../services/ScannerService';
import { usePlayerStore } from '../store/usePlayerStore';
import { createLibraryRefreshController } from '../services/LibraryRefreshService';
import { subscribeApplicationLifecycle } from '../services/AppLifecycleService';

jest.mock('../services/ScannerService', () => ({ ScannerService: { syncLibrary: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('react-native', () => ({ AppState: { currentState: 'active', addEventListener: jest.fn() } }));
jest.mock('../store/usePlayerStore', () => ({ usePlayerStore: { getState: () => mockPlayback } }));
const mockPlayback = { syncWithTrackPlayer: jest.fn().mockResolvedValue(undefined), savePlaybackState: jest.fn().mockResolvedValue(undefined) };
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

it('scans once per session, coalesces simultaneous refreshes and allows a later manual scan', async () => {
    let finish: () => void = () => {};
    const scan = jest.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const controller = createLibraryRefreshController(scan);
    const startup = controller.startup();
    expect(controller.refresh()).toBe(startup);
    expect(controller.startup()).toBe(startup);
    await flush();
    expect(scan).toHaveBeenCalledTimes(1);
    finish(); await startup;
    await controller.startup();
    expect(scan).toHaveBeenCalledTimes(1);
    const manual = controller.refresh(); await flush();
    expect(scan).toHaveBeenCalledTimes(2);
    finish(); await manual;
});

it('allows an explicit retry after failure without automatically retrying on every remount', async () => {
    const scan = jest.fn().mockRejectedValueOnce(new Error('No permission')).mockResolvedValue(undefined);
    const controller = createLibraryRefreshController(scan);
    await expect(controller.startup()).rejects.toThrow('No permission');
    await expect(controller.startup()).rejects.toThrow('No permission');
    expect(scan).toHaveBeenCalledTimes(1);
    await controller.refresh();
    expect(scan).toHaveBeenCalledTimes(2);
});

it('preserves playback restoration and persistence without scanning on foreground or listener remounts', async () => {
    const listeners = new Set<(state: string) => void>();
    const addListener = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
        listeners.add(listener as (state: string) => void);
        return { remove: () => { listeners.delete(listener as (state: string) => void); } };
    });
    const emit = (state: string) => listeners.forEach(listener => listener(state));
    try {
        const unsubscribe = subscribeApplicationLifecycle();
        await flush();
        expect(ScannerService.syncLibrary).toHaveBeenCalledTimes(1);
        emit('inactive'); emit('background'); emit('active'); emit('active');
        await flush();
        expect(usePlayerStore.getState().syncWithTrackPlayer).toHaveBeenCalledTimes(1);
        expect(usePlayerStore.getState().savePlaybackState).toHaveBeenCalledTimes(2);
        expect(ScannerService.syncLibrary).toHaveBeenCalledTimes(1);
        unsubscribe();
        const removeSecond = subscribeApplicationLifecycle();
        await flush();
        expect(ScannerService.syncLibrary).toHaveBeenCalledTimes(1);
        removeSecond();
        expect(listeners.size).toBe(0);
    } finally { addListener.mockRestore(); }
});
