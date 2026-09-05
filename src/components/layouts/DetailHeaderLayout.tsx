import { useAppTheme } from "@/hooks/useAppTheme";
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
import MarqueeText from '@/components/common/MarqueeText';

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
    onEditTitle?: () => void;
    onPickPhoto?: () => void;
    onMore?: () => void;
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
    onEditTitle,
    onPickPhoto,
    onMore,
    renderExtra,
    renderHeaderPrefix,
    isFavorites = false,
    renderCover,
}: DetailHeaderLayoutProps) => {
    const { colors, fonts, layout } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
    const imageSource = React.useMemo(() => {
        if (!imageUrl) return null;
        if (imageUrl.startsWith('file://') && !imageUrl.includes('?t=')) {
            return { uri: `${imageUrl}?t=${Date.now()}` };
        }
        return { uri: imageUrl };
    }, [imageUrl]);

    return (
        <View style={styles.headerContainer}>
            {renderCover ? (
                renderCover()
            ) : isFavorites ? (
                <LinearGradient
                    colors={[colors.accent, colors.accentDark || '#4C1D95']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.headerImage, styles.headerPlaceholder]}
                >
                    <Ionicons name="heart" size={100} color={colors.onAccent} />
                </LinearGradient>
            ) : imageUrl ? (
                <Image
                    key={imageUrl}
                    source={imageSource}
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
                colors={['transparent', 'rgba(0,0,0,0.8)', colors.background] as any}
                style={styles.gradient}
            />

            {/* Botón atrás */}
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
                <Ionicons name="chevron-back" size={28} color={colors.text} />
            </TouchableOpacity>

            {/* Botones de Acción Derechos */}
            <View style={styles.actionButtonsContainer}>
                {onPickPhoto && (
                    <TouchableOpacity style={styles.actionButton} onPress={onPickPhoto}>
                        <Ionicons name="camera" size={22} color={colors.text} />
                    </TouchableOpacity>
                )}
                {onEdit && (
                    <TouchableOpacity style={styles.actionButton} onPress={onEdit}>
                        <Ionicons name="pencil-outline" size={22} color={colors.text} />
                    </TouchableOpacity>
                )}
                {onDelete && (
                    <TouchableOpacity style={styles.actionButton} onPress={onDelete}>
                        <Ionicons name="trash-outline" size={22} color={colors.text} />
                    </TouchableOpacity>
                )}
                {onHome && (
                    <TouchableOpacity style={styles.actionButton} onPress={onHome}>
                        <Ionicons name="home" size={22} color={colors.text} />
                    </TouchableOpacity>
                )}
                {onMore && (
                    <TouchableOpacity style={styles.actionButton} onPress={onMore}>
                        <Ionicons name="ellipsis-vertical" size={22} color={colors.text} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Info */}
            <View style={styles.headerInfo}>
                {renderHeaderPrefix?.()}
                <View style={[styles.titleRow, renderExtra ? { marginRight: 60 } : null]}>
                    <View style={onEditTitle ? { flexShrink: 1, maxWidth: '84%' } : { flex: 1 }}>
                        <MarqueeText
                            text={title}
                            style={styles.title}
                            speed={30}
                            pauseDuration={2000}
                            spacing={80}
                        />
                    </View>
                    {onEditTitle && (
                        <TouchableOpacity
                            style={styles.editTitleButton}
                            onPress={onEditTitle}
                            activeOpacity={0.7}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                            <Ionicons name="pencil" size={15} color={colors.text} />
                        </TouchableOpacity>
                    )}
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

const getStyles = (colors: any, fonts: any, layout: any) => StyleSheet.create({
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
        backgroundColor: colors.cardBackground,
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
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    editTitleButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    title: {
        color: colors.text,
        fontSize: 28,
        fontFamily: fonts.regular,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    subtitleContainer: {
        marginBottom: 4,
    },
    subtitleText: {
        color: colors.textSecondary,
        fontSize: 16,
        fontFamily: fonts.regular,
        fontWeight: '700',
    },
    metaInfo: {
        color: colors.textSecondary,
        fontSize: 14,
        fontFamily: fonts.regular,
        fontWeight: '700',
    },
});
