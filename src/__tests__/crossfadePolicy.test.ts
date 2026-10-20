import { getCrossfadePolicy, normalizeCrossfadeSeconds } from '../utils/crossfadePolicy';

const input = { seconds: 6, casting: false, switchingQueue: false, restoring: false,
    syncingLyrics: false, hasABPoint: false, blocked: false };

it.each([[0, 0], [-5, 0], [3.7, 4], [12, 12], [20, 12], [NaN, 0], [Infinity, 0]])(
    'normalizes persisted or edited durations %s to %s', (value, expected) => {
        expect(normalizeCrossfadeSeconds(value)).toBe(expected);
    });

it.each(['casting', 'switchingQueue', 'restoring', 'syncingLyrics', 'hasABPoint', 'blocked'])(
    'suspends preparation and consolidates the mix while %s', reason => {
        expect(getCrossfadePolicy({ ...input, [reason]: true })).toEqual({ seconds: 6, allowed: false });
    });

it('disables future transitions without forcing an audible mix to stop', () => {
    expect(getCrossfadePolicy({ ...input, seconds: 0 })).toEqual({ seconds: 0, allowed: true });
});
