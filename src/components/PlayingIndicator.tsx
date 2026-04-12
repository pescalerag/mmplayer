import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface PlayingIndicatorProps {
    color?: string;
    isPaused?: boolean;
}

export const PlayingIndicator = ({ color = '#8B5CF6', isPaused = false }: PlayingIndicatorProps) => {
    // 1. Reducimos a 3 barras usando valores de escala (0.3 a 1.0)
    const scale1 = useRef(new Animated.Value(0.3)).current;
    const scale2 = useRef(new Animated.Value(0.3)).current;
    const scale3 = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        if (isPaused) {
            // Si la canción se pausa, las barras bajan suavemente al mínimo
            Animated.parallel([
                Animated.timing(scale1, { toValue: 0.3, duration: 400, useNativeDriver: true }),
                Animated.timing(scale2, { toValue: 0.3, duration: 400, useNativeDriver: true }),
                Animated.timing(scale3, { toValue: 0.3, duration: 400, useNativeDriver: true }),
            ]).start();
            return;
        }

        const animateBar = (anim: Animated.Value, delay: number) => {
            const runAnimation = () => {
                Animated.sequence([
                    Animated.timing(anim, {
                        toValue: 0.6 + Math.random() * 0.4, // Altura máxima sutil
                        duration: 500 + Math.random() * 300, // 4. Velocidad más lenta
                        useNativeDriver: true,
                    }),
                    Animated.timing(anim, {
                        toValue: 0.3 + Math.random() * 0.2,
                        duration: 450 + Math.random() * 250,
                        useNativeDriver: true,
                    }),
                    Animated.timing(anim, {
                        toValue: 0.8 + Math.random() * 0.2,
                        duration: 550 + Math.random() * 350,
                        useNativeDriver: true,
                    }),
                    Animated.timing(anim, {
                        toValue: 0.3,
                        duration: 400 + Math.random() * 200,
                        useNativeDriver: true,
                    }),
                ]).start(({ finished }) => {
                    if (finished && !isPaused) {
                        runAnimation();
                    }
                });
            };

            const timeout = setTimeout(runAnimation, delay);
            return timeout;
        };

        const t1 = animateBar(scale1, 0);
        const t2 = animateBar(scale2, 200);
        const t3 = animateBar(scale3, 400);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            scale1.stopAnimation();
            scale2.stopAnimation();
            scale3.stopAnimation();
        };
    }, [isPaused]);

    // Función auxiliar para renderizar la barra con el anclaje inferior usando scaleY + translateY
    const renderBar = (anim: Animated.Value) => {
        const BAR_HEIGHT = 10;
        return (
            <Animated.View 
                style={[
                    styles.bar, 
                    { 
                        backgroundColor: color,
                        height: BAR_HEIGHT,
                        transform: [
                            { translateY: BAR_HEIGHT / 2 }, // Movemos el centro al fondo
                            { scaleY: anim },              // Escalamos
                            { translateY: -BAR_HEIGHT / 2 } // Devolvemos el centro para que "crezca" hacia arriba
                        ]
                    }
                ]} 
            />
        );
    };

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
        height: 12, // Contenedor estricto para alineación base
        gap: 3,
        paddingBottom: 1, // Ajuste fino para alinear con la base tipográfica
    },
    bar: {
        width: 3,
        borderRadius: 2,
    },
});
