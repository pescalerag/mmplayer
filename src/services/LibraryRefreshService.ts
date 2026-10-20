import { ScannerService } from './ScannerService';

/** Coalesce refresh requests and scan only once per JS session on startup. */
export function createLibraryRefreshController(scan: () => Promise<unknown>) {
    let running: Promise<void> | undefined;
    let startup: Promise<void> | undefined;
    const refresh = () => {
        if (running) return running;
        const result = Promise.resolve().then(scan).then(() => {});
        running = result;
        void result.then(() => { running = undefined; }, () => { running = undefined; });
        return result;
    };
    return { refresh, startup: () => { startup ??= refresh(); return startup; } };
}

export const LibraryRefreshService = createLibraryRefreshController(() => ScannerService.syncLibrary());
