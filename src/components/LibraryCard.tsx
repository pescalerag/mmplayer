import { useAppTheme } from "@/hooks/useAppTheme";
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import React, { useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface LibraryCardProps {
    readonly title: string;
    readonly subtitle?: string;
    readonly duration?: string;
    readonly imageUrl?: string | null;
    readonly placeholderIcon: keyof typeof Ionicons.glyphMap;
    readonly onPress?: () => void;
    readonly onLongPress?: () => void;
    readonly isPinned?: boolean;
}

const { width } = Dimensions.get('window');
// Padding horizontal es 20x2 = 40. Gaps de 15x2 = 30. Total restante: width - 70.
// Dividido entre 3 queda aprox 30-32% del ancho.
const cardWidth = (width - 70) / 3;

export default function LibraryCard({ title, subtitle, duration, imageUrl, placeholderIcon, onPress, onLongPress, isPinned }: Readonly<LibraryCardProps>) {
    const { colors, fonts, layout } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
    const [imageError, setImageError] = useState(false);

    // Reiniciar error cuando cambie la URL de la imagen
    React.useEffect(() => {
        setImageError(false);
    }, [imageUrl]);

    const showImage = !!imageUrl && !imageError;

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.7}>
            <View style={styles.imageContainer}>
                {showImage ? (
                    <ExpoImage
                        source={{ uri: imageUrl || '' }}
                        style={styles.image}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        onError={() => {
                            setImageError(true);
                        }}
                    />
                ) : (
                    <View style={styles.placeholder}>
                        <Ionicons name={placeholderIcon} size={28} color={colors.textSecondary} />
                    </View>
                )}
            </View>
            <View style={styles.titleContainer}>
                {isPinned && (
                    <Ionicons name="pin" size={13} color={colors.accent} style={styles.pinIconInline} />
                )}
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
            </View>
            {subtitle && (
                <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
            )}
            {duration && (
                <Text style={styles.subtitle} numberOfLines={1}>{duration}</Text>
            )}
        </TouchableOpacity>
    );
}

const getStyles = (colors: any, fonts: any, layout: any) => StyleSheet.create({
    card: {
        width: cardWidth,
        marginBottom: 20,
    },
    imageContainer: {
        width: cardWidth,
        height: cardWidth,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: colors.cardBackground,
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
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        paddingHorizontal: 4,
    },
    pinIconInline: {
        marginRight: 2,
    },
    title: {
        color: colors.text,
        fontSize: 13,
        fontFamily: fonts.regular,
        fontWeight: '700',
        textAlign: 'center',
        flexShrink: 1,
    },
    subtitle: {
        color: colors.textSecondary,
        fontSize: 11,
        fontFamily: fonts.regular,
        fontWeight: '700',
        textAlign: 'center',
        marginTop: 2,
    },
});
