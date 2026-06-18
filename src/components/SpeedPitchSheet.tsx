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
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAudioSpeedPitchSheetStore } from '../store/useAudioSpeedPitchSheetStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { useAppTheme } from "@/hooks/useAppTheme";

const { height } = Dimensions.get('window');

// Maps speed S in [0.5, 2.0] to slider value X in [-1.0, 1.0]
const speedToSliderValue = (speed: number): number => {
    if (speed < 1.0) {
        return (speed - 1.0) * 2;
    } else {
        return speed - 1.0;
    }
};

// Maps slider value X in [-1.0, 1.0] to speed S in [0.5, 2.0] rounded to the nearest 0.05
const sliderValueToSpeed = (val: number): number => {
    let rawSpeed = 1.0;
    if (val < 0) {
        rawSpeed = 1.0 + val * 0.5;
    } else {
        rawSpeed = 1.0 + val * 1.0;
    }
    // Snap to nearest 0.05 for uniform steps
    return Math.round(rawSpeed / 0.05) * 0.05;
};

export default function SpeedPitchSheet() {
    const { colors, fonts, layout } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
    const { isVisible, closeSheet } = useAudioSpeedPitchSheetStore();
    const { playbackSpeed, setPlaybackSpeed } = usePlayerStore();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();

    const slideAnim = useRef(new Animated.Value(height)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Local state to track/smooth layout updates
    const [localSpeed, setLocalSpeed] = useState(playbackSpeed);

    // Sync local state when store values change (e.g. on mount/hydrate)
    useEffect(() => {
        setLocalSpeed(playbackSpeed);
    }, [playbackSpeed]);

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

    const handleResetSpeed = () => {
        setLocalSpeed(1.0);
        setPlaybackSpeed(1.0);
    };

    const handleSliderChange = (val: number) => {
        const newSpeed = sliderValueToSpeed(val);
        if (newSpeed !== localSpeed) {
            setLocalSpeed(newSpeed);
            setPlaybackSpeed(newSpeed); // Updates track player in real-time
        }
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
                    transform: [{ translateY: slideAnim }]
                }
            ]}>
                <View style={styles.dragIndicator} />

                <View style={styles.header}>
                    <Text style={styles.headerTitle}>{t('audio_effects.title') || 'Efectos de Audio'}</Text>
                </View>

                {/* Speed Controls */}
                <View style={styles.controlSection}>
                    <View style={styles.labelRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="speedometer-outline" size={18} color={colors.textSecondary} />
                            <Text style={styles.controlLabel}>{t('audio_effects.speed') || 'Velocidad'}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Text style={styles.valueText}>{localSpeed.toFixed(2)}x</Text>
                            {localSpeed !== 1.0 && (
                                <TouchableOpacity onPress={handleResetSpeed} style={styles.resetButton}>
                                    <Text style={styles.resetButtonText}>{t('audio_effects.reset') || 'Restablecer'}</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                    <Slider
                        style={styles.slider}
                        minimumValue={-1.0}
                        maximumValue={1.0}
                        step={0.01}
                        value={speedToSliderValue(localSpeed)}
                        onValueChange={handleSliderChange}
                        minimumTrackTintColor={colors.accent}
                        maximumTrackTintColor="#282828"
                        thumbTintColor="#FFFFFF"
                    />
                </View>
            </Animated.View>
        </View>
    );
}

const getStyles = (colors: any, fonts: any, layout: any) => StyleSheet.create({
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
    headerTitle: {
        color: colors.accent,
        fontSize: 14,
        fontFamily: fonts.regular,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    controlSection: {
        marginBottom: 24,
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    controlLabel: {
        color: colors.text,
        fontSize: 16,
        fontFamily: fonts.regular,
        fontWeight: '700',
    },
    valueText: {
        color: colors.accentLight,
        fontSize: 16,
        fontFamily: fonts.regular,
        fontWeight: '700',
    },
    resetButton: {
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 8,
    },
    resetButtonText: {
        color: colors.accentLight,
        fontSize: 11,
        fontFamily: fonts.regular,
        fontWeight: '700',
    },
    slider: {
        width: '100%',
        height: 40,
    },
});
