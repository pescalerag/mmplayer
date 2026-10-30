import { Subject } from 'rxjs';
import { ObservedResource } from '../utils/observedResource';

it('shares reads across consumers, retains data and only fetches changed data when requested', async () => {
    const changes = new Subject();
    const resource = new ObservedResource<number>(() => changes, 2);
    const fetch = jest.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(5);
    const first = resource.load('rank', fetch);
    expect(resource.load('rank', fetch)).toBe(first);
    await first;
    expect(await resource.load('rank', fetch)).toBe(4);
    expect(fetch).toHaveBeenCalledTimes(1);
    changes.next({ type: 'updated' });
    changes.next({ type: 'updated' });
    expect(resource.read('rank')).toBe(4);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await resource.load('rank', fetch)).toBe(5);
    expect(fetch).toHaveBeenCalledTimes(2);
    resource.dispose(); expect(changes.observed).toBe(false);
});

it('does not let a late obsolete read replace a newer revision', async () => {
    const changes = new Subject();
    const resource = new ObservedResource<number>(() => changes);
    let finish!: (value: number) => void;
    const old = resource.load('data', () => new Promise<number>(resolve => { finish = resolve; }));
    await Promise.resolve();
    changes.next(null);
    await resource.load('data', async () => 2);
    finish(1); await old;
    expect(resource.read('data')).toBe(2);
    resource.dispose();
});

it('bounds retained results and retries failed reads', async () => {
    const resource = new ObservedResource<number>(() => new Subject(), 1);
    await resource.load('a', async () => 1);
    await resource.load('b', async () => 2);
    expect(resource.read('a')).toBeUndefined();
    await expect(resource.load('c', async () => { throw new Error('read'); })).rejects.toThrow('read');
    expect(await resource.load('c', async () => 3)).toBe(3);
    resource.dispose();
});
