export function normalizeCrossfadeSeconds(seconds: number): number {
    return Number.isFinite(seconds) ? Math.max(0, Math.min(12, Math.round(seconds))) : 0;
}

export interface CrossfadePolicyInput {
    seconds: number;
    casting: boolean;
    switchingQueue: boolean;
    restoring: boolean;
    syncingLyrics: boolean;
    hasABPoint: boolean;
    blocked: boolean;
}

export function getCrossfadePolicy(input: CrossfadePolicyInput) {
    return {
        seconds: normalizeCrossfadeSeconds(input.seconds),
        allowed: !input.casting && !input.switchingQueue && !input.restoring &&
            !input.syncingLyrics && !input.hasABPoint && !input.blocked,
    };
}
