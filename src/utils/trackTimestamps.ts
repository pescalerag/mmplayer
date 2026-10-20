export interface SkipSegment { id: string; startMs: number; endMs: number; }
export interface SkipConfig { enabled: boolean; segments: SkipSegment[]; }
export const EMPTY_SKIP_CONFIG: SkipConfig = { enabled: true, segments: [] };

export function normalizeSkipSegments(segments: readonly SkipSegment[], durationMs: number): SkipSegment[] {
    if (!Number.isFinite(durationMs) || durationMs <= 0) throw new Error('duration');
    const sorted = segments.map(segment => {
        if (!Number.isFinite(segment.startMs) || !Number.isFinite(segment.endMs)
            || segment.startMs < 0 || segment.startMs >= segment.endMs || segment.endMs > durationMs) throw new Error('range');
        return { ...segment, startMs: Math.round(segment.startMs), endMs: Math.round(segment.endMs) };
    }).sort((a, b) => a.startMs - b.startMs);
    const merged: SkipSegment[] = [];
    for (const segment of sorted) {
        if (segment.startMs >= segment.endMs) throw new Error('range');
        const previous = merged[merged.length - 1];
        if (previous && segment.startMs <= previous.endMs) previous.endMs = Math.max(previous.endMs, segment.endMs);
        else merged.push(segment);
    }
    if (merged.length === 1 && merged[0].startMs === 0 && merged[0].endMs >= durationMs) throw new Error('whole_song');
    return merged;
}

export function parseSkipConfig(raw?: string | null, durationMs = Number.MAX_SAFE_INTEGER): SkipConfig {
    if (!raw) return EMPTY_SKIP_CONFIG;
    try {
        const value = JSON.parse(raw);
        if (!Array.isArray(value.segments)) return EMPTY_SKIP_CONFIG;
        return { enabled: value.enabled !== false, segments: normalizeSkipSegments(value.segments, durationMs) };
    } catch { return EMPTY_SKIP_CONFIG; }
}

export function resolveSkipPosition(positionMs: number, config: SkipConfig): number {
    if (!config.enabled) return positionMs;
    return config.segments.find(segment => positionMs >= segment.startMs && positionMs < segment.endMs)?.endMs ?? positionMs;
}

export function hasAudibleABRange(a: number, b: number, config: SkipConfig): boolean {
    return !config.enabled || resolveSkipPosition(a * 1000, config) < b * 1000;
}

export function parseTimestampInput(value: string): number | null {
    const match = /^(?:(\d+):)?([0-5]?\d)(?:[.,](\d{1,3}))?$/.exec(value.trim());
    if (!match) return null;
    return Number(match[1] || 0) * 60000 + Number(match[2]) * 1000 + Number((match[3] || '').padEnd(3, '0'));
}

export function formatTimestampInput(milliseconds: number): string {
    const ms = Math.max(0, Math.round(milliseconds));
    return `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}
