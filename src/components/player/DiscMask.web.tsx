import React from 'react';
import { StyleSheet, View } from 'react-native';

/** A CSS alpha mask keeps both the outer circle and spindle hole transparent. */
export function DiscMask({ size, holeSize, children }: React.PropsWithChildren<{ size: number; holeSize: number }>) {
    const hole = Math.max(0, holeSize / 2), radius = Math.max(hole + 1, size / 2);
    const mask = `radial-gradient(circle at center, transparent ${hole}px, #000 ${hole + 0.5}px, #000 ${radius - 0.5}px, transparent ${radius}px)`;
    return <View testID="player-disc-mask" style={[StyleSheet.absoluteFillObject, {
        maskImage: mask, WebkitMaskImage: mask,
    } as any]}>{children}</View>;
}
