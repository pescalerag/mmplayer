export interface SkipSegment {
  id: string;
  startMs: number;
  endMs: number;
}
export interface SkipConfig {
  enabled: boolean;
  segments: SkipSegment[];
}
export const EMPTY_SKIP_CONFIG: SkipConfig = { enabled: true, segments: [] };

export function normalizeSkipSegments(
  segments: readonly SkipSegment[],
  durationMs: number,
): SkipSegment[] {
  if (!Number.isFinite(durationMs) || durationMs <= 0)
    throw new Error("duration");
  const sorted = segments
    .map((segment) => {
      if (
        !Number.isFinite(segment.startMs) ||
        !Number.isFinite(segment.endMs) ||
        segment.startMs < 0 ||
        segment.startMs >= segment.endMs ||
        segment.endMs > durationMs
      )
        throw new Error("range");
      return {
        ...segment,
        startMs: Math.round(segment.startMs),
        endMs: Math.round(segment.endMs),
      };
    })
    .sort((a, b) => a.startMs - b.startMs);
  const merged: SkipSegment[] = [];
  for (const segment of sorted) {
    if (segment.startMs >= segment.endMs) throw new Error("range");
    const previous = merged[merged.length - 1];
    if (previous && segment.startMs <= previous.endMs)
      previous.endMs = Math.max(previous.endMs, segment.endMs);
    else merged.push(segment);
  }
  if (
    merged.length === 1 &&
    merged[0].startMs === 0 &&
    merged[0].endMs >= durationMs
  )
    throw new Error("whole_song");
  return merged;
}

export function parseSkipConfig(
  raw?: string | null,
  durationMs = Number.MAX_SAFE_INTEGER,
): SkipConfig {
  if (!raw) return EMPTY_SKIP_CONFIG;
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value.segments)) return EMPTY_SKIP_CONFIG;
    return {
      enabled: value.enabled !== false,
      segments: normalizeSkipSegments(value.segments, durationMs),
    };
  } catch {
    return EMPTY_SKIP_CONFIG;
  }
}

export function resolveSkipPosition(
  positionMs: number,
  config: SkipConfig,
): number {
  if (!config.enabled) return positionMs;
  return (
    config.segments.find(
      (segment) => positionMs >= segment.startMs && positionMs < segment.endMs,
    )?.endMs ?? positionMs
  );
}

export function hasAudibleABRange(
  a: number,
  b: number,
  config: SkipConfig,
): boolean {
  return !config.enabled || resolveSkipPosition(a * 1000, config) < b * 1000;
}

export type ABTransitionAction =
  | {
      type: "set_a";
      pointA: number;
      pointB: null;
      toastKey: "toasts.ab_point_a_set";
      toastIcon: "flag-outline";
      haptic: "light";
    }
  | {
      type: "update_a";
      pointA: number;
      pointB: null;
      toastKey: "toasts.ab_point_a_updated";
      toastIcon: "flag-outline";
      haptic: "light";
    }
  | {
      type: "set_b";
      pointA: number;
      pointB: number;
      toastKey: "toasts.ab_point_b_set";
      toastIcon: "repeat";
      haptic: "light";
    }
  | {
      type: "reject_b_muted";
      pointA: number;
      pointB: null;
      toastKey: "timestamps.ab_range";
      toastIcon: "warning";
      haptic: "none";
    }
  | {
      type: "clear";
      pointA: null;
      pointB: null;
      toastKey: "toasts.ab_deactivated";
      toastIcon: "close-outline";
      haptic: "light" | "medium";
    };

export function evaluateABButtonPress(
  pointA: number | null,
  pointB: number | null,
  currentPosition: number,
  config: SkipConfig = EMPTY_SKIP_CONFIG,
): ABTransitionAction {
  if (pointA === null) {
    return {
      type: "set_a",
      pointA: currentPosition,
      pointB: null,
      toastKey: "toasts.ab_point_a_set",
      toastIcon: "flag-outline",
      haptic: "light",
    };
  }
  if (pointB === null) {
    if (currentPosition > pointA) {
      if (!hasAudibleABRange(pointA, currentPosition, config)) {
        return {
          type: "reject_b_muted",
          pointA,
          pointB: null,
          toastKey: "timestamps.ab_range",
          toastIcon: "warning",
          haptic: "none",
        };
      }
      return {
        type: "set_b",
        pointA,
        pointB: currentPosition,
        toastKey: "toasts.ab_point_b_set",
        toastIcon: "repeat",
        haptic: "light",
      };
    }
    return {
      type: "update_a",
      pointA: currentPosition,
      pointB: null,
      toastKey: "toasts.ab_point_a_updated",
      toastIcon: "flag-outline",
      haptic: "light",
    };
  }
  return {
    type: "clear",
    pointA: null,
    pointB: null,
    toastKey: "toasts.ab_deactivated",
    toastIcon: "close-outline",
    haptic: "light",
  };
}

export function shouldTriggerABLoop(
  currentPosition: number,
  pointA: number | null,
  pointB: number | null,
): number | null {
  if (pointA !== null && pointB !== null && pointA < pointB) {
    if (currentPosition >= pointB || currentPosition < pointA - 0.5) {
      return pointA;
    }
  }
  return null;
}

export function parseTimestampInput(value: string): number | null {
  const match = /^(?:(\d+):)?([0-5]?\d)(?:[.,](\d{1,3}))?$/.exec(value.trim());
  if (!match) return null;
  return (
    Number(match[1] || 0) * 60000 +
    Number(match[2]) * 1000 +
    Number((match[3] || "").padEnd(3, "0"))
  );
}

export function formatTimestampInput(milliseconds: number): string {
  const ms = Math.max(0, Math.round(milliseconds));
  return `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
}
