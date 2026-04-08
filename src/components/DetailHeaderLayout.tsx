import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo } from 'react';
import {
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width } = Dimensions.get('window');
const HEADER_HEIGHT = 380;

interface DetailHeaderLayoutProps {
    title: string;
    imageUrl?: string | null;
    placeholderIcon: keyof typeof Ionicons.glyphMap;
    subtitle?: React.ReactNode;
    metaInfo?: string;
    onBack: () => void;
    onHome: () => void;
    renderExtra?: () => React.ReactNode;
}

const DetailHeaderLayout = ({
    title,
    imageUrl,
    placeholderIcon,
    subtitle,
    metaInfo,
    onBack,
    onHome,
    renderExtra,
}: DetailHeaderLayoutProps) => {
    return (
        <View style={styles.headerContainer}>
            {imageUrl ? (
                <Image
                    source={{ uri: imageUrl }}
                    style={styles.headerImage}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                />
            ) : (
                <View style={[styles.headerImage, styles.headerPlaceholder]}>
                    <Ionicons name={placeholderIcon} size={80} color="#535353" />
                </View>
            )}

            {/* Gradient overlay */}
            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.8)', '#121212'] as any}
                style={styles.gradient}
            />

            {/* Botón atrás */}
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
                <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Botón Volver a la Biblioteca / Home */}
            <TouchableOpacity
                style={[styles.backButton, { left: undefined, right: 16 }]}
                onPress={onHome}
            >
                <Ionicons name="home" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Info */}
            <View style={styles.headerInfo}>
                <Text style={styles.title} numberOfLines={2}>{title}</Text>
                
                {subtitle && (
                    <View style={styles.subtitleContainer}>
                        {typeof subtitle === 'string' ? (
                            <Text style={styles.subtitleText}>{subtitle}</Text>
                        ) : (
                            subtitle
                        )}
                    </View>
                )}
                
                {metaInfo && (
                    <Text style={styles.metaInfo}>{metaInfo}</Text>
                )}
            </View>

            {/* Render Extra (FAB, Photo button, etc.) */}
            {renderExtra?.()}
        </View>
    );
};

export default memo(DetailHeaderLayout);

const styles = StyleSheet.create({
    headerContainer: {
        width,
        height: HEADER_HEIGHT,
        position: 'relative',
    },
    headerImage: {
        width,
        height: HEADER_HEIGHT,
    },
    headerPlaceholder: {
        backgroundColor: '#282828',
        justifyContent: 'center',
        alignItems: 'center',
    },
    gradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: HEADER_HEIGHT * 0.75,
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 16,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    headerInfo: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 28,
        fontFamily: 'Montserrat',
        fontWeight: 'bold',
        marginBottom: 4,
    },
    subtitleContainer: {
        marginBottom: 4,
    },
    subtitleText: {
        color: '#8B5CF6',
        fontSize: 16,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    metaInfo: {
        color: '#CCCCCC',
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '600',
    },
});
