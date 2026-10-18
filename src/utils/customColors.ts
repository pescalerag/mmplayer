/** Picker HEX is RGBA; native Android HEX uses ARGB. Store opaque RGB for both renderers. */
export function normalizeOpaqueColor(value: unknown, fallback = '#8B5CF6'): string {
    if (typeof value !== 'string') return fallback;
    const hex = value.trim();
    if (/^#[\da-f]{3,4}$/i.test(hex)) {
        return '#' + [...hex.slice(1, 4)].map(channel => channel + channel).join('').toUpperCase();
    }
    if (/^#[\da-f]{6}([\da-f]{2})?$/i.test(hex)) return hex.slice(0, 7).toUpperCase();
    return fallback;
}
