import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    ScrollView,
    StyleProp,
    StyleSheet,
    Text,
    TextStyle,
    View,
} from 'react-native';

interface MarqueeTextProps {
    readonly text: string;
    readonly style?: StyleProp<TextStyle>;
    readonly pauseDuration?: number;
    readonly speed?: number;
    readonly spacing?: number;
}

export default function MarqueeText({
    text,
    style,
    pauseDuration = 1500,
    speed = 40,
    spacing = 60,
}: Readonly<MarqueeTextProps>) {
    const [containerWidth, setContainerWidth] = useState(0);
    const [textWidth, setTextWidth] = useState(0);

    const translateX = useRef(new Animated.Value(0)).current;
    const animRef = useRef<Animated.CompositeAnimation | null>(null);

    const overflows = containerWidth > 0 && textWidth > containerWidth;

    useEffect(() => {
        animRef.current?.stop();
        translateX.setValue(0);

        if (!overflows) return;

        // La distancia que debe recorrer es el ancho del texto + la separación entre copias
        const distance = textWidth + spacing;
        const slideDuration = (distance / speed) * 1000;

        const runAnimation = () => {
            translateX.setValue(0);

            animRef.current = Animated.sequence([
                // 1. Pausa inicial en la posición base
                Animated.delay(pauseDuration),
                // 2. Deslizamiento constante hacia la izquierda
                Animated.timing(translateX, {
                    toValue: -distance,
                    duration: slideDuration,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
            ]);

            animRef.current.start(({ finished }) => {
                if (finished) {
                    // Al terminar, la segunda copia está en la posición 0.
                    // Reiniciar a 0 es un cambio transparente sin salto visual.
                    runAnimation();
                }
            });
        };

        runAnimation();

        return () => {
            animRef.current?.stop();
        };
    }, [overflows, textWidth, containerWidth, pauseDuration, speed, spacing, translateX, text]);

    return (
        <View
            style={styles.container}
            onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        >
            {/* Medidor invisible para obtener el ancho real del texto */}
            <ScrollView
                horizontal
                scrollEnabled={false}
                pointerEvents="none"
                showsHorizontalScrollIndicator={false}
                style={StyleSheet.absoluteFill}
                contentContainerStyle={{ opacity: 0 }}
                keyboardShouldPersistTaps="handled"
            >
                <Text
                    style={style}
                    onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
                >
                    {text}
                </Text>
            </ScrollView>

            {/* Texto Visible */}
            {overflows ? (
                <Animated.View
                    style={[
                        styles.row,
                        { transform: [{ translateX }] },
                    ]}
                >
                    <Text style={[style, { width: textWidth }]} numberOfLines={1}>
                        {text}
                    </Text>
                    <View style={{ width: spacing }} />
                    <Text style={[style, { width: textWidth }]} numberOfLines={1}>
                        {text}
                    </Text>
                </Animated.View>
            ) : (
                <Text style={style} numberOfLines={1}>
                    {text}
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
        width: '100%',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});