/** Coalesces invalidations without doing work for a hidden screen. */
export class ObservedRefresh {
    private dirty = true;
    private visible = false;
    private running = false;
    private disposed = false;
    private busy = false;
    private loaded = false;
    private cancelScheduled?: () => void;
    private abort?: AbortController;

    constructor(
        private readonly load: (signal: AbortSignal) => Promise<unknown> | void,
        private readonly schedule: (run: () => void) => () => void,
        private readonly onError: (error: unknown) => void,
    ) {}

    invalidate = () => { this.dirty = true; this.enqueue(); };

    setVisible(visible: boolean) {
        this.visible = visible;
        if (!visible) { this.cancelScheduled?.(); this.cancelScheduled = undefined; }
        this.enqueue();
    }

    setBusy(busy: boolean) {
        this.busy = busy;
        if (busy && this.loaded) { this.cancelScheduled?.(); this.cancelScheduled = undefined; }
        this.enqueue();
    }

    dispose() { this.disposed = true; this.cancelScheduled?.(); this.abort?.abort(); }

    private enqueue() {
        if (this.disposed || !this.visible || (this.busy && this.loaded) || !this.dirty || this.running || this.cancelScheduled) return;
        this.cancelScheduled = this.schedule(() => {
            this.cancelScheduled = undefined;
            void this.run();
        });
    }

    private async run() {
        if (this.disposed || !this.visible) return;
        this.dirty = false;
        this.running = true;
        this.abort = new AbortController();
        let failed = false;
        try { await this.load(this.abort.signal); this.loaded = true; }
        catch (error) { failed = true; this.dirty = true; this.onError(error); }
        finally {
            this.running = false;
            // A failed read retries on the next focus/change, not in a busy loop.
            if (!failed) this.enqueue();
        }
    }
}
