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
import { useSleepTimerStore } from '../store/useSleepTimerStore';

const { height } = Dimensions.get('window');

const formatHHMMSS = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

export default function SleepTimerSheet() {
    const { isVisible, isActive, timeLeft, closeSheet, startTimer, deactivate } = useSleepTimerStore();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();

    const slideAnim = useRef(new Animated.Value(height)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // --- ANIMACIONES DE SHEET ---
    useEffect(() => {
        if (isVisible) {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
                Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true })
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: height, duration: 250, useNativeDriver: true })
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

    const timerOptions = [
        { label: `5 ${t('sleep_timer.minutes')}`, value: 5 },
        { label: `10 ${t('sleep_timer.minutes')}`, value: 10 },
        { label: `20 ${t('sleep_timer.minutes')}`, value: 20 },
        { label: `30 ${t('sleep_timer.minutes')}`, value: 30 },
        { label: `45 ${t('sleep_timer.minutes')}`, value: 45 },
        { label: t('sleep_timer.hour'), value: 60 },
    ];

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
                    transform: [{ translateY: slideAnim }]
                }
            ]}>
                <View style={styles.dragIndicator} />

                <View style={styles.header}>
                    <Text style={styles.headerTitle}>{t('sleep_timer.title')}</Text>
                    <Text style={styles.headerSubtitle}>
                        {isActive ? t('sleep_timer.status_active') : t('sleep_timer.off')}
                    </Text>
                </View>

                {/* Digital Clock Display */}
                <View style={styles.clockContainer}>
                    <Text style={[styles.clockText, isActive && styles.clockTextActive]}>
                        {formatHHMMSS(timeLeft)}
                    </Text>
                </View>

                {/* Controls */}
                <View style={styles.contentContainer}>
                    {!isActive ? (
                        <View style={styles.optionsGrid}>
                            {timerOptions.map((opt) => (
                                <TouchableOpacity
                                    key={opt.value}
                                    style={styles.optionButton}
                                    onPress={() => startTimer(opt.value)}
                                >
                                    <Text style={styles.optionButtonText}>{opt.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={styles.deactivateButton}
                            onPress={deactivate}
                        >
                            <Ionicons name="stop-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                            <Text style={styles.deactivateButtonText}>
                                {t('sleep_timer.deactivate')}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
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
        borderColor: '#1E1E1E',
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
        borderBottomColor: '#282828',
        paddingBottom: 15,
    },
    headerTitle: {
        color: '#8B5CF6',
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    headerSubtitle: {
        color: '#FFFFFF',
        fontSize: 20,
        fontFamily: 'Montserrat',
        fontWeight: '800',
        marginTop: 4,
    },
    clockContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        marginBottom: 20,
    },
    clockText: {
        color: '#535353',
        fontSize: 48,
        fontWeight: 'bold',
        fontFamily: 'Montserrat',
        letterSpacing: 2,
    },
    clockTextActive: {
        color: '#A78BFA',
    },
    contentContainer: {
        marginBottom: 10,
    },
    optionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 12,
    },
    optionButton: {
        backgroundColor: '#181818',
        borderWidth: 1,
        borderColor: '#2A2A2A',
        borderRadius: 20,
        paddingVertical: 12,
        paddingHorizontal: 20,
        minWidth: '28%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    deactivateButton: {
        backgroundColor: '#EF4444',
        borderRadius: 24,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 20,
    },
    deactivateButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: 'Montserrat',
        fontWeight: 'bold',
    },
});
