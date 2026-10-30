import React, { useCallback, useEffect, useRef } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

// Key this boundary by artwork style and image URI, never by playback progress.
export function ArtworkFadeIn({ size, hasImage, children }: Readonly<{
    size: number;
    hasImage: boolean;
    children: (onReady: () => void) => React.ReactNode;
}>) {
    const opacity = useSharedValue(0);
    const revealed = useRef(false);
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);
    const onReady = useCallback(() => {
        if (!mounted.current || revealed.current) return;
        revealed.current = true;
        opacity.value = withTiming(1, { duration: 220 });
    }, [opacity]);
    const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
    return (
        <Animated.View style={[{ width: size, height: size }, style]}
            onLayout={hasImage ? undefined : onReady}>
            {children(onReady)}
        </Animated.View>
    );
}
