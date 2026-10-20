import { Observable, Subscription } from 'rxjs';

/** Bounded result cache; invalidations never fetch until a consumer asks. */
export class ObservedResource<T> {
    private revision = 0;
    private subscription?: Subscription;
    private readonly values = new Map<string, { revision: number; value: T }>();
    private readonly pending = new Map<string, Promise<T>>();
    constructor(private readonly changes: () => Observable<unknown>, private readonly capacity = 12) {}
    read(key: string) { return this.values.get(key)?.value; }
    invalidate = () => { this.revision++; };
    load(key: string, fetch: () => Promise<T>): Promise<T> {
        this.subscription ??= this.changes().subscribe(this.invalidate);
        const revision = this.revision;
        const existing = this.values.get(key);
        if (existing?.revision === revision) return Promise.resolve(existing.value);
        const pendingKey = `${revision}:${key}`;
        const running = this.pending.get(pendingKey);
        if (running) return running;
        const request = Promise.resolve().then(fetch).then(value => {
            if (revision === this.revision) {
                this.values.delete(key);
                this.values.set(key, { revision, value });
                if (this.values.size > this.capacity) this.values.delete(this.values.keys().next().value!);
            }
            return value;
        }).finally(() => { this.pending.delete(pendingKey); });
        this.pending.set(pendingKey, request);
        return request;
    }
    dispose() { this.subscription?.unsubscribe(); this.subscription = undefined; this.revision++; this.values.clear(); }
}
