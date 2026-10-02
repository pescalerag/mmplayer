import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

interface CrossfadeLinearGradientProps {
    colors: string[];
    style?: any;
    duration?: number;
}

const areColorsEqual = (a?: string[] | null, b?: string[] | null) => {
    if (!a || !b) return a === b;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
};

const DEFAULT_COLORS = ['#1a1a1a', '#000000'];

const CrossfadeLinearGradient = memo(({
    colors,
    style,
    duration = 250,
}: CrossfadeLinearGradientProps) => {
    const validColors = useMemo(() => {
        return colors && colors.length >= 2 ? colors : DEFAULT_COLORS;
    }, [colors]);

    const [prevColors, setPrevColors] = useState<string[] | null>(null);
    const [currentColors, setCurrentColors] = useState<string[]>(validColors);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const opacity = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const onFinish = useCallback(() => {
        setIsTransitioning(false);
        setPrevColors(null);
    }, []);

    const prevPropsColorsRef = useRef<string[]>(validColors);

    useEffect(() => {
        if (areColorsEqual(validColors, prevPropsColorsRef.current)) {
            return;
        }

        const oldColors = prevPropsColorsRef.current;
        prevPropsColorsRef.current = validColors;

        setPrevColors(oldColors);
        setCurrentColors(validColors);
        setIsTransitioning(true);

        opacity.value = 0;
        opacity.value = withTiming(1, {
            duration,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1.0),
        }, (finished) => {
            if (finished) {
                scheduleOnRN(onFinish);
            }
        });
    }, [validColors, duration, onFinish, opacity]);

    if (!isTransitioning || !prevColors) {
        return (
            <LinearGradient
                colors={currentColors as any}
                style={style}
            />
        );
    }

    return (
        <View style={style}>
            <LinearGradient
                colors={prevColors as any}
                style={StyleSheet.absoluteFill}
            />
            <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
                <LinearGradient
                    colors={currentColors as any}
                    style={StyleSheet.absoluteFill}
                />
            </Animated.View>
        </View>
    );
});
CrossfadeLinearGradient.displayName = 'CrossfadeLinearGradient';

interface Props {
    imageUrl?: string | null;
    blurIntensity?: number;
    gradientColors?: string[];
    placeholderColors?: string[];
    showImage?: boolean;
}

const BlurredBackground = ({
    imageUrl,
    blurIntensity = 80,
    gradientColors = ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)', '#000000'],
    placeholderColors,
    showImage = true,
}: Props) => {
    const [hasError, setHasError] = React.useState(false);

    const effectivePlaceholderColors = placeholderColors || (
        gradientColors && gradientColors.length >= 2 ? gradientColors : ['#1a1a1a', '#000000']
    );

    React.useEffect(() => {
        setHasError(false);
    }, [imageUrl]);

    const lastValidUriRef = React.useRef<string | null>(imageUrl || null);
    if (imageUrl) {
        lastValidUriRef.current = imageUrl;
    }
    const effectiveUri = imageUrl || lastValidUriRef.current;
    const showPlaceholder = !showImage || !effectiveUri || hasError;

    const imageSource = React.useMemo(() =>
        showImage && effectiveUri ? { uri: effectiveUri } : null
        , [showImage, effectiveUri]);

    return (
        <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
            {showPlaceholder ? (
                <CrossfadeLinearGradient
                    colors={effectivePlaceholderColors}
                    style={StyleSheet.absoluteFill}
                />
            ) : (
                <>
                    <Image
                        source={imageSource}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        transition={200}
                        cachePolicy="memory-disk"
                        onError={() => setHasError(true)}
                    />
                    <BlurView
                        intensity={blurIntensity}
                        tint="dark"
                        style={StyleSheet.absoluteFill}
                    />
                    <CrossfadeLinearGradient
                        colors={gradientColors}
                        style={StyleSheet.absoluteFill}
                    />
                </>
            )}
        </View>
    );
};

export default BlurredBackground;
