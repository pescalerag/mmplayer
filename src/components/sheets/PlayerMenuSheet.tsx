import { useSheetProps } from '@/hooks/useSheetProps';
import { useAppTheme } from "@/hooks/useAppTheme";
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Animated,
    BackHandler,
    Dimensions,
    PermissionsAndroid,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSettingsStore } from '../../store/useSettingsStore';

const { height } = Dimensions.get('window');

const requestAudioPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
        try {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                {
                    title: "Permiso de Audio",
                    message: "La aplicación requiere acceso para analizar el audio y poder mostrar el visualizador.",
                    buttonNeutral: "Preguntar luego",
                    buttonNegative: "Cancelar",
                    buttonPositive: "Permitir"
                }
            );
            return granted === PermissionsAndroid.RESULTS.GRANTED;
        } catch (err) {
            console.warn(err);
            return false;
        }
    }
    return true;
};

export default function PlayerMenuSheet() {
    const { colors, fonts, layout, spacing, radii } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout, spacing, radii), [colors, fonts, layout, spacing, radii]);
    const { isVisible, close: closeSheet } = useSheetProps('player-menu');
    const {
        showPlayerVisualizer,
        setShowPlayerVisualizer,
        playerVisualizerType,
        setPlayerVisualizerType,
        playerVisualizerColorMode,
        setPlayerVisualizerColorMode,
        playerCoverStyle,
        setPlayerCoverStyle,
        playerBackgroundStyle,
        setPlayerBackgroundStyle,
    } = useSettingsStore();

    const { t } = useTranslation();
    const insets = useSafeAreaInsets();

    const slideAnim = useRef(new Animated.Value(height)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isVisible) {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
                Animated.spring(slideAnim, { toValue: 0, tension: 55, friction: 9, useNativeDriver: true })
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: height, duration: 220, useNativeDriver: true })
            ]).start();
        }
    }, [isVisible, fadeAnim, slideAnim]);

    useEffect(() => {
        if (!isVisible) return;
        const onBackPress = () => { closeSheet(); return true; };
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [isVisible, closeSheet]);

    const [shouldRender, setShouldRender] = useState(isVisible);
    useEffect(() => {
        if (isVisible) {
            setShouldRender(true);
        } else {
            const timer = setTimeout(() => setShouldRender(false), 250);
            return () => clearTimeout(timer);
        }
    }, [isVisible]);

    const handleVisualizerToggle = async (value: boolean) => {
        if (value) {
            const granted = await requestAudioPermission();
            if (granted) {
                setShowPlayerVisualizer(true);
            }
        } else {
            setShowPlayerVisualizer(false);
        }
    };

    if (!shouldRender && !isVisible) return null;

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
                    <Text style={styles.headerTitle}>{t('visualizer.menu_title') || 'Opciones de Visualización'}</Text>
                    <Text style={styles.headerSubtitle}>{t('visualizer.menu_desc') || 'Personaliza el visualizador en tiempo real'}</Text>
                </View>

                <ScrollView
                    style={styles.contentContainer}
                    contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                    keyboardShouldPersistTaps="handled"
                >

                    {/* Cover Art Style */}
                    <Text style={styles.sectionLabel}>{t('visualizer.cover_style') || 'Estilo de Carátula'}</Text>
                    <View style={styles.optionsGroup}>
                        <TouchableOpacity
                            style={[styles.optionBtn, playerCoverStyle === 'cover' && styles.optionBtnActive]}
                            onPress={() => setPlayerCoverStyle('cover')}
                        >
                            <Ionicons name="image" size={18} color={playerCoverStyle === 'cover' ? '#8B5CF6' : colors.textSecondary} />
                            <Text style={[styles.optionText, playerCoverStyle === 'cover' && styles.optionTextActive]}>
                                {t('visualizer.cover_style_cover') || 'Carátula Original'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.optionBtn, playerCoverStyle === 'cd' && styles.optionBtnActive]}
                            onPress={() => setPlayerCoverStyle('cd')}
                        >
                            <Ionicons name="disc" size={18} color={playerCoverStyle === 'cd' ? '#8B5CF6' : colors.textSecondary} />
                            <Text style={[styles.optionText, playerCoverStyle === 'cd' && styles.optionTextActive]}>
                                {t('visualizer.cover_style_cd') || 'CD Giratorio'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.optionBtn, playerCoverStyle === 'vinyl' && styles.optionBtnActive]}
                            onPress={() => setPlayerCoverStyle('vinyl')}
                        >
                            <Ionicons name="radio" size={18} color={playerCoverStyle === 'vinyl' ? '#8B5CF6' : colors.textSecondary} />
                            <Text style={[styles.optionText, playerCoverStyle === 'vinyl' && styles.optionTextActive]}>
                                {t('visualizer.cover_style_vinyl') || 'Vinilo Giratorio'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.separator} />

                    {/* Background Style */}
                    <Text style={styles.sectionLabel}>{t('visualizer.background_style') || 'Estilo de Fondo'}</Text>
                    <View style={styles.optionsGroup}>
                        <TouchableOpacity
                            style={[styles.optionBtn, playerBackgroundStyle === 'cover' && styles.optionBtnActive]}
                            onPress={() => setPlayerBackgroundStyle('cover')}
                        >
                            <Ionicons name="image-outline" size={18} color={playerBackgroundStyle === 'cover' ? '#8B5CF6' : colors.textSecondary} />
                            <Text style={[styles.optionText, playerBackgroundStyle === 'cover' && styles.optionTextActive]}>
                                {t('visualizer.background_style_cover') || 'Carátula Difuminada'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.optionBtn, playerBackgroundStyle === 'gradient' && styles.optionBtnActive]}
                            onPress={() => setPlayerBackgroundStyle('gradient')}
                        >
                            <Ionicons name="color-palette-outline" size={18} color={playerBackgroundStyle === 'gradient' ? '#8B5CF6' : colors.textSecondary} />
                            <Text style={[styles.optionText, playerBackgroundStyle === 'gradient' && styles.optionTextActive]}>
                                {t('visualizer.background_style_gradient') || 'Degradado de Color'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.separator} />

                    {/* Visualizer toggle */}
                    <View style={styles.settingRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.settingLabel}>{t('visualizer.enable') || 'Visualizador Activo'}</Text>
                            <Text style={styles.settingDescription}>{t('visualizer.enable_desc') || 'Muestra ondas y barras al ritmo del sonido'}</Text>
                        </View>
                        <Switch
                            value={showPlayerVisualizer}
                            onValueChange={handleVisualizerToggle}
                            trackColor={{ false: '#282828', true: '#8B5CF6' }}
                            thumbColor={showPlayerVisualizer ? '#FFFFFF' : '#888888'}
                            ios_backgroundColor="#282828"
                        />
                    </View>

                    <View style={[styles.separator]} />

                    <View style={[styles.optionsSection, !showPlayerVisualizer && styles.optionsSectionDisabled]}
                        pointerEvents={showPlayerVisualizer ? 'auto' : 'none'}
                    >
                        <Text style={styles.sectionLabel}>{t('visualizer.style') || 'Estilo del Visualizador'}</Text>
                        <View style={styles.optionsGroup}>
                            <TouchableOpacity
                                style={[styles.optionBtn, playerVisualizerType === 'bars' && styles.optionBtnActive]}
                                onPress={() => setPlayerVisualizerType('bars')}
                            >
                                <Ionicons name="stats-chart" size={18} color={playerVisualizerType === 'bars' && showPlayerVisualizer ? '#8B5CF6' : colors.textSecondary} />
                                <Text style={[styles.optionText, playerVisualizerType === 'bars' && showPlayerVisualizer && styles.optionTextActive]}>
                                    {t('visualizer.style_bars') || 'Barras de Ecualizador'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.optionBtn, playerVisualizerType === 'wave' && styles.optionBtnActive]}
                                onPress={() => setPlayerVisualizerType('wave')}
                            >
                                <Ionicons name="pulse" size={18} color={playerVisualizerType === 'wave' && showPlayerVisualizer ? '#8B5CF6' : colors.textSecondary} />
                                <Text style={[styles.optionText, playerVisualizerType === 'wave' && showPlayerVisualizer && styles.optionTextActive]}>
                                    {t('visualizer.style_wave') || 'Onda Oscilante'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.optionBtn, playerVisualizerType === 'spectrum' && styles.optionBtnActive]}
                                onPress={() => setPlayerVisualizerType('spectrum')}
                            >
                                <Ionicons name="analytics" size={18} color={playerVisualizerType === 'spectrum' && showPlayerVisualizer ? '#8B5CF6' : colors.textSecondary} />
                                <Text style={[styles.optionText, playerVisualizerType === 'spectrum' && showPlayerVisualizer && styles.optionTextActive]}>
                                    {t('visualizer.style_spectrum') || 'Espectro Completo'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.optionBtn, playerVisualizerType === 'circle' && styles.optionBtnActive]}
                                onPress={() => setPlayerVisualizerType('circle')}
                            >
                                <Ionicons name="radio-button-on" size={18} color={playerVisualizerType === 'circle' && showPlayerVisualizer ? '#8B5CF6' : colors.textSecondary} />
                                <Text style={[styles.optionText, playerVisualizerType === 'circle' && showPlayerVisualizer && styles.optionTextActive]}>
                                    {t('visualizer.style_circle') || 'Círculo Pulsante'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.separator} />

                        <Text style={styles.sectionLabel}>{t('visualizer.color_mode') || 'Color'}</Text>
                        <View style={styles.optionsGroup}>
                            <TouchableOpacity
                                style={[styles.optionBtn, playerVisualizerColorMode === 'cover' && styles.optionBtnActive]}
                                onPress={() => setPlayerVisualizerColorMode('cover')}
                            >
                                <Ionicons name="color-palette" size={18} color={playerVisualizerColorMode === 'cover' && showPlayerVisualizer ? '#8B5CF6' : colors.textSecondary} />
                                <Text style={[styles.optionText, playerVisualizerColorMode === 'cover' && showPlayerVisualizer && styles.optionTextActive]}>
                                    {t('visualizer.color_cover') || 'Adaptarse a Portada'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.optionBtn, playerVisualizerColorMode === 'accent' && styles.optionBtnActive]}
                                onPress={() => setPlayerVisualizerColorMode('accent')}
                            >
                                <Ionicons name="color-fill" size={18} color={playerVisualizerColorMode === 'accent' && showPlayerVisualizer ? '#8B5CF6' : colors.textSecondary} />
                                <Text style={[styles.optionText, playerVisualizerColorMode === 'accent' && showPlayerVisualizer && styles.optionTextActive]}>
                                    {t('visualizer.color_accent') || 'Color Temático Morado'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </Animated.View>
        </View>
    );
}

const getStyles = (colors: any, fonts: any, layout: any, spacing: any, radii: any) => StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    sheetContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#0F0F0F',
        borderTopLeftRadius: radii?.lg || 24,
        borderTopRightRadius: radii?.lg || 24,
        paddingHorizontal: 20,
        paddingTop: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        maxHeight: height * 0.72,
    },
    dragIndicator: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 16,
    },
    header: {
        marginBottom: 20,
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: fonts?.regular,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    headerSubtitle: {
        fontSize: 12,
        fontFamily: fonts?.regular,
        color: 'rgba(255,255,255,0.4)',
        marginTop: 4,
    },
    contentContainer: {
        marginBottom: 10,
    },
    optionsSection: {
        opacity: 1,
    },
    optionsSectionDisabled: {
        opacity: 0.3,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    settingLabel: {
        fontSize: 15,
        fontFamily: fonts?.regular,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    settingDescription: {
        fontSize: 12,
        fontFamily: fonts?.regular,
        color: '#888888',
        marginTop: 2,
    },
    separator: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        marginVertical: 14,
    },
    sectionLabel: {
        fontSize: 13,
        fontFamily: fonts?.regular,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.6)',
        textTransform: 'uppercase',
        letterSpacing: 1.0,
        marginBottom: 10,
    },
    optionsGroup: {
        gap: 8,
    },
    optionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    optionBtnActive: {
        backgroundColor: 'rgba(139, 92, 246, 0.08)',
        borderColor: 'rgba(139, 92, 246, 0.3)',
    },
    optionText: {
        fontSize: 14,
        fontFamily: fonts?.regular,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.8)',
    },
    optionTextActive: {
        color: '#8B5CF6',
        fontWeight: '700',
    },
});
