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
    const prevTextRef = useRef(text);

    // Si el texto cambia, reseteamos inmediatamente el ancho medido para evitar desfases
    if (prevTextRef.current !== text) {
        prevTextRef.current = text;
        setTextWidth(0);
    }

    const overflows = containerWidth > 0 && textWidth > containerWidth;

    useEffect(() => {
        let isCancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;

        if (animRef.current) {
            animRef.current.stop();
        }
        translateX.stopAnimation();
        translateX.setValue(0);

        if (!overflows) return;

        // La distancia que debe recorrer es el ancho del texto + la separación entre copias
        const distance = textWidth + spacing;
        const slideDuration = (distance / speed) * 1000;

        const startAnimation = () => {
            if (isCancelled) return;

            translateX.setValue(0);

            timer = setTimeout(() => {
                if (isCancelled) return;

                animRef.current = Animated.timing(translateX, {
                    toValue: -distance,
                    duration: slideDuration,
                    easing: Easing.linear,
                    useNativeDriver: true,
                });

                animRef.current.start(({ finished }) => {
                    if (finished && !isCancelled) {
                        // Al terminar, la segunda copia está en la posición 0.
                        // Reiniciar a 0 es un cambio transparente sin salto visual.
                        startAnimation();
                    }
                });
            }, pauseDuration);
        };

        startAnimation();

        return () => {
            isCancelled = true;
            if (timer) clearTimeout(timer);
            animRef.current?.stop();
            translateX.stopAnimation();
            translateX.setValue(0);
        };
    }, [overflows, textWidth, containerWidth, pauseDuration, speed, spacing, text]);

    return (
        <View
            style={styles.container}
            onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
            collapsable={false}
        >
            {/* Medidor invisible para obtener el ancho real del texto - colocado fuera de pantalla */}
            <View
                style={styles.hiddenMeasurer}
                pointerEvents="none"
            >
                <ScrollView
                    horizontal
                    scrollEnabled={false}
                    showsHorizontalScrollIndicator={false}
                >
                    <Text
                        style={style}
                        onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
                    >
                        {text}
                    </Text>
                </ScrollView>
            </View>

            {/* Texto Visible con ScrollView para garantizar recorte nativo estricto en Android */}
            {overflows ? (
                <ScrollView
                    horizontal
                    scrollEnabled={false}
                    showsHorizontalScrollIndicator={false}
                    bounces={false}
                    scrollsToTop={false}
                    pointerEvents="none"
                    style={StyleSheet.absoluteFill}
                    contentContainerStyle={styles.scrollContent}
                >
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
                </ScrollView>
            ) : null}

            {/* Texto base: da las dimensiones naturales (altura) al contenedor y se muestra cuando no hay overflow */}
            <Text
                style={[style, overflows && styles.hiddenPlaceholder]}
                numberOfLines={1}
            >
                {text}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
        width: '100%',
        justifyContent: 'center',
    },
    scrollContent: {
        alignItems: 'center',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    hiddenPlaceholder: {
        opacity: 0,
    },
    hiddenMeasurer: {
        position: 'absolute',
        top: -9999,
        left: -9999,
        opacity: 0,
    },
});