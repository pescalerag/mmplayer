import { useAppTheme } from "@/hooks/useAppTheme";
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    PermissionsAndroid,
    Platform,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSettingsStore } from '../../store/useSettingsStore';
import { BaseMenuSheet } from './BaseMenuSheet';

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
        showCanvas,
        setShowCanvas,
    } = useSettingsStore();

    const { t } = useTranslation();

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

    return (
        <BaseMenuSheet
            title={t('visualizer.menu_title') || 'Opciones de Visualización'}
            subtitle={t('visualizer.menu_desc') || 'Personaliza el visualizador en tiempo real'}
        >
        
                    {/* Cover Art Style */}
                    <Text style={styles.sectionLabel}>{t('visualizer.cover_style') || 'Estilo de Carátula'}</Text>
                    <View style={styles.optionsGroup}>
                        <TouchableOpacity
                            style={[styles.optionBtn, playerCoverStyle === 'cover' && styles.optionBtnActive]}
                            onPress={() => setPlayerCoverStyle('cover')}
                        >
                            <Ionicons name="image" size={18} color={playerCoverStyle === 'cover' ? colors.accent : colors.textSecondary} />
                            <Text style={[styles.optionText, playerCoverStyle === 'cover' && styles.optionTextActive]}>
                                {t('visualizer.cover_style_cover') || 'Carátula Original'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.optionBtn, playerCoverStyle === 'cd' && styles.optionBtnActive]}
                            onPress={() => setPlayerCoverStyle('cd')}
                        >
                            <Ionicons name="disc" size={18} color={playerCoverStyle === 'cd' ? colors.accent : colors.textSecondary} />
                            <Text style={[styles.optionText, playerCoverStyle === 'cd' && styles.optionTextActive]}>
                                {t('visualizer.cover_style_cd') || 'CD Giratorio'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.optionBtn, playerCoverStyle === 'vinyl' && styles.optionBtnActive]}
                            onPress={() => setPlayerCoverStyle('vinyl')}
                        >
                            <Ionicons name="radio" size={18} color={playerCoverStyle === 'vinyl' ? colors.accent : colors.textSecondary} />
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
                            <Ionicons name="image-outline" size={18} color={playerBackgroundStyle === 'cover' ? colors.accent : colors.textSecondary} />
                            <Text style={[styles.optionText, playerBackgroundStyle === 'cover' && styles.optionTextActive]}>
                                {t('visualizer.background_style_cover') || 'Carátula Difuminada'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.optionBtn, playerBackgroundStyle === 'gradient' && styles.optionBtnActive]}
                            onPress={() => setPlayerBackgroundStyle('gradient')}
                        >
                            <Ionicons name="color-palette-outline" size={18} color={playerBackgroundStyle === 'gradient' ? colors.accent : colors.textSecondary} />
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
                            trackColor={{ false: '#282828', true: colors.accent }}
                            thumbColor={showPlayerVisualizer ? '#FFFFFF' : '#888888'}
                            ios_backgroundColor="#282828"
                        />
                    </View>

                    <View style={styles.separator} />

                    {/* Canvas toggle */}
                    <View style={styles.settingRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.settingLabel}>{t('visualizer.show_canvas')}</Text>
                            <Text style={styles.settingDescription}>{t('visualizer.show_canvas_desc')}</Text>
                        </View>
                        <Switch
                            value={showCanvas}
                            onValueChange={setShowCanvas}
                            trackColor={{ false: '#282828', true: colors.accent }}
                            thumbColor={showCanvas ? '#FFFFFF' : '#888888'}
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
                                <Ionicons name="stats-chart" size={18} color={playerVisualizerType === 'bars' && showPlayerVisualizer ? colors.accent : colors.textSecondary} />
                                <Text style={[styles.optionText, playerVisualizerType === 'bars' && showPlayerVisualizer && styles.optionTextActive]}>
                                    {t('visualizer.style_bars') || 'Barras de Ecualizador'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.optionBtn, playerVisualizerType === 'wave' && styles.optionBtnActive]}
                                onPress={() => setPlayerVisualizerType('wave')}
                            >
                                <Ionicons name="pulse" size={18} color={playerVisualizerType === 'wave' && showPlayerVisualizer ? colors.accent : colors.textSecondary} />
                                <Text style={[styles.optionText, playerVisualizerType === 'wave' && showPlayerVisualizer && styles.optionTextActive]}>
                                    {t('visualizer.style_wave') || 'Onda Oscilante'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.optionBtn, playerVisualizerType === 'spectrum' && styles.optionBtnActive]}
                                onPress={() => setPlayerVisualizerType('spectrum')}
                            >
                                <Ionicons name="analytics" size={18} color={playerVisualizerType === 'spectrum' && showPlayerVisualizer ? colors.accent : colors.textSecondary} />
                                <Text style={[styles.optionText, playerVisualizerType === 'spectrum' && showPlayerVisualizer && styles.optionTextActive]}>
                                    {t('visualizer.style_spectrum') || 'Espectro Completo'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.optionBtn, playerVisualizerType === 'circle' && styles.optionBtnActive]}
                                onPress={() => setPlayerVisualizerType('circle')}
                            >
                                <Ionicons name="radio-button-on" size={18} color={playerVisualizerType === 'circle' && showPlayerVisualizer ? colors.accent : colors.textSecondary} />
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
                                <Ionicons name="color-palette" size={18} color={playerVisualizerColorMode === 'cover' && showPlayerVisualizer ? colors.accent : colors.textSecondary} />
                                <Text style={[styles.optionText, playerVisualizerColorMode === 'cover' && showPlayerVisualizer && styles.optionTextActive]}>
                                    {t('visualizer.color_cover') || 'Adaptarse a Portada'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.optionBtn, playerVisualizerColorMode === 'accent' && styles.optionBtnActive]}
                                onPress={() => setPlayerVisualizerColorMode('accent')}
                            >
                                <Ionicons name="color-fill" size={18} color={playerVisualizerColorMode === 'accent' && showPlayerVisualizer ? colors.accent : colors.textSecondary} />
                                <Text style={[styles.optionText, playerVisualizerColorMode === 'accent' && showPlayerVisualizer && styles.optionTextActive]}>
                                    {t('visualizer.color_accent') || 'Color Temático Morado'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
        </BaseMenuSheet>
    );
}

const getStyles = (colors: any, fonts: any, layout: any, spacing: any, radii: any) => StyleSheet.create({
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
        backgroundColor: colors.accentAlpha8,
        borderColor: colors.accentAlpha30,
    },
    optionText: {
        fontSize: 14,
        fontFamily: fonts?.regular,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.8)',
    },
    optionTextActive: {
        color: colors.accent,
        fontWeight: '700',
    },
});
