import React, { memo, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import TrackPlayer, { useProgress } from 'react-native-track-player';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useCastStore } from '../../store/useCastStore';
import { useAppTheme } from '../../hooks/useAppTheme';
import { SkipSegment } from '../../utils/trackTimestamps';
import { formatTrackTime } from '../../utils/time';
import { TimestampSliderMarkers } from '../common/TimestampSliderMarkers';

interface Props {
    trackId: string;
    duration: number;
    segments: SkipSegment[];
    disabled: boolean;
    onSeek: (position: number) => Promise<void>;
    onPosition: (position: number) => void;
    previewEnd: number | null;
    previewStarted: React.RefObject<number>;
    onPreviewEnd: () => void;
}

// Only this small subtree subscribes to the playback clock, keeping the form idle.
export const TimestampPlaybackTimeline = memo(function TimestampPlaybackTimeline({ trackId, duration, segments, disabled,
    onSeek, onPosition, previewEnd, previewStarted, onPreviewEnd }: Readonly<Props>) {
    const { colors, fonts } = useAppTheme({ ignoreTheme: true });
    const { position } = useProgress(200);
    const activeId = usePlayerStore(state => state.activeTrack?.id);
    const castPosition = useCastStore(state => state.castPosition);
    const casting = useCastStore(state => state.isLocalCastActive);
    const current = activeId === trackId ? (casting ? castPosition : position) : 0;
    const [scrubPosition, setScrubPosition] = useState<number | null>(null);
    const dragging = useRef(false);
    const seekPending = useRef(false);
    const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => { onPosition(current); }, [current, onPosition]);
    useEffect(() => () => { if (releaseTimer.current) clearTimeout(releaseTimer.current); }, []);
    useEffect(() => {
        if (seekPending.current || dragging.current || scrubPosition === null || Math.abs(current - scrubPosition) > 0.5) return;
        setScrubPosition(null);
        if (releaseTimer.current) clearTimeout(releaseTimer.current);
    }, [current, scrubPosition]);
    useEffect(() => {
        if (previewEnd === null || Date.now() - previewStarted.current < 400) return;
        if (activeId !== trackId || current >= previewEnd) {
            onPreviewEnd();
            if (activeId === trackId) void (TrackPlayer.pause as (bypassFade?: boolean) => Promise<void>)(true).catch(console.error);
        }
    }, [current, previewEnd, activeId, trackId, previewStarted, onPreviewEnd]);

    const finishScrubbing = async (value: number) => {
        dragging.current = false;
        seekPending.current = true;
        setScrubPosition(value);
        try { await onSeek(value); }
        finally {
            seekPending.current = false;
            // Keep the target visible until the media clock acknowledges it (or times out).
            releaseTimer.current = setTimeout(() => setScrubPosition(null), 1500);
        }
    };
    const value = scrubPosition ?? current;
    const label = { color: colors.text, fontFamily: fonts.regular };
    return <View>
        <View style={{ height: 40 }}>
            <TimestampSliderMarkers duration={duration} segments={segments} />
            <Slider style={{ height: 40 }} value={value} minimumValue={0} maximumValue={duration || 1} disabled={disabled}
                minimumTrackTintColor={colors.accent} thumbTintColor={colors.text}
                onSlidingStart={() => {
                    if (releaseTimer.current) clearTimeout(releaseTimer.current);
                    dragging.current = true; setScrubPosition(current);
                }}
                onValueChange={setScrubPosition} onSlidingComplete={value => void finishScrubbing(value)} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={label}>{formatTrackTime(value)}</Text><Text style={label}>{formatTrackTime(duration)}</Text>
        </View>
    </View>;
});
