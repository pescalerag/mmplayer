import { EMPTY_SKIP_CONFIG, formatTimestampInput, hasAudibleABRange, normalizeSkipSegments, parseSkipConfig, parseTimestampInput, resolveSkipPosition } from '../utils/trackTimestamps';

const segment = (startMs: number, endMs: number, id = `${startMs}`) => ({ id, startMs, endMs });

it('sorts and merges overlapping and adjacent sections without changing source data', () => {
    const input = [segment(4000, 6000), segment(1000, 3000), segment(2500, 4000)];
    expect(normalizeSkipSegments(input, 10000)).toEqual([segment(1000, 6000)]);
    expect(input[1].endMs).toBe(3000);
});

it.each([[0, 0], [1000, 500], [-1, 1000], [0, 10001], [NaN, 1000], [0, Infinity], [0, 10000]])('rejects invalid or whole-song skip %s → %s', (start, end) => {
    expect(() => normalizeSkipSegments([segment(start, end)], 10000)).toThrow();
});

it('leaves old libraries and corrupt or outdated rules playable', () => {
    for (const raw of [null, undefined, '', '{invalid', '{"segments":{}}']) expect(parseSkipConfig(raw)).toEqual(EMPTY_SKIP_CONFIG);
    expect(parseSkipConfig(JSON.stringify({ segments: [segment(1000, 8000)] }), 5000)).toEqual(EMPTY_SKIP_CONFIG);
});

it('uses half-open intervals, preserves the original clock and honors disabled rules', () => {
    const config = { enabled: true, segments: [segment(1000, 3000)] };
    expect(resolveSkipPosition(999, config)).toBe(999);
    expect(resolveSkipPosition(1000, config)).toBe(3000);
    expect(resolveSkipPosition(2999, config)).toBe(3000);
    expect(resolveSkipPosition(3000, config)).toBe(3000);
    expect(resolveSkipPosition(2000, { ...config, enabled: false })).toBe(2000);
    expect(hasAudibleABRange(1, 2, config)).toBe(false);
    expect(hasAudibleABRange(1, 4, config)).toBe(true);
});

it.each([['0:00', 0], ['1:02.125', 62125], ['02:59,5', 179500], ['100:00', 6000000]])('parses %s precisely in milliseconds', (input, expected) => {
    expect(parseTimestampInput(input)).toBe(expected);
    expect(parseTimestampInput(formatTimestampInput(expected))).toBe(expected);
});

it.each(['-1:00', '1:60', '1:2:3', '', 'abc', '0:10.1234'])('rejects ambiguous time %s', input => {
    expect(parseTimestampInput(input)).toBeNull();
});
