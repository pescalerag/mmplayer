import { createMMKV } from 'react-native-mmkv';

export interface AppErrorEntry {
    id: string;
    time: number;
    source: string;
    message: string;
    count: number;
}

const storage = createMMKV({ id: 'app-errors' });
const listeners = new Set<() => void>();
let entries: AppErrorEntry[] = [];
let sequence = 0;
let pending: ReturnType<typeof setTimeout> | undefined;
try {
    const saved: unknown = JSON.parse(storage.getString('entries') ?? '[]');
    if (Array.isArray(saved)) entries = saved.filter(entry => typeof entry?.message === 'string' && typeof entry?.time === 'number').slice(-200);
} catch { /* A damaged log must never prevent startup. */ }

function flush() {
    if (pending) clearTimeout(pending);
    pending = undefined;
    try { storage.set('entries', JSON.stringify(entries)); } catch { /* Logging must not throw. */ }
    listeners.forEach(listener => listener());
}

export function describeError(value: unknown): string {
    try {
        if (value instanceof Error) return value.stack || value.message;
        return typeof value === 'string' ? value : JSON.stringify(value) ?? String(value);
    } catch { return '[Unserializable error]'; }
}

export const AppErrorService = {
    record(source: string, ...values: unknown[]) {
        const message = values.map(describeError).join(' ').slice(0, 12000);
        const previous = entries.at(-1);
        const time = Date.now();
        if (previous?.source === source && previous.message === message && time - previous.time < 10000) {
            entries = [...entries.slice(0, -1), { ...previous, time, count: previous.count + 1 }];
        } else {
            entries = [...entries.slice(-199), { id: `${time}-${++sequence}`, time, source, message, count: 1 }];
        }
        // No disk writes or React notifications on the normal playback path.
        if (!pending) pending = setTimeout(flush, 500);
    },
    getEntries: () => entries,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    clear() { entries = []; flush(); },
    flush,
};

let installed = false;
export function installErrorCapture() {
    if (installed) return;
    installed = true;
    const originalError = console.error;
    console.error = (...args: unknown[]) => { AppErrorService.record('console.error', ...args); originalError.apply(console, args); };
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
        if (String(args[0]).includes('unhandled promise rejection')) AppErrorService.record('Promise rejection', ...args);
        originalWarn.apply(console, args);
    };
    const runtime = globalThis as typeof globalThis & {
        ErrorUtils?: { getGlobalHandler(): (error: Error, fatal?: boolean) => void; setGlobalHandler(handler: (error: Error, fatal?: boolean) => void): void };
        HermesInternal?: { enablePromiseRejectionTracker?(options: { allRejections: boolean; onUnhandled(id: number, error: unknown): void; onHandled(id: number): void }): void };
    };
    const previous = runtime.ErrorUtils?.getGlobalHandler();
    if (previous) runtime.ErrorUtils?.setGlobalHandler((error, fatal) => {
        AppErrorService.record(fatal ? 'JS fatal' : 'JS', error);
        AppErrorService.flush();
        previous(error, fatal);
    });
    // Preserve React Native's own development reporting. Hermes enables tracking
    // only in development by default; explicitly enable it in release as well.
    const options = require('react-native/Libraries/promiseRejectionTrackingOptions').default;
    runtime.HermesInternal?.enablePromiseRejectionTracker?.({
        allRejections: true,
        onUnhandled(id, error) { AppErrorService.record('Promise rejection', error); options.onUnhandled(id, error); },
        onHandled(id) { options.onHandled(id); },
    });
}
