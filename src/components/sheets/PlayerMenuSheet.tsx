import { useAppTheme } from "@/hooks/useAppTheme";
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BlurredBackground from '../layouts/BlurredBackground';
import { ScrollView } from 'react-native-gesture-handler';
import { PlayerDiscArtwork } from '../player/PlayerDiscArtwork';
import { CassetteArtwork } from '../player/CassetteArtwork';
import { useSheetProps } from '../../hooks/useSheetProps';
import { PlayerMenuAppearance } from '../../store/useUIStore';
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

function PreviewOption({ label, selected, onPress, children, portrait = false }: Readonly<{
    label: string; selected: boolean; onPress: () => void; children: React.ReactNode; portrait?: boolean;
}>) {
    const { colors, fonts } = useAppTheme();
    return <TouchableOpacity onPress={onPress} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: selected }}
        style={{ width: portrait ? 132 : 120, gap: 8 }} activeOpacity={0.8}>
        <View style={{ height: portrait ? 160 : 112, alignItems: 'center', justifyContent: 'center', borderRadius: 12, overflow: 'hidden', backgroundColor: colors.cardBackground, borderWidth: 2, borderColor: selected ? colors.accent : colors.cardBackground }}>
            {children}
            {selected && <View style={{ position: 'absolute', top: 5, right: 5, borderRadius: 12, padding: 3, backgroundColor: colors.accent }}><Ionicons name="checkmark" size={13} color={colors.onAccent} /></View>}
        </View>
        <Text numberOfLines={2} style={{ fontFamily: fonts.regular, fontSize: 12, textAlign: 'center', color: selected ? colors.accent : colors.textSecondary }}>{label}</Text>
    </TouchableOpacity>;
}

export default function PlayerMenuSheet() {
    const insets = useSafeAreaInsets();
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
        showCassetteAlbumName,
        setShowCassetteAlbumName,
        playerBackgroundStyle,
        setPlayerBackgroundStyle,
        showCanvas,
        setShowCanvas,
    } = useSettingsStore();

    const { t } = useTranslation();
    const { props } = useSheetProps<Partial<PlayerMenuAppearance>>('player-menu');
    const appearance = props ?? {};
    const gradientColors = appearance.gradientColors ?? ['#121212', colors.background, colors.background] as const;
    const coverPreview = appearance.coverUrl
        ? <Image source={{ uri: appearance.coverUrl }} recyclingKey={appearance.coverUrl} style={styles.coverPreview} contentFit="contain" transition={0} />
        : <Ionicons name="musical-notes" size={42} color={colors.textSecondary} />;

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
            footer={<View style={{ height: insets.bottom + 16, flexShrink: 0, backgroundColor: colors.sheetBackground, marginHorizontal: -24 }} />}
        >
        
            <Text style={styles.sectionLabel}>{t('visualizer.cover_style')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewRow}>
                {(['cover', 'cd', 'vinyl'] as const).map(style => (
                    <PreviewOption key={style} label={t('visualizer.cover_style_' + style)} selected={playerCoverStyle === style} onPress={() => setPlayerCoverStyle(style)}>
                        {style === 'cover' ? coverPreview : <PlayerDiscArtwork playerCoverStyle={style} coverUrl={appearance.coverUrl} album={{ cdArtUrl: appearance.cdArtUrl ?? null }} artworkSize={96} holeSize={12} spinStyle={undefined} coverColor={appearance.coverColor ?? null} />}
                    </PreviewOption>
                ))}
                <PreviewOption label={t('visualizer.cover_style_cassette')} selected={playerCoverStyle === 'cassette'} onPress={() => setPlayerCoverStyle('cassette')}>
                    <CassetteArtwork size={104} coverUrl={appearance.coverUrl} coverColor={appearance.coverColor} albumTitle={showCassetteAlbumName ? appearance.albumTitle : null} progress={0.35} />
                </PreviewOption>
            </ScrollView>
            <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.settingLabel}>{t('visualizer.cassette_album_name')}</Text>
                </View>
                <Switch value={showCassetteAlbumName} onValueChange={setShowCassetteAlbumName}
                    accessibilityLabel={t('visualizer.cassette_album_name')}
                    trackColor={{ false: '#282828', true: colors.accent }}
                    thumbColor={showCassetteAlbumName ? '#FFFFFF' : '#888888'} ios_backgroundColor="#282828" />
            </View>
            <View style={styles.separator} />
            <Text style={styles.sectionLabel}>{t('visualizer.background_style')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewRow}>
                <PreviewOption label={t('visualizer.background_style_cover')} selected={playerBackgroundStyle === 'cover'} onPress={() => setPlayerBackgroundStyle('cover')} portrait>
                    <BlurredBackground
                        imageUrl={appearance.coverUrl}
                        blurIntensity={10}
                        gradientColors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)', colors.background]}
                    />
                </PreviewOption>
                <PreviewOption label={t('visualizer.background_style_gradient')} selected={playerBackgroundStyle === 'gradient'} onPress={() => setPlayerBackgroundStyle('gradient')} portrait>
                    <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFillObject} />
                </PreviewOption>
            </ScrollView>
            <View style={styles.separator} />

                    {/* Canvas toggle */}
                    <View style={styles.settingRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.settingLabel}>{t('visualizer.show_canvas')}</Text>
                            <Text style={styles.settingDescription}>{t('visualizer.show_canvas_desc')}</Text>
                        </View>
                        <Switch
                            value={showCanvas}
                            accessibilityLabel={t('visualizer.show_canvas')}
                            onValueChange={setShowCanvas}
                            trackColor={{ false: '#282828', true: colors.accent }}
                            thumbColor={showCanvas ? '#FFFFFF' : '#888888'}
                            ios_backgroundColor="#282828"
                        />
                    </View>

                    <View style={[styles.separator]} />

                    {/* Visualizer toggle */}
                    <View style={styles.settingRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.settingLabel}>{t('visualizer.enable') || 'Visualizador Activo'}</Text>
                            <Text style={styles.settingDescription}>{t('visualizer.enable_desc') || 'Muestra ondas y barras al ritmo del sonido'}</Text>
                        </View>
                        <Switch
                            value={showPlayerVisualizer}
                            accessibilityLabel={t('visualizer.enable')}
                            onValueChange={handleVisualizerToggle}
                            trackColor={{ false: '#282828', true: colors.accent }}
                            thumbColor={showPlayerVisualizer ? '#FFFFFF' : '#888888'}
                            ios_backgroundColor="#282828"
                        />
                    </View>

                    <View style={styles.separator} />

                    <View style={[styles.optionsSection, !showPlayerVisualizer && styles.optionsSectionDisabled]}
                        pointerEvents={showPlayerVisualizer ? 'auto' : 'none'}
                    >
                        <Text style={styles.sectionLabel}>{t('visualizer.style') || 'Estilo del Visualizador'}</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewRow}>
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
                        </ScrollView>

                        <View style={styles.separator} />

                        <Text style={styles.sectionLabel}>{t('visualizer.color_mode')}</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewRow}>
                            {(['cover', 'accent'] as const).map(mode => (
                                <TouchableOpacity key={mode} accessibilityRole="radio" accessibilityLabel={t('visualizer.color_' + mode)} accessibilityState={{ checked: playerVisualizerColorMode === mode, disabled: !showPlayerVisualizer }}
                                    style={styles.colorOption} onPress={() => setPlayerVisualizerColorMode(mode)}>
                                    <View style={[styles.colorRing, { borderColor: playerVisualizerColorMode === mode ? colors.accent : 'transparent' }]}>
                                        <View style={[styles.colorSwatch, { backgroundColor: mode === 'cover' ? appearance.coverColor || colors.accent : colors.accent }]} />
                                    </View>
                                    <Text style={[styles.previewLabel, { color: playerVisualizerColorMode === mode ? colors.accent : colors.textSecondary }]}>{t('visualizer.color_' + mode)}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
        </BaseMenuSheet>
    );
}

const getStyles = (colors: any, fonts: any, layout: any, spacing: any, radii: any) => StyleSheet.create({
    previewRow: { gap: 12, paddingBottom: 4 },
    coverPreview: { width: 96, height: 96, borderRadius: 8 },
    colorOption: { width: 120, alignItems: 'center', gap: 8 },
    colorRing: { width: 54, height: 54, borderRadius: 27, borderWidth: 2, padding: 4 },
    colorSwatch: { flex: 1, borderRadius: 24 },
    previewLabel: { fontFamily: fonts.regular, fontSize: 12, textAlign: 'center' },
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
