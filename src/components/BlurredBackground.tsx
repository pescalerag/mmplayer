import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

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

    const showPlaceholder = !imageUrl || hasError;

    return (
        <View style={StyleSheet.absoluteFill}>
            {showPlaceholder ? (
                <LinearGradient colors={placeholderColors as any} style={StyleSheet.absoluteFill} />
            ) : (
                <>
                    <Image
                        key={imageUrl ?? 'none'}
                        source={{ uri: imageUrl || '' }}
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
