import { RetainedResource } from '../utils/retainedResource';

describe('retained screen data', () => {
    it('shares an in-flight read across screen resets', async () => {
        const resource = new RetainedResource<number>();
        let resolve!: (value: number) => void;
        const fetch = jest.fn(() => new Promise<number>(done => { resolve = done; }));
        const first = resource.load('home', fetch);
        const second = resource.load('home', fetch);
        await Promise.resolve();
        expect(first).toBe(second);
        expect(fetch).toHaveBeenCalledTimes(1);
        resolve(42);
        await first;
        expect(resource.read('home')).toBe(42);
    });

    it('keeps successful content visible during refresh and after a refresh failure', async () => {
        const resource = new RetainedResource<number>();
        await resource.load('week', async () => 10);
        const refresh = resource.load('week', async () => { throw new Error('offline'); });
        expect(resource.read('week')).toBe(10);
        await expect(refresh).rejects.toThrow('offline');
        expect(resource.read('week')).toBe(10);
        await resource.load('week', async () => 20);
        expect(resource.read('week')).toBe(20);
    });

    it('keeps periods independent and bounds retained memory', async () => {
        const resource = new RetainedResource<number>(2);
        await resource.load('day', async () => 1);
        await resource.load('week', async () => 2);
        await resource.load('month', async () => 3);
        expect(resource.read('day')).toBeUndefined();
        expect(resource.read('week')).toBe(2);
        expect(resource.read('month')).toBe(3);
    });
});
