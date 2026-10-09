import React from 'react';
import { database } from '../database';
import { useMusicSearch } from '../hooks/useMusicSearch';

const settle = async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
};

// Drive hook renders and effect cleanup so pending database promises can be
// resolved after the user changes the query, without a native renderer.
function createSearchHarness() {
    const states: any[] = [];
    const refs: any[] = [];
    const effects: { deps?: React.DependencyList; cleanup?: () => void }[] = [];
    let stateIndex = 0;
    let refIndex = 0;
    let effectIndex = 0;
    let queuedEffects: (() => void)[] = [];
    jest.spyOn(React, 'useState').mockImplementation(((initial: any) => {
        const index = stateIndex++;
        if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
        return [states[index], (next: any) => {
            states[index] = typeof next === 'function' ? next(states[index]) : next;
        }];
    }) as any);
    jest.spyOn(React, 'useRef').mockImplementation(((initial: any) => {
        const index = refIndex++;
        refs[index] ??= { current: initial };
        return refs[index];
    }) as any);
    jest.spyOn(React, 'useCallback').mockImplementation(callback => callback);
    jest.spyOn(React, 'useEffect').mockImplementation((effect, deps) => {
        const index = effectIndex++;
        const previous = effects[index];
        if (previous && deps?.every((value, i) => Object.is(value, previous.deps?.[i]))) return;
        queuedEffects.push(() => {
            previous?.cleanup?.();
            effects[index] = { deps, cleanup: effect() || undefined };
        });
    });
    return {
        render: function useSearchRender(query: string) {
            stateIndex = refIndex = effectIndex = 0;
            queuedEffects = [];
            const result = useMusicSearch(query);
            queuedEffects.forEach(effect => effect());
            return result;
        },
        dispose() { effects.forEach(effect => effect.cleanup?.()); },
    };
}

describe('search responsiveness', () => {
    let trackFetch: jest.Mock;
    let harness: ReturnType<typeof createSearchHarness>;
    const track = (id: string, title: string) => ({
        id, title,
        artist: { fetch: jest.fn().mockResolvedValue(null) },
        album: { fetch: jest.fn().mockResolvedValue(null) },
    });

    beforeEach(() => {
        jest.useFakeTimers();
        trackFetch = jest.fn().mockResolvedValue([]);
        (database.collections.get as jest.Mock).mockImplementation(name => ({
            query: () => ({ fetch: name === 'tracks' ? trackFetch : jest.fn().mockResolvedValue([]) }),
        }));
        harness = createSearchHarness();
    });

    afterEach(() => {
        harness.dispose();
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    it('clears loading immediately and ignores a late top-match relation', async () => {
        let resolveArtist!: (artist: any) => void;
        const match = track('a', 'ab');
        match.artist.fetch.mockReturnValue(new Promise(resolve => { resolveArtist = resolve; }));
        trackFetch.mockResolvedValue([match]);
        harness.render('ab');
        jest.advanceTimersByTime(180);
        await settle();
        expect(match.artist.fetch).toHaveBeenCalled();
        harness.render('');
        expect(harness.render('').isLoading).toBe(false);
        resolveArtist(null);
        await settle();
        // Re-entering a query must not expose the cancelled match.
        const result = harness.render('cd');
        expect(result.results.tracks).toEqual([]);
        expect(result.topMatch).toBeNull();
    });

    it('does not append an old page after the query changes', async () => {
        const initialTracks = Array.from({ length: 50 }, (_, index) => track(`${index}`, index === 0 ? 'ab' : `ab ${index}`));
        trackFetch.mockResolvedValue(initialTracks);
        harness.render('ab');
        jest.advanceTimersByTime(180);
        await settle();
        const result = harness.render('ab');
        expect(result.results.tracks).toHaveLength(50);
        let resolvePage!: (tracks: any[]) => void;
        trackFetch.mockReturnValueOnce(new Promise(resolve => { resolvePage = resolve; }));
        const page = result.loadMoreTracks();
        harness.render('');
        resolvePage([track('old', 'old page')]);
        await page;
        expect(harness.render('cd').results.tracks).toEqual([]);
        expect(harness.render('cd').isLoadingMore).toBe(false);
    });

    it('shares one pagination request when onEndReached fires twice', async () => {
        trackFetch.mockResolvedValue(Array.from({ length: 50 }, (_, index) => track(`${index}`, 'ab')));
        harness.render('ab');
        jest.advanceTimersByTime(180);
        await settle();
        const result = harness.render('ab');
        let resolvePage!: (tracks: any[]) => void;
        trackFetch.mockClear().mockReturnValueOnce(new Promise(resolve => { resolvePage = resolve; }));
        const first = result.loadMoreTracks();
        await result.loadMoreTracks();
        expect(trackFetch).toHaveBeenCalledTimes(1);
        resolvePage([track('0', 'duplicate'), track('new', 'new')]);
        await first;
        expect(harness.render('ab').results.tracks).toHaveLength(51);
    });
});
