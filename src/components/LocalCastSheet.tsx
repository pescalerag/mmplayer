import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    BackHandler,
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useCastSheetStore } from '../store/useCastSheetStore';
import { useCastStore } from '../store/useCastStore';
import { useToastStore } from '../store/useToastStore';
import { useAppTheme } from '@/hooks/useAppTheme';

const { height } = Dimensions.get('window');

export default function LocalCastSheet() {
    const { colors, fonts } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts), [colors, fonts]);
    const { isVisible, closeSheet } = useCastSheetStore();
    const { isServerRunning, serverIp, startServer, stopServer } = useCastStore();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();

    const slideAnim = useRef(new Animated.Value(height)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const [isLoading, setIsLoading] = useState(false);

    // --- ANIMACIONES ---
    useEffect(() => {
        if (isVisible) {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
                Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: height, duration: 250, useNativeDriver: true }),
            ]).start();
        }
    }, [isVisible, fadeAnim, slideAnim]);

    // --- BACKHANDLER ---
    useEffect(() => {
        if (!isVisible) return;
        const onBackPress = () => { closeSheet(); return true; };
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [isVisible, closeSheet]);

    // Render/unmount controlado
    const [shouldRender, setShouldRender] = useState(isVisible);
    useEffect(() => {
        if (isVisible) {
            setShouldRender(true);
        } else {
            const timer = setTimeout(() => setShouldRender(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isVisible]);

    if (!shouldRender && !isVisible) return null;

    const handleStart = () => {
        setIsLoading(true);
        startServer()
            .then(() => {
                setIsLoading(false);
            })
            .catch((err: any) => {
                setIsLoading(false);
                useToastStore.getState().showToast(
                    err?.message || 'No se pudo iniciar el casteo.',
                    'alert-circle-outline'
                );
            });
    };

    const handleStop = () => {
        setIsLoading(true);
        stopServer()
            .then(() => {
                setIsLoading(false);
                useToastStore.getState().showToast(
                    t('toasts.cast_stopped') || 'Casteo detenido',
                    'desktop-outline'
                );
            })
            .catch(() => {
                setIsLoading(false);
            });
    };

    return (
        <View
            style={[StyleSheet.absoluteFill, { zIndex: 9999 }]}
            pointerEvents={isVisible ? 'auto' : 'none'}
        >
            <TouchableWithoutFeedback onPress={closeSheet}>
                <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} />
            </TouchableWithoutFeedback>

            <Animated.View style={[
                styles.sheetContainer,
                {
                    paddingBottom: insets.bottom + 20,
                    transform: [{ translateY: slideAnim }],
                },
            ]}>
                <View style={styles.dragIndicator} />

                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerLabel}>
                        {t('cast.title')}
                    </Text>
                    <Text style={styles.headerTitle}>
                        {isServerRunning
                            ? t('cast.status_active')
                            : t('cast.status_idle')}
                    </Text>
                </View>

                {/* Status icon */}
                <View style={styles.iconContainer}>
                    <Ionicons
                        name={isServerRunning ? 'desktop' : 'desktop-outline'}
                        size={56}
                        color={isServerRunning ? colors.accentLight : '#535353'}
                    />
                    {isServerRunning && <View style={styles.activeDot} />}
                </View>

                {/* IP del servidor */}
                {isServerRunning && serverIp ? (
                    <View style={styles.ipContainer}>
                        <Text style={styles.ipLabel}>
                            {t('cast.open_in_browser')}
                        </Text>
                        <Text style={styles.ipAddress} selectable>
                            {serverIp}
                        </Text>
                    </View>
                ) : (
                    <View style={styles.ipContainer}>
                        <Text style={styles.idleText}>
                            {t('cast.idle_desc')}
                        </Text>
                    </View>
                )}

                {/* Botón de acción */}
                <View style={styles.actionContainer}>
                    {!isServerRunning ? (
                        <TouchableOpacity
                            style={[styles.actionButton, styles.startButton, isLoading && styles.buttonDisabled]}
                            onPress={handleStart}
                            disabled={isLoading}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="wifi" size={20} color="#fff" style={{ marginRight: 10 }} />
                            <Text style={styles.actionButtonText}>
                                {isLoading ? t('cast.starting') : t('cast.start')}
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[styles.actionButton, styles.stopButton, isLoading && styles.buttonDisabled]}
                            onPress={handleStop}
                            disabled={isLoading}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="stop-circle-outline" size={20} color="#fff" style={{ marginRight: 10 }} />
                            <Text style={styles.actionButtonText}>
                                {isLoading ? t('cast.stopping') : t('cast.stop')}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </Animated.View>
        </View>
    );
}

const getStyles = (colors: any, fonts: any) => StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    sheetContainer: {
        backgroundColor: '#0E0E0E',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        position: 'absolute',
        bottom: 0,
        width: '100%',
        borderTopWidth: 1,
        borderColor: colors.cardBackground,
        overflow: 'hidden',
        paddingHorizontal: 24,
    },
    dragIndicator: {
        width: 40,
        height: 4,
        backgroundColor: '#2E2E2E',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 14,
        marginBottom: 16,
    },
    header: {
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: colors.cardBackground,
        paddingBottom: 15,
    },
    headerLabel: {
        color: colors.accent,
        fontSize: 14,
        fontFamily: fonts.regular,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    headerTitle: {
        color: colors.text,
        fontSize: 20,
        fontFamily: fonts.regular,
        fontWeight: '800',
        marginTop: 4,
    },
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        position: 'relative',
    },
    activeDot: {
        position: 'absolute',
        bottom: 16,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.accentLight,
        // pulse visual via border
        borderWidth: 2,
        borderColor: '#0E0E0E',
    },
    ipContainer: {
        alignItems: 'center',
        paddingHorizontal: 8,
        marginBottom: 24,
        minHeight: 60,
        justifyContent: 'center',
    },
    ipLabel: {
        color: colors.textSecondary,
        fontSize: 13,
        fontFamily: fonts.regular,
        textAlign: 'center',
        marginBottom: 8,
    },
    ipAddress: {
        color: colors.text,
        fontSize: 18,
        fontFamily: fonts.regular,
        fontWeight: '800',
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    idleText: {
        color: colors.textSecondary,
        fontSize: 14,
        fontFamily: fonts.regular,
        textAlign: 'center',
        lineHeight: 20,
    },
    actionContainer: {
        marginTop: 4,
        marginBottom: 8,
    },
    actionButton: {
        borderRadius: 24,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 8,
    },
    startButton: {
        backgroundColor: colors.accent,
    },
    stopButton: {
        backgroundColor: colors.heartIcon,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 16,
        fontFamily: fonts.regular,
        fontWeight: 'bold',
    },
});
