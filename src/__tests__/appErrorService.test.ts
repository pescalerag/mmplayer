const saved = new Map<string, string>();
jest.mock('react-native-mmkv', () => ({ createMMKV: () => ({ getString: (key: string) => saved.get(key), set: (key: string, value: string) => saved.set(key, value) }) }));
jest.mock('react-native/Libraries/promiseRejectionTrackingOptions', () => ({ default: { onUnhandled: jest.fn(), onHandled: jest.fn() } }));
import { AppErrorService, describeError, installErrorCapture } from '../services/AppErrorService';

beforeEach(() => { jest.useFakeTimers(); AppErrorService.clear(); });
afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

it('persists bounded diagnostics, deduplicates errors and notifies only after a batch', () => {
    const listener = jest.fn();
    const unsubscribe = AppErrorService.subscribe(listener);
    AppErrorService.record('test', new Error('failed'));
    AppErrorService.record('test', 'same');
    AppErrorService.record('test', 'same');
    expect(listener).not.toHaveBeenCalled();
    expect(AppErrorService.getEntries().at(-1)?.count).toBe(2);
    jest.advanceTimersByTime(500);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(JSON.parse(saved.get('entries')!).at(-1).message).toBe('same');
    for (let i = 0; i < 250; i++) AppErrorService.record('test', String(i));
    expect(AppErrorService.getEntries()).toHaveLength(200);
    unsubscribe();
});

it('handles cyclic values and clears persisted entries', () => {
    const cyclic: { self?: unknown } = {}; cyclic.self = cyclic;
    expect(describeError(cyclic)).toBe('[Unserializable error]');
    AppErrorService.record('test', cyclic);
    AppErrorService.clear();
    expect(AppErrorService.getEntries()).toEqual([]);
    expect(saved.get('entries')).toBe('[]');
});

it('captures console errors, fatal exceptions and rejected promises while chaining existing handlers', () => {
    const previousError = console.error;
    const previousWarn = console.warn;
    const originalGlobal = (globalThis as any).ErrorUtils;
    const originalHermes = (globalThis as any).HermesInternal;
    const previousHandler = jest.fn();
    let handler: (error: Error, fatal: boolean) => void;
    let tracker: { onUnhandled(id: number, error: unknown): void; onHandled(id: number): void };
    (globalThis as any).ErrorUtils = { getGlobalHandler: () => previousHandler, setGlobalHandler: (next: typeof handler) => { handler = next; } };
    (globalThis as any).HermesInternal = { enablePromiseRejectionTracker: (next: typeof tracker) => { tracker = next; } };
    console.error = jest.fn(); console.warn = jest.fn();
    try {
        installErrorCapture();
        const installed = console.error;
        installErrorCapture();
        expect(console.error).toBe(installed);
        console.error('render failure');
        const failure = new Error('fatal failure');
        handler!(failure, true);
        expect(previousHandler).toHaveBeenCalledWith(failure, true);
        expect(saved.get('entries')).toContain('fatal failure');
        tracker!.onUnhandled(1, new Error('async failure'));
        expect(AppErrorService.getEntries().some(entry => entry.source === 'Promise rejection' && entry.message.includes('async failure'))).toBe(true);
    } finally {
        console.error = previousError; console.warn = previousWarn;
        (globalThis as any).ErrorUtils = originalGlobal;
        (globalThis as any).HermesInternal = originalHermes;
    }
});
