import React, { useEffect, useRef, useState } from 'react';
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

    // ¡CLAVE 1! Ya NO reseteamos textWidth a 0 al cambiar de texto.
    // Si el texto nuevo mide lo mismo, mantenemos la medida anterior.
    useEffect(() => {
        animRef.current?.stop();
        translateX.setValue(0);
    }, [text, translateX]);

    const overflows = containerWidth > 0 && textWidth >= containerWidth - 1;

    useEffect(() => {
        animRef.current?.stop();
        translateX.setValue(0);

        if (!overflows) return;

        const distance = textWidth - containerWidth + spacing;
        if (distance <= 0) return;

        const slideDuration = (distance / speed) * 1000;

        const runAnimation = () => {
            translateX.setValue(0);

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
                    runAnimation();
                }
            });
        };

        runAnimation();

        return () => {
            animRef.current?.stop();
        };
    }, [overflows, textWidth, containerWidth, pauseDuration, speed, spacing, translateX]);

    return (
        <View
            style={styles.container}
            onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        >
            {/* Medidor invisible: Sin numberOfLines para que calcule el ancho 100% real */}
            <ScrollView
                horizontal
                scrollEnabled={false}
                pointerEvents="none"
                showsHorizontalScrollIndicator={false}
                style={StyleSheet.absoluteFill}
                contentContainerStyle={{ opacity: 0 }}
            >
                <Text
                    style={style}
                    onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
                >
                    {text}
                </Text>
            </ScrollView>

            {/* Texto Visible */}
            <Animated.Text
                numberOfLines={1}
                style={[
                    style,
                    // ¡CLAVE 2! Si desborda, le damos 20px extra para que nunca salgan los "..."
                    // Al quitar el isMeasuring, ya nunca se quedará invisible.
                    overflows ? { width: textWidth + 20, transform: [{ translateX }] } : undefined,
                ]}
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
    }
});
