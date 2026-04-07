import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Image as ExpoImage } from 'expo-image';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface LibraryCardProps {
    title: string;
    subtitle?: string;
    duration?: string;
    imageUrl?: string | null;
    placeholderIcon: keyof typeof Ionicons.glyphMap;
    onPress?: () => void;
}

const { width } = Dimensions.get('window');
// Padding horizontal es 20x2 = 40. Gaps de 15x2 = 30. Total restante: width - 70.
// Dividido entre 3 queda aprox 30-32% del ancho.
const cardWidth = (width - 70) / 3;

export default function LibraryCard({ title, subtitle, duration, imageUrl, placeholderIcon, onPress }: LibraryCardProps) {
    const [imageError, setImageError] = useState(false);

    // Reiniciar error cuando cambie la URL de la imagen
    React.useEffect(() => {
        setImageError(false);
    }, [imageUrl]);

    const showImage = !!imageUrl && !imageError;

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.imageContainer}>
                {showImage ? (
                    <ExpoImage
                        source={{ uri: imageUrl! }}
                        style={styles.image}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        onError={() => {
                            console.log('LibraryCard: Error cargando imagen:', imageUrl);
                            setImageError(true);
                        }}
                    />
                ) : (
                    <View style={styles.placeholder}>
                        <Ionicons name={placeholderIcon} size={28} color="#b3b3b3" />
                    </View>
                )}
            </View>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {subtitle && (
                <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
            )}
            {duration && (
                <Text style={styles.subtitle} numberOfLines={1}>{duration}</Text>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        width: cardWidth,
        marginBottom: 20,
    },
    imageContainer: {
        width: cardWidth,
        height: cardWidth,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#282828',
        marginBottom: 8,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    placeholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        color: '#FFFFFF',
        fontSize: 13,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        textAlign: 'center',
    },
    subtitle: {
        color: '#CCCCCC',
        fontSize: 11,
        fontFamily: 'Montserrat',
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 2,
    },
});
