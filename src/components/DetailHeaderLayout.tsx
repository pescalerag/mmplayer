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
import MarqueeText from './MarqueeText';

const { width } = Dimensions.get('window');
const HEADER_HEIGHT = 380;

interface DetailHeaderLayoutProps {
    title: string;
    imageUrl?: string | null;
    placeholderIcon: keyof typeof Ionicons.glyphMap;
    subtitle?: React.ReactNode;
    metaInfo?: string;
    onBack: () => void;
    onHome?: () => void;
    onDelete?: () => void;
    onEdit?: () => void;
    onPickPhoto?: () => void;
    renderExtra?: () => React.ReactNode;
    renderHeaderPrefix?: () => React.ReactNode;
    isFavorites?: boolean;
    renderCover?: () => React.ReactNode;
}

const DetailHeaderLayout = ({
    title,
    imageUrl,
    placeholderIcon,
    subtitle,
    metaInfo,
    onBack,
    onHome,
    onDelete,
    onEdit,
    onPickPhoto,
    renderExtra,
    renderHeaderPrefix,
    isFavorites = false,
    renderCover,
}: DetailHeaderLayoutProps) => {
    return (
        <View style={styles.headerContainer}>
            {renderCover ? (
                renderCover()
            ) : isFavorites ? (
                <LinearGradient
                    colors={['#7C3AED', '#4C1D95']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.headerImage, styles.headerPlaceholder]}
                >
                    <Ionicons name="heart" size={100} color="#FFFFFF" />
                </LinearGradient>
            ) : imageUrl ? (
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

            {/* Botones de Acción Derechos */}
            <View style={styles.actionButtonsContainer}>
                {onPickPhoto && (
                    <TouchableOpacity style={styles.actionButton} onPress={onPickPhoto}>
                        <Ionicons name="camera" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                )}
                {onEdit && (
                    <TouchableOpacity style={styles.actionButton} onPress={onEdit}>
                        <Ionicons name="pencil-outline" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                )}
                {onDelete && (
                    <TouchableOpacity style={styles.actionButton} onPress={onDelete}>
                        <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                )}
                {onHome && (
                    <TouchableOpacity style={styles.actionButton} onPress={onHome}>
                        <Ionicons name="home" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Info */}
            <View style={styles.headerInfo}>
                {renderHeaderPrefix?.()}
                <View style={renderExtra ? { marginRight: 60 } : null}>
                    <MarqueeText
                        text={title}
                        style={styles.title}
                        speed={30}
                        pauseDuration={2000}
                        spacing={80}
                    />
                </View>
                
                {subtitle && (
                    <View style={[styles.subtitleContainer, renderExtra ? { marginRight: 120 } : null]}>
                        {typeof subtitle === 'string' ? (
                            <MarqueeText
                                text={subtitle}
                                style={styles.subtitleText}
                                speed={30}
                                pauseDuration={2000}
                                spacing={80}
                            />
                        ) : (
                            subtitle
                        )}
                    </View>
                )}
                
                {metaInfo && (
                    <Text style={[styles.metaInfo, renderExtra ? { marginRight: 120 } : null]}>{metaInfo}</Text>
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
    actionButtonsContainer: {
        position: 'absolute',
        top: 50,
        right: 16,
        flexDirection: 'row',
        gap: 10,
        zIndex: 10,
    },
    actionButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
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
        color: '#CCCCCC',
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
