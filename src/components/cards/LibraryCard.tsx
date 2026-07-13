import { useAppTheme } from "@/hooks/useAppTheme";
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import React, { useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface LibraryCardProps {
    readonly title: string;
    readonly subtitle?: string;
    readonly duration?: string;
    readonly imageUrl?: string | null;
    readonly placeholderIcon: keyof typeof Ionicons.glyphMap;
    readonly onPress?: () => void;
    readonly onLongPress?: () => void;
    readonly isPinned?: boolean;
    readonly smartListId?: string;
}

const { width } = Dimensions.get('window');
// Padding horizontal es 20x2 = 40. Gaps de 15x2 = 30. Total restante: width - 70.
// Dividido entre 3 queda aprox 30-32% del ancho.
const cardWidth = (width - 70) / 3;

export default function LibraryCard({ title, subtitle, duration, imageUrl, placeholderIcon, onPress, onLongPress, isPinned, smartListId }: Readonly<LibraryCardProps>) {
    const { colors, fonts, layout } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
    const [imageError, setImageError] = useState(false);

    // Reiniciar error cuando cambie la URL de la imagen
    React.useEffect(() => {
        setImageError(false);
    }, [imageUrl]);

    const showImage = !!imageUrl && !imageError;

    const gradientColors = React.useMemo(() => {
        if (!smartListId) return ['#1A1A1A', '#0D0D0D'] as const;
        if (smartListId.includes('week')) {
            return ['#3B82F6', '#1D4ED8'] as const; // Blue
        }
        if (smartListId.includes('month')) {
            return ['#10B981', '#047857'] as const; // Green
        }
        if (smartListId.includes('rating')) {
            return ['#EC4899', '#BE185D'] as const; // Pink
        }
        if (smartListId === 'top_50') {
            return ['#8B5CF6', '#6D28D9'] as const; // Violet
        }
        return ['#F59E0B', '#D97706'] as const; // Gold default
    }, [smartListId]);

    return (
        <Pressable
            style={({ pressed }) => [styles.card, { opacity: pressed ? 0.7 : 1 }]}
            onPress={onPress}
            onLongPress={onLongPress}
        >
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
                ) : smartListId ? (
                    <LinearGradient
                        colors={gradientColors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.placeholder}
                    >
                        <Ionicons name={placeholderIcon} size={32} color={colors.text} />
                    </LinearGradient>
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
        </Pressable>
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
