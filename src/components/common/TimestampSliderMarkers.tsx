import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTimestampStore } from '../../store/useTimestampStore';
import { SkipSegment } from '../../utils/trackTimestamps';
import { useAppTheme } from '../../hooks/useAppTheme';

export function TimestampSliderMarkers({ duration, segments: supplied }: Readonly<{ duration: number; segments?: SkipSegment[] }>) {
    const config = useTimestampStore(state => state.config);
    const { colors } = useAppTheme();
    const [width, setWidth] = useState(0);
    const segments = supplied ?? (config.enabled ? config.segments : []);
    if (duration <= 0 || !segments.length) return null;
    const x = (ms: number) => 15 + Math.min(1, Math.max(0, ms / (duration * 1000))) * Math.max(0, width - 30);
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 1 }]} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 && segments.map(segment => <View key={segment.id} style={{ position: 'absolute', left: x(segment.startMs),
            width: Math.max(2, x(segment.endMs) - x(segment.startMs)), top: 15, height: 10,
            borderLeftWidth: 2, borderRightWidth: 2, borderColor: colors.accentLight, backgroundColor: colors.accentAlpha40 }} />)}
    </View>;
}
