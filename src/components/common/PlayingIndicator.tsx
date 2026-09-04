import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useAppTheme } from '@/hooks/useAppTheme';

interface PlayingIndicatorProps {
    color?: string;
    isPaused?: boolean;
}

const BAR_HEIGHT = 10;

const makeBarSequence = (anim: Animated.Value): Animated.CompositeAnimation =>
    Animated.sequence([
        Animated.timing(anim, {
            toValue: 0.6 + Math.random() * 0.4, // Altura máxima sutil
            duration: 500 + Math.random() * 300, // Velocidad más lenta
            useNativeDriver: true,
        }),
        Animated.timing(anim, {
            toValue: 0.3,
            duration: 400 + Math.random() * 200,
            useNativeDriver: true,
        }),
    ]);

const loopBar = (anim: Animated.Value, pausedRef: React.RefObject<boolean>) => {
    const onFinish = ({ finished }: { finished: boolean }) => {
        if (finished && !pausedRef.current) {
            makeBarSequence(anim).start(onFinish);
        }
    };
    makeBarSequence(anim).start(onFinish);
};

export const PlayingIndicator = ({ color, isPaused = false }: PlayingIndicatorProps) => {
    const { colors } = useAppTheme();
    const activeColor = color || colors.accentLight || colors.accent;
    const scale1 = useRef(new Animated.Value(0.3)).current;
    const scale2 = useRef(new Animated.Value(0.3)).current;
    const scale3 = useRef(new Animated.Value(0.3)).current;
    const isPausedRef = useRef(isPaused);

    useEffect(() => {
        isPausedRef.current = isPaused;

        if (isPaused) {
            Animated.parallel([
                Animated.timing(scale1, { toValue: 0.3, duration: 400, useNativeDriver: true }),
                Animated.timing(scale2, { toValue: 0.3, duration: 400, useNativeDriver: true }),
                Animated.timing(scale3, { toValue: 0.3, duration: 400, useNativeDriver: true }),
            ]).start();
            return;
        }

        const t1 = setTimeout(() => loopBar(scale1, isPausedRef), 0);
        const t2 = setTimeout(() => loopBar(scale2, isPausedRef), 200);
        const t3 = setTimeout(() => loopBar(scale3, isPausedRef), 400);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            scale1.stopAnimation();
            scale2.stopAnimation();
            scale3.stopAnimation();
        };
    }, [isPaused, scale1, scale2, scale3]);

    const renderBar = (anim: Animated.Value) => (
        <Animated.View
            style={[
                styles.bar,
                {
                    backgroundColor: activeColor,
                    height: BAR_HEIGHT,
                    transform: [
                        { translateY: BAR_HEIGHT / 2 },
                        { scaleY: anim },
                        { translateY: -BAR_HEIGHT / 2 },
                    ],
                },
            ]}
        />
    );

    return (
        <View style={styles.container}>
            {renderBar(scale1)}
            {renderBar(scale2)}
            {renderBar(scale3)}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        height: 12,
        gap: 3,
        paddingBottom: 1,
    },
    bar: {
        width: 3,
        borderRadius: 2,
    },
});
