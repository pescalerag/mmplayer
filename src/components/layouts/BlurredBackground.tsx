import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
    imageUrl?: string | null;
    blurIntensity?: number;
    gradientColors?: string[];
    placeholderColors?: string[];
}

const BlurredBackground = ({
    imageUrl,
    blurIntensity = 80,
    gradientColors = ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)', '#000000'],
    placeholderColors = ['#1a1a1a', '#000000']
}: Props) => {
    const [hasError, setHasError] = React.useState(false);

    React.useEffect(() => {
        setHasError(false);
    }, [imageUrl]);

    const lastValidUriRef = React.useRef<string | null>(imageUrl || null);
    if (imageUrl) {
        lastValidUriRef.current = imageUrl;
    }
    const effectiveUri = imageUrl || lastValidUriRef.current;
    const showPlaceholder = !effectiveUri || hasError;

    const imageSource = React.useMemo(() =>
        effectiveUri ? { uri: effectiveUri } : null
        , [effectiveUri]);

    return (
        <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
            {showPlaceholder ? (
                <LinearGradient colors={placeholderColors as any} style={StyleSheet.absoluteFill} />
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
                    <LinearGradient
                        colors={gradientColors as any}
                        style={StyleSheet.absoluteFill}
                    />
                </>
            )}
        </View>
    );
};

export default BlurredBackground;
