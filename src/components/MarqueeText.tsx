import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    ScrollView,
    StyleProp,
    StyleSheet,
    Text,
    TextStyle,
    View,
} from 'react-native';

interface MarqueeTextProps {
    text: string;
    style?: StyleProp<TextStyle>;
    /** Milisegundos de pausa al inicio y al final antes de reiniciar (default 1500) */
    pauseDuration?: number;
    /** Velocidad en px/segundo (default 40) */
    speed?: number;
    /** Espacio extra entre el final del texto y el reinicio (default 60) */
    spacing?: number;
}

export default function MarqueeText({
    text,
    style,
    pauseDuration = 1500,
    speed = 40,
    spacing = 60,
}: MarqueeTextProps) {
    const containerWidth = useRef(0);
    const textWidth = useRef(0);
    const [overflows, setOverflows] = useState(false);
    const [measuredTextWidth, setMeasuredTextWidth] = useState(0);
    const translateX = useRef(new Animated.Value(0)).current;
    const animRef = useRef<Animated.CompositeAnimation | null>(null);

    // Pequeño margen para evitar falsos positivos por decimales
    const THRESHOLD = 2;

    const evaluate = useCallback(() => {
        if (containerWidth.current <= 0 || textWidth.current <= 0) return;
        setOverflows(textWidth.current > containerWidth.current + THRESHOLD);
    }, []);

    const startLoop = useCallback(() => {
        const distance = textWidth.current - containerWidth.current + spacing;
        if (distance <= 0) return;

        const slideDuration = (distance / speed) * 1000;

        animRef.current = Animated.sequence([
            Animated.delay(pauseDuration),
            Animated.timing(translateX, {
                toValue: -distance,
                duration: slideDuration,
                useNativeDriver: true,
            }),
            Animated.delay(pauseDuration),
        ]);

        animRef.current.start(({ finished }) => {
            if (finished) {
                translateX.setValue(0);
                startLoop();
            }
        });
    }, [pauseDuration, speed, spacing, translateX]);

    // Arranca/para el bucle cuando cambia el estado de desbordamiento
    useEffect(() => {
        animRef.current?.stop();
        translateX.setValue(0);
        if (overflows) startLoop();
        return () => { animRef.current?.stop(); };
    }, [overflows, startLoop]);

    // Resetea completamente cuando cambia el texto
    useEffect(() => {
        animRef.current?.stop();
        translateX.setValue(0);
        textWidth.current = 0;
        setOverflows(false);
    }, [text]);

    return (
        <View
            style={styles.container}
            onLayout={(e) => {
                containerWidth.current = e.nativeEvent.layout.width;
                evaluate();
            }}
        >
            {/*
             * Medidor invisible dentro de un ScrollView horizontal.
             * Un ScrollView horizontal NO limita el ancho de sus hijos,
             * por lo que el Text reporta su ancho real de contenido
             * via onLayout — independientemente del ancho del contenedor.
             */}
            <ScrollView
                horizontal
                scrollEnabled={false}
                pointerEvents="none"
                style={StyleSheet.absoluteFill}
                contentContainerStyle={styles.measurer}
            >
                <Text
                    style={style}
                    numberOfLines={1}
                    onLayout={(e) => {
                        const w = e.nativeEvent.layout.width;
                        textWidth.current = w;
                        setMeasuredTextWidth(w);
                        evaluate();
                    }}
                >
                    {text}
                </Text>
            </ScrollView>

            {/* Texto visible — se anima solo si desborda */}
            <Animated.Text
                style={[
                    style,
                    // Anchura explícita = ancho real del texto:
                    // el Text cabe en su propia anchura → numberOfLines={1}
                    // no trunca con "..." porque no desborda su propio width.
                    // El contenedor overflow:hidden hace el clip visual.
                    overflows && measuredTextWidth > 0
                        ? { width: measuredTextWidth, transform: [{ translateX }] }
                        : undefined,
                ]}
                numberOfLines={1}
            >
                {text}
            </Animated.Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
        width: '100%',
    },
    measurer: {
        opacity: 0,
    },
});
