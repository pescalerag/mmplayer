import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { 
    useSharedValue, 
    useAnimatedStyle, 
    withRepeat, 
    withTiming, 
    withSequence,
    withDelay,
    Easing 
} from 'react-native-reanimated';

interface BarProps {
    delay: number;
    isPlaying: boolean;
    minHeight: number;
    maxHeight: number;
}

const Bar = ({ delay, isPlaying, minHeight, maxHeight }: BarProps) => {
    const height = useSharedValue(minHeight);

    useEffect(() => {
        if (isPlaying) {
            height.value = withDelay(
                delay,
                withRepeat(
                    withSequence(
                        withTiming(maxHeight, { duration: 400 + Math.random() * 200, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
                        withTiming(minHeight + (maxHeight - minHeight) * 0.3, { duration: 300 + Math.random() * 200, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
                        withTiming(maxHeight * 0.8, { duration: 500 + Math.random() * 200, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
                        withTiming(minHeight, { duration: 350 + Math.random() * 200, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
                    ),
                    -1,
                    true
                )
            );
        } else {
            // Cuando está en pausa, volvemos a la altura mínima suavemente o mantenemos una posición estática baja
            height.value = withTiming(minHeight + 2, { duration: 500 });
        }
    }, [isPlaying, minHeight, maxHeight, delay]);

    const animatedStyle = useAnimatedStyle(() => ({
        height: height.value,
    }));

    return <Animated.View style={[styles.bar, animatedStyle]} />;
};

export const PlayingIndicator = ({ isPlaying = true }: { isPlaying?: boolean }) => {
    return (
        <View style={styles.container}>
            <Bar delay={0} isPlaying={isPlaying} minHeight={3} maxHeight={14} />
            <Bar delay={150} isPlaying={isPlaying} minHeight={5} maxHeight={16} />
            <Bar delay={300} isPlaying={isPlaying} minHeight={2} maxHeight={12} />
            <Bar delay={450} isPlaying={isPlaying} minHeight={4} maxHeight={15} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        width: 18,
        height: 18,
        marginLeft: 8,
    },
    bar: {
        width: 3,
        backgroundColor: '#A78BFA', // Violet-400 (Coincide con el active color de la cola)
        borderRadius: 2,
    },
});
