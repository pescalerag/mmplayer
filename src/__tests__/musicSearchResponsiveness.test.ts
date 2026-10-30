jest.mock('../hooks/useObservedRefresh', () => ({ useObservedRefresh: jest.fn() }));
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

    it.each([
        ['artists', 'artist', 'ab'], ['albums', 'album', 'ab'], ['playlists', 'playlist', 'ab'],
        ['artists', 'artist', 'ab prefix'], ['albums', 'album', 'ab prefix'], ['playlists', 'playlist', 'ab prefix'],
        ['artists', 'artist', 'contains ab'], ['albums', 'album', 'contains ab'], ['playlists', 'playlist', 'contains ab'],
    ])('selects the best %s match (%s, %s) when no title matches', async (table, type, title) => {
        const item = { id: 'match', name: title, title };
        (database.collections.get as jest.Mock).mockImplementation(name => ({
            query: () => ({ fetch: async () => name === table ? [item] : [] }),
        }));
        harness.render('ab');
        jest.advanceTimersByTime(180); await settle();
        expect(harness.render('ab').topMatch).toEqual({ type, item });
    });

    it('returns lyric-only matches once and adds the best track relations', async () => {
        const song = track('song', 'abc');
        const artist = { id: 'artist', name: 'Artist' }; const album = { id: 'album', title: 'Album' };
        song.artist.fetch.mockResolvedValue(artist as any); song.album.fetch.mockResolvedValue(album as any);
        const lyric = track('lyric', 'Other song');
        (database.collections.get as jest.Mock).mockImplementation(name => ({
            query: (...clauses: any[]) => ({ fetch: async () => name === 'tracks'
                ? (clauses.some(clause => clause.left === 'lyrics_lrc') ? [song, lyric] : [song]) : [] }),
        }));
        harness.render('abc'); jest.advanceTimersByTime(180); await settle();
        const result = harness.render('abc');
        expect(result.results.tracks.map(song => song.id)).toEqual(['song', 'lyric']);
        expect((result.results.tracks[1] as any).isLyricMatch).toBe(true);
        expect(result.results.artists).toEqual([artist]); expect(result.results.albums).toEqual([album]);
    });

    it('finishes loading after a search failure and allows a later query to succeed', async () => {
        const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
        try {
            trackFetch.mockRejectedValueOnce(Error('Unavailable'));
            harness.render('ab'); jest.advanceTimersByTime(180); await settle();
            expect(harness.render('ab').isLoading).toBe(false);
            expect(errors).toHaveBeenCalled();
            trackFetch.mockResolvedValue([track('next', 'cd')]);
            harness.render('cd'); jest.advanceTimersByTime(180); await settle();
            expect(harness.render('cd').results.tracks[0].id).toBe('next');
        } finally { errors.mockRestore(); }
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
