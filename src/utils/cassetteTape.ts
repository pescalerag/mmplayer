export const CASSETTE_CORE_RADIUS = 22;
export const CASSETTE_FULL_RADIUS = 100;

export function cassetteProgress(position: number, duration: number): number {
    if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0) return 0;
    return Math.max(0, Math.min(1, position / duration));
}

export function cassetteTapeRadius(fraction: number): number {
    'worklet';
    const clamped = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
    return Math.sqrt(CASSETTE_CORE_RADIUS ** 2 + clamped * (CASSETTE_FULL_RADIUS ** 2 - CASSETTE_CORE_RADIUS ** 2));
}
