// Both receiving devices execute skips locally against their own media clock.
export const timestampReceiverSource = String.raw`function createTimestampSkipper(io) {
    var config = { enabled: true, segments: [] }, token = '', bypass = null, timer = null, signature = '', pendingUntil = 0;
    function containing(position) {
        return config.segments.find(function(segment) { return position >= segment.startMs && position < segment.endMs; });
    }
    function tick() {
        if (!config.enabled || !io.playing() || Date.now() < pendingUntil) return;
        var position = io.position() * 1000, duration = io.duration() * 1000;
        if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0) return;
        if (bypass && (position < bypass.startMs || position >= bypass.endMs)) bypass = null;
        var segment = containing(position);
        if (segment && segment !== bypass && segment.endMs <= duration) { pendingUntil = Date.now() + 500; io.seek(segment.endMs / 1000); }
    }
    return {
        update: function(next, nextToken) {
            if (nextToken !== token) { bypass = null; pendingUntil = 0; token = nextToken; }
            var key = JSON.stringify(next || null);
            if (key === signature) return;
            signature = key;
            config = next && Array.isArray(next.segments) ? next : { enabled: true, segments: [] };
            if (bypass) bypass = config.segments.find(function(segment) { return segment.id === bypass.id && segment.startMs === bypass.startMs && segment.endMs === bypass.endMs; }) || null;
            if (timer) { clearInterval(timer); timer = null; }
            if (config.enabled && config.segments.length) timer = setInterval(tick, 50);
        },
        manualSeek: function(position) { pendingUntil = 0; bypass = containing(position * 1000) || null; },
        automaticSeek: function() { pendingUntil = 0; bypass = null; },
        tick: tick,
        stop: function() { if (timer) clearInterval(timer); timer = null; bypass = null; signature = ''; config = { enabled: false, segments: [] }; }
    };
}`;
