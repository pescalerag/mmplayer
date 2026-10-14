import { CASSETTE_CORE_RADIUS, CASSETTE_FULL_RADIUS, cassetteProgress, cassetteTapeRadius } from '../utils/cassetteTape';

describe('cassette tape conservation', () => {
    it('starts full on the left and ends full on the right', () => {
        expect(cassetteTapeRadius(1)).toBe(CASSETTE_FULL_RADIUS);
        expect(cassetteTapeRadius(0)).toBe(CASSETTE_CORE_RADIUS);
    });
    it.each([0, 0.1, 0.5, 0.8, 1])('conserves the combined tape area at progress %s', progress => {
        const left = cassetteTapeRadius(1 - progress);
        const right = cassetteTapeRadius(progress);
        expect(left ** 2 + right ** 2).toBeCloseTo(CASSETTE_FULL_RADIUS ** 2 + CASSETTE_CORE_RADIUS ** 2);
    });
    it('clamps out-of-range and invalid fractions', () => {
        expect(cassetteTapeRadius(-1)).toBe(CASSETTE_CORE_RADIUS);
        expect(cassetteTapeRadius(2)).toBe(CASSETTE_FULL_RADIUS);
        expect(cassetteTapeRadius(NaN)).toBe(CASSETTE_CORE_RADIUS);
    });
    it('handles seeking, missing duration and invalid playback values', () => {
        expect(cassetteProgress(30, 120)).toBe(0.25);
        expect(cassetteProgress(-10, 120)).toBe(0);
        expect(cassetteProgress(150, 120)).toBe(1);
        expect(cassetteProgress(0, 0)).toBe(0);
        expect(cassetteProgress(10, -1)).toBe(0);
        expect(cassetteProgress(NaN, 120)).toBe(0);
        expect(cassetteProgress(10, Infinity)).toBe(0);
    });
});
