/** Retain successful data across screen resets and share concurrent reads. */
export class RetainedResource<T> {
    private readonly values = new Map<string, T>();
    private readonly pending = new Map<string, Promise<T>>();

    constructor(private readonly capacity = 12) {}

    read(key: string): T | undefined {
        return this.values.get(key);
    }

    load(key: string, fetch: () => Promise<T>): Promise<T> {
        const existing = this.pending.get(key);
        if (existing) return existing;
        const request = Promise.resolve().then(fetch).then(value => {
            this.values.delete(key);
            this.values.set(key, value);
            if (this.values.size > this.capacity) {
                this.values.delete(this.values.keys().next().value!);
            }
            return value;
        }).finally(() => { this.pending.delete(key); });
        this.pending.set(key, request);
        return request;
    }
}
