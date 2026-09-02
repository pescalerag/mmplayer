import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { scheduleOnRN } from 'react-native-worklets';
import ColorPicker, {
    HueSlider,
    Panel1,
    Swatches,
} from 'reanimated-color-picker';
import { useSettingsStore, StatsCardTheme, LocalCastTheme } from '../../store/useSettingsStore';
import { useAppTheme } from '../../hooks/useAppTheme';
import { getDynamicTagTextColor } from '../../utils/color';

// Using require to safely handle the dynamic import if not installed fully native
let setAppIcon: (name: string | null, isInBackground?: boolean) => Promise<any>;
let getAppIcon: () => Promise<string>;
try {
    const dynamicIcon = require('@howincodes/expo-dynamic-app-icon');
    setAppIcon = dynamicIcon.setAppIcon;
    getAppIcon = dynamicIcon.getAppIcon;
} catch (e) {
    setAppIcon = async () => console.warn('Dynamic icons module not linked');
    getAppIcon = async () => 'DEFAULT';
}

const ICONS = [
    { id: 'DEFAULT', nameKey: 'support.icon_original', image: require('../../assets/images/icon.png') },
    { id: 'dark', nameKey: 'support.icon_dark', image: require('../../assets/images/dark-icon.png') },
    { id: 'supporter', nameKey: 'support.icon_supporter', image: require('../../assets/images/supporter-icon.png') },
    { id: 'retro', nameKey: 'support.icon_retro', image: require('../../assets/images/retro-icon.png') }
];

interface StatsThemeOption {
    id: StatsCardTheme;
    nameKey: string;
    descKey: string;
    colors: [string, string, string];
    accent: string;
    badgeText: string;
    isVipOnly: boolean;
}

const STATS_THEMES: StatsThemeOption[] = [
    {
        id: 'default',
        nameKey: 'support.stats_theme_default',
        descKey: 'support.stats_theme_default_desc',
        colors: ['#05020a', '#1a0a33', '#33125d'],
        accent: '#8B5CF6',
        badgeText: 'STATS',
        isVipOnly: false,
    },
    {
        id: 'glass',
        nameKey: 'support.stats_theme_glass',
        descKey: 'support.stats_theme_glass_desc',
        colors: ['#020617', '#0d3257', '#174f85'],
        accent: '#38BDF8',
        badgeText: 'STATS',
        isVipOnly: true,
    },
    {
        id: 'holographic',
        nameKey: 'support.stats_theme_holographic',
        descKey: 'support.stats_theme_holographic_desc',
        colors: ['#060012', '#3b0a57', '#8a1674'],
        accent: '#EC4899',
        badgeText: 'STATS',
        isVipOnly: true,
    },
    {
        id: 'gold',
        nameKey: 'support.stats_theme_gold',
        descKey: 'support.stats_theme_gold_desc',
        colors: ['#070501', '#2d1f07', '#5c3e0c'],
        accent: '#FBBF24',
        badgeText: 'STATS',
        isVipOnly: true,
    },
    {
        id: 'emerald',
        nameKey: 'support.stats_theme_emerald',
        descKey: 'support.stats_theme_emerald_desc',
        colors: ['#010906', '#063321', '#0b5a38'],
        accent: '#10B981',
        badgeText: 'STATS',
        isVipOnly: true,
    },
    {
        id: 'sunset',
        nameKey: 'support.stats_theme_sunset',
        descKey: 'support.stats_theme_sunset_desc',
        colors: ['#0c0309', '#4a0d24', '#851b2e'],
        accent: '#F43F5E',
        badgeText: 'STATS',
        isVipOnly: true,
    },
    {
        id: 'midnight',
        nameKey: 'support.stats_theme_midnight',
        descKey: 'support.stats_theme_midnight_desc',
        colors: ['#000000', '#12151f', '#222838'],
        accent: '#E2E8F0',
        badgeText: 'STATS',
        isVipOnly: true,
    },
    {
        id: 'crimson',
        nameKey: 'support.stats_theme_crimson',
        descKey: 'support.stats_theme_crimson_desc',
        colors: ['#080103', '#380611', '#660b1e'],
        accent: '#E11D48',
        badgeText: 'STATS',
        isVipOnly: true,
    },
];

interface LocalCastThemeOption {
    id: LocalCastTheme;
    nameKey: string;
    descKey: string;
    colors: [string, string, string];
    accent: string;
    subAccent: string;
    isVipOnly: boolean;
}

const LOCALCAST_THEMES: LocalCastThemeOption[] = [
    {
        id: 'default',
        nameKey: 'support.localcast_theme_default',
        descKey: 'support.localcast_theme_default_desc',
        colors: ['#0d0f12', '#161b22', '#22183b'],
        accent: '#8B5CF6',
        subAccent: '#A78BFA',
        isVipOnly: false,
    },
    {
        id: 'cyberpunk',
        nameKey: 'support.localcast_theme_cyberpunk',
        descKey: 'support.localcast_theme_cyberpunk_desc',
        colors: ['#030712', '#081226', '#20072e'],
        accent: '#00F0FF',
        subAccent: '#FF007F',
        isVipOnly: true,
    },
    {
        id: 'gold',
        nameKey: 'support.localcast_theme_gold',
        descKey: 'support.localcast_theme_gold_desc',
        colors: ['#080602', '#1c1408', '#38280f'],
        accent: '#FBBF24',
        subAccent: '#FDE68A',
        isVipOnly: true,
    },
    {
        id: 'aurora',
        nameKey: 'support.localcast_theme_aurora',
        descKey: 'support.localcast_theme_aurora_desc',
        colors: ['#020c10', '#062024', '#0d3b36'],
        accent: '#10B981',
        subAccent: '#06B6D4',
        isVipOnly: true,
    },
    {
        id: 'emerald',
        nameKey: 'support.localcast_theme_emerald',
        descKey: 'support.localcast_theme_emerald_desc',
        colors: ['#010906', '#032014', '#063826'],
        accent: '#10B981',
        subAccent: '#6EE7B7',
        isVipOnly: true,
    },
    {
        id: 'sunset',
        nameKey: 'support.localcast_theme_sunset',
        descKey: 'support.localcast_theme_sunset_desc',
        colors: ['#0c0309', '#2d0a1c', '#4d1028'],
        accent: '#F43F5E',
        subAccent: '#FDA4AF',
        isVipOnly: true,
    },
    {
        id: 'midnight',
        nameKey: 'support.localcast_theme_midnight',
        descKey: 'support.localcast_theme_midnight_desc',
        colors: ['#000000', '#0f121a', '#181e2b'],
        accent: '#E2E8F0',
        subAccent: '#94A3B8',
        isVipOnly: true,
    },
    {
        id: 'crimson',
        nameKey: 'support.localcast_theme_crimson',
        descKey: 'support.localcast_theme_crimson_desc',
        colors: ['#080103', '#24040c', '#400815'],
        accent: '#E11D48',
        subAccent: '#FECDD3',
        isVipOnly: true,
    },
];

interface AccentPresetOption {
    id: string;
    nameKey: string;
    color: string;
    isVipOnly: boolean;
}

const ACCENT_PRESETS: AccentPresetOption[] = [
    {
        id: 'purple',
        nameKey: 'support.accent_preset_purple',
        color: '#8B5CF6',
        isVipOnly: false,
    },
    {
        id: 'blue',
        nameKey: 'support.accent_preset_blue',
        color: '#3B82F6',
        isVipOnly: true,
    },
    {
        id: 'emerald',
        nameKey: 'support.accent_preset_emerald',
        color: '#10B981',
        isVipOnly: true,
    },
    {
        id: 'pink',
        nameKey: 'support.accent_preset_pink',
        color: '#EC4899',
        isVipOnly: true,
    },
];

export default function BenefitsView() {
    const { t } = useTranslation();
    const { colors, fonts } = useAppTheme();
    const userTier = useSettingsStore(state => state.userTier);

    const activeAppIcon = useSettingsStore(state => state.appIcon) || 'DEFAULT';
    const setStoreAppIcon = useSettingsStore(state => state.setAppIcon);

    const activeStatsTheme = useSettingsStore(state => state.statsCardTheme) || 'default';
    const setStoreStatsTheme = useSettingsStore(state => state.setStatsCardTheme);

    const activeLocalCastTheme = useSettingsStore(state => state.localCastTheme) || 'default';
    const setStoreLocalCastTheme = useSettingsStore(state => state.setLocalCastTheme);

    const activeCustomAccent = useSettingsStore(state => state.customAccentColor);
    const setStoreCustomAccent = useSettingsStore(state => state.setCustomAccentColor);

    // Hierarchy: VIP unlocks both SUPPORTER and VIP benefits
    const isSupporterOrVIP = userTier === 'SUPPORTER' || userTier === 'VIP';
    const isVip = userTier === 'VIP';

    const currentAccentColor = (isVip && activeCustomAccent) ? activeCustomAccent : '#8B5CF6';

    const [customColorMode, setCustomColorMode] = useState(false);
    const [customHexCode, setCustomHexCode] = useState(currentAccentColor);

    const setHexOnJS = (hex: string) => setCustomHexCode(hex);

    const handleAccentSelect = (hexColor: string) => {
        if (!isVip && hexColor.toUpperCase() !== '#8B5CF6') {
            Alert.alert(
                t('support.vip_benefits_locked_title'),
                t('support.vip_benefits_locked_desc')
            );
            return;
        }

        const targetColor = hexColor.toUpperCase() === '#8B5CF6' ? null : hexColor;
        setStoreCustomAccent(targetColor);
        Alert.alert(
            t('common.success'),
            t('support.accent_updated_success')
        );
    };

    React.useEffect(() => {
        if (Platform.OS === 'android' || Platform.OS === 'ios') {
            if (getAppIcon) {
                getAppIcon()
                    .then((currentIcon) => {
                        if (currentIcon && currentIcon !== activeAppIcon) {
                            setStoreAppIcon(currentIcon);
                        }
                    })
                    .catch((err) => {
                        console.warn('Failed to get current app icon:', err);
                    });
            }
        }
    }, []);

    const handleIconSelect = async (iconId: string) => {
        if (!isSupporterOrVIP && iconId !== 'DEFAULT') {
            Alert.alert(
                t('support.benefits_locked_title'),
                t('support.benefits_locked_desc')
            );
            return;
        }

        try {
            if (Platform.OS === 'android' || Platform.OS === 'ios') {
                const targetIconName = iconId === 'DEFAULT' ? null : iconId;
                const result = await setAppIcon(targetIconName, false);
                if (result === false) {
                    throw new Error('setAppIcon failed');
                }
            }
            setStoreAppIcon(iconId);
            Alert.alert(
                t('common.success'),
                t('support.icon_updated_success')
            );
        } catch (error) {
            console.error('Failed to set app icon:', error);
            Alert.alert(
                t('common.error'),
                t('support.icon_updated_error')
            );
        }
    };

    const handleStatsThemeSelect = (themeId: StatsCardTheme) => {
        if (!isVip && themeId !== 'default') {
            Alert.alert(
                t('support.vip_benefits_locked_title'),
                t('support.vip_benefits_locked_desc')
            );
            return;
        }

        setStoreStatsTheme(themeId);
        Alert.alert(
            t('common.success'),
            t('support.stats_card_updated_success')
        );
    };

    const handleLocalCastThemeSelect = (themeId: LocalCastTheme) => {
        if (!isVip && themeId !== 'default') {
            Alert.alert(
                t('support.vip_benefits_locked_title'),
                t('support.vip_benefits_locked_desc')
            );
            return;
        }

        setStoreLocalCastTheme(themeId);
        Alert.alert(
            t('common.success'),
            t('support.localcast_theme_updated_success')
        );
    };

    return (
        <View style={styles.container}>
            {/* ========================================================================= */}
            {/* 1. SECCIÓN SUPPORTER: ICONOS DE LA APLICACIÓN                            */}
            {/* ========================================================================= */}
            <View style={styles.supporterCard}>
                <View style={styles.badgeContainer}>
                    <Ionicons name="heart" size={12} color="#2DD4BF" style={{ marginRight: 4 }} />
                    <Text style={styles.badgeText}>{t('support.supporter.badge')}</Text>
                </View>

                <View style={styles.header}>
                    <Ionicons name="apps-outline" size={24} color="#2DD4BF" style={{ marginRight: 8 }} />
                    <Text style={[styles.title, { color: colors.text, fontFamily: fonts.bold }]}>
                        {t('support.app_icons_title')}
                    </Text>
                </View>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    {t('support.benefits_subtitle')}
                </Text>

                <View style={styles.grid}>
                    {ICONS.map((icon) => {
                        const isActive = activeAppIcon === icon.id;
                        const isLocked = !isSupporterOrVIP && icon.id !== 'DEFAULT';

                        return (
                            <TouchableOpacity
                                key={icon.id}
                                style={[
                                    styles.itemCard,
                                    { backgroundColor: colors.cardBackground },
                                    isActive && { borderColor: '#2DD4BF', borderWidth: 2 }
                                ]}
                                activeOpacity={0.7}
                                onPress={() => handleIconSelect(icon.id)}
                            >
                                <View style={styles.previewWrapper}>
                                    <Image source={icon.image} style={styles.iconImage} />
                                    
                                    {isLocked && (
                                        <View style={styles.lockedOverlay}>
                                            <View style={styles.lockIconContainer}>
                                                <MaterialCommunityIcons name="lock" size={20} color="#FFFFFF" />
                                            </View>
                                        </View>
                                    )}
                                </View>

                                <Text style={[
                                    styles.itemName,
                                    { color: colors.text },
                                    isActive && { color: '#2DD4BF', fontFamily: fonts.bold }
                                ]}>
                                    {t(icon.nameKey)}
                                </Text>

                                {isActive && (
                                    <View style={styles.activeBadge}>
                                        <Ionicons name="checkmark-circle" size={20} color="#2DD4BF" />
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* ========================================================================= */}
            {/* 2. SECCIÓN VIP: COLOR DE ACENTO DE LA APP                                 */}
            {/* ========================================================================= */}
            <View style={styles.vipCard}>
                <LinearGradient
                    colors={['rgba(245, 158, 11, 0.12)', 'rgba(0, 0, 0, 0)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                />

                <View style={styles.vipBadgeContainer}>
                    <MaterialCommunityIcons name="crown" size={13} color="#FBBF24" style={{ marginRight: 4 }} />
                    <Text style={styles.vipBadgeText}>{t('support.vip.badge')}</Text>
                </View>

                <View style={styles.header}>
                    <Ionicons name="color-palette-outline" size={24} color="#FBBF24" style={{ marginRight: 8 }} />
                    <Text style={[styles.title, { color: colors.text, fontFamily: fonts.bold }]}>
                        {t('support.accent_color_title')}
                    </Text>
                </View>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    {t('support.accent_color_subtitle')}
                </Text>

                {/* Active Accent Summary Chip */}
                <View style={[styles.activeAccentRow, { backgroundColor: colors.cardBackground }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={[styles.activeAccentSwatch, { backgroundColor: currentAccentColor }]} />
                        <View>
                            <Text style={[styles.activeAccentLabel, { color: colors.textSecondary }]}>
                                {t('support.accent_active_label')}
                            </Text>
                            <Text style={[styles.activeAccentHex, { color: colors.text }]}>
                                {currentAccentColor.toUpperCase()}
                            </Text>
                        </View>
                    </View>

                    {activeCustomAccent && (
                        <TouchableOpacity
                            style={styles.resetAccentBtn}
                            onPress={() => handleAccentSelect('#8B5CF6')}
                        >
                            <Ionicons name="refresh-outline" size={14} color="#FBBF24" style={{ marginRight: 4 }} />
                            <Text style={styles.resetAccentText}>{t('support.accent_reset_default')}</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* 4 Presets + Custom Color Button */}
                <View style={styles.accentPresetsGrid}>
                    {ACCENT_PRESETS.map((preset) => {
                        const isSelected = currentAccentColor.toUpperCase() === preset.color.toUpperCase() && !customColorMode;
                        const isLocked = !isVip && preset.isVipOnly;

                        return (
                            <TouchableOpacity
                                key={preset.id}
                                style={[
                                    styles.accentPresetCard,
                                    { backgroundColor: colors.cardBackground },
                                    isSelected && { borderColor: '#FBBF24', borderWidth: 2 }
                                ]}
                                activeOpacity={0.7}
                                onPress={() => {
                                    setCustomColorMode(false);
                                    handleAccentSelect(preset.color);
                                }}
                            >
                                <View style={[styles.accentCircle, { backgroundColor: preset.color }]}>
                                    {isSelected && (
                                        <Ionicons
                                            name="checkmark"
                                            size={18}
                                            color={getDynamicTagTextColor(preset.color)}
                                        />
                                    )}
                                    {isLocked && (
                                        <View style={styles.lockedOverlayCircle}>
                                            <MaterialCommunityIcons name="lock" size={14} color="#FFFFFF" />
                                        </View>
                                    )}
                                </View>
                                <Text style={[styles.accentPresetName, { color: colors.text }, isSelected && { color: '#FBBF24', fontFamily: fonts.bold }]} numberOfLines={1}>
                                    {t(preset.nameKey)}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}

                    {/* Custom HEX Trigger Button */}
                    <TouchableOpacity
                        style={[
                            styles.accentPresetCard,
                            { backgroundColor: colors.cardBackground },
                            customColorMode && { borderColor: '#FBBF24', borderWidth: 2 }
                        ]}
                        activeOpacity={0.7}
                        onPress={() => {
                            if (!isVip) {
                                Alert.alert(
                                    t('support.vip_benefits_locked_title'),
                                    t('support.vip_benefits_locked_desc')
                                );
                                return;
                            }
                            setCustomColorMode(!customColorMode);
                        }}
                    >
                        <View style={[styles.accentCircle, { backgroundColor: customColorMode || !ACCENT_PRESETS.some(p => p.color.toUpperCase() === currentAccentColor.toUpperCase()) ? currentAccentColor : '#333333' }]}>
                            <Ionicons name="color-palette" size={18} color="#FFFFFF" />
                            {!isVip && (
                                <View style={styles.lockedOverlayCircle}>
                                    <MaterialCommunityIcons name="lock" size={14} color="#FFFFFF" />
                                </View>
                            )}
                        </View>
                        <Text style={[styles.accentPresetName, { color: colors.text }, customColorMode && { color: '#FBBF24', fontFamily: fonts.bold }]} numberOfLines={1}>
                            {t('support.accent_custom')}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Expanded ColorPicker Mode */}
                {customColorMode && (
                    <View style={[styles.customColorPickerContainer, { backgroundColor: colors.cardBackground }]}>
                        <View style={styles.pickerHeaderRow}>
                            <View style={[styles.pickerPreviewDot, { backgroundColor: customHexCode || currentAccentColor }]} />
                            <Text style={[styles.pickerHexText, { color: colors.text }]}>
                                {(customHexCode || currentAccentColor).toUpperCase()}
                            </Text>
                        </View>

                        <ColorPicker
                            style={{ width: '100%', justifyContent: 'center' }}
                            value={customHexCode || currentAccentColor}
                            onComplete={(result: { hex: string }) => {
                                'worklet';
                                scheduleOnRN(setHexOnJS, result.hex);
                            }}
                        >
                            <Panel1 style={{ height: 160, borderRadius: 12 }} />
                            <HueSlider style={{ marginTop: 14, borderRadius: 10 }} />
                            <Swatches style={{ marginTop: 14 }} />
                        </ColorPicker>

                        <TouchableOpacity
                            style={[styles.applyAccentBtn, { backgroundColor: customHexCode || colors.accent }]}
                            activeOpacity={0.8}
                            onPress={() => {
                                handleAccentSelect(customHexCode || currentAccentColor);
                                setCustomColorMode(false);
                            }}
                        >
                            <Ionicons
                                name="checkmark-circle"
                                size={18}
                                color={getDynamicTagTextColor(customHexCode || colors.accent)}
                                style={{ marginRight: 6 }}
                            />
                            <Text style={[styles.applyAccentBtnText, { color: getDynamicTagTextColor(customHexCode || colors.accent) }]}>
                                {t('support.accent_confirm_color')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* ========================================================================= */}
            {/* 3. SECCIÓN VIP: ESTADÍSTICAS PREMIUM                                      */}
            {/* ========================================================================= */}
            <View style={styles.vipCard}>
                <LinearGradient
                    colors={['rgba(245, 158, 11, 0.12)', 'rgba(0, 0, 0, 0)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                />

                <View style={styles.vipBadgeContainer}>
                    <MaterialCommunityIcons name="crown" size={13} color="#FBBF24" style={{ marginRight: 4 }} />
                    <Text style={styles.vipBadgeText}>{t('support.vip.badge')}</Text>
                </View>

                <View style={styles.header}>
                    <Ionicons name="stats-chart" size={24} color="#FBBF24" style={{ marginRight: 8 }} />
                    <Text style={[styles.title, { color: colors.text, fontFamily: fonts.bold }]}>
                        {t('support.stats_cards_title')}
                    </Text>
                </View>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    {t('support.stats_cards_subtitle')}
                </Text>

                <View style={styles.grid}>
                    {STATS_THEMES.map((theme) => {
                        const isActive = activeStatsTheme === theme.id;
                        const isLocked = theme.isVipOnly && !isVip;

                        return (
                            <TouchableOpacity
                                key={theme.id}
                                style={[
                                    styles.itemCard,
                                    { backgroundColor: colors.cardBackground },
                                    isActive && { borderColor: '#FBBF24', borderWidth: 2 }
                                ]}
                                activeOpacity={0.7}
                                onPress={() => handleStatsThemeSelect(theme.id)}
                            >
                                {/* Miniature Preview of the Share Card */}
                                <View style={styles.previewWrapper}>
                                    <LinearGradient
                                        colors={theme.colors}
                                        start={{ x: 0.8, y: 0.1 }}
                                        end={{ x: 0.1, y: 0.9 }}
                                        style={styles.statsPreviewBox}
                                    >
                                        {/* Mini Brand Badge */}
                                        <View style={[styles.miniStatsBadge, { backgroundColor: theme.accent }]}>
                                            <Text style={styles.miniStatsBadgeText}>{theme.badgeText}</Text>
                                        </View>

                                        {/* Mini Content Dots */}
                                        <View style={styles.miniStatsContentRow}>
                                            <View style={[styles.miniStatsCircle, { borderColor: theme.accent }]} />
                                            <View style={[styles.miniStatsCircle, { borderColor: theme.accent, opacity: 0.8 }]} />
                                            <View style={[styles.miniStatsCircle, { borderColor: theme.accent, opacity: 0.6 }]} />
                                        </View>

                                        {/* Mini Stat Accent Line */}
                                        <View style={[styles.miniStatsBar, { backgroundColor: theme.accent }]} />
                                    </LinearGradient>

                                    {isLocked && (
                                        <View style={styles.lockedOverlay}>
                                            <View style={styles.vipLockIconContainer}>
                                                <MaterialCommunityIcons name="lock" size={20} color="#FFFFFF" />
                                            </View>
                                        </View>
                                    )}
                                </View>

                                <Text style={[
                                    styles.itemName,
                                    { color: colors.text },
                                    isActive && { color: '#FBBF24', fontFamily: fonts.bold }
                                ]}>
                                    {t(theme.nameKey)}
                                </Text>

                                <Text style={[styles.itemDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                                    {t(theme.descKey)}
                                </Text>

                                {isActive && (
                                    <View style={styles.activeBadge}>
                                        <Ionicons name="checkmark-circle" size={20} color="#FBBF24" />
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* ========================================================================= */}
            {/* 3. SECCIÓN VIP: ESTILOS DE LOCAL CAST                                     */}
            {/* ========================================================================= */}
            <View style={styles.vipCard}>
                <LinearGradient
                    colors={['rgba(245, 158, 11, 0.12)', 'rgba(0, 0, 0, 0)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                />

                <View style={styles.vipBadgeContainer}>
                    <MaterialCommunityIcons name="crown" size={13} color="#FBBF24" style={{ marginRight: 4 }} />
                    <Text style={styles.vipBadgeText}>{t('support.vip.badge')}</Text>
                </View>

                <View style={styles.header}>
                    <Ionicons name="tv-outline" size={24} color="#FBBF24" style={{ marginRight: 8 }} />
                    <Text style={[styles.title, { color: colors.text, fontFamily: fonts.bold }]}>
                        {t('support.localcast_themes_title')}
                    </Text>
                </View>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    {t('support.localcast_themes_subtitle')}
                </Text>

                <View style={styles.grid}>
                    {LOCALCAST_THEMES.map((theme) => {
                        const isActive = activeLocalCastTheme === theme.id;
                        const isLocked = theme.isVipOnly && !isVip;

                        return (
                            <TouchableOpacity
                                key={theme.id}
                                style={[
                                    styles.itemCard,
                                    { backgroundColor: colors.cardBackground },
                                    isActive && { borderColor: '#FBBF24', borderWidth: 2 }
                                ]}
                                activeOpacity={0.7}
                                onPress={() => handleLocalCastThemeSelect(theme.id)}
                            >
                                {/* Miniature Preview of LocalCast Web Player */}
                                <View style={styles.previewWrapper}>
                                    <LinearGradient
                                        colors={theme.colors}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={styles.localCastPreviewBox}
                                    >
                                        <View style={styles.miniLcRow}>
                                            <View style={[styles.miniLcCover, { backgroundColor: theme.accent }]} />
                                            <View style={styles.miniLcLines}>
                                                <View style={[styles.miniLcLine1, { backgroundColor: '#FFFFFF' }]} />
                                                <View style={[styles.miniLcLine2, { backgroundColor: theme.subAccent }]} />
                                            </View>
                                        </View>
                                        <View style={styles.miniLcProgressContainer}>
                                            <View style={[styles.miniLcProgressFill, { backgroundColor: '#FFFFFF' }]} />
                                        </View>
                                    </LinearGradient>

                                    {isLocked && (
                                        <View style={styles.lockedOverlay}>
                                            <View style={styles.vipLockIconContainer}>
                                                <MaterialCommunityIcons name="lock" size={20} color="#FFFFFF" />
                                            </View>
                                        </View>
                                    )}
                                </View>

                                <Text style={[
                                    styles.itemName,
                                    { color: colors.text },
                                    isActive && { color: '#FBBF24', fontFamily: fonts.bold }
                                ]}>
                                    {t(theme.nameKey)}
                                </Text>

                                <Text style={[styles.itemDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                                    {t(theme.descKey)}
                                </Text>

                                {isActive && (
                                    <View style={styles.activeBadge}>
                                        <Ionicons name="checkmark-circle" size={20} color="#FBBF24" />
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 10,
        marginBottom: 40,
    },
    // Supporter Card Style (Teal)
    supporterCard: {
        backgroundColor: 'rgba(45, 212, 191, 0.08)',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(45, 212, 191, 0.2)',
        marginBottom: 20,
    },
    badgeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(45, 212, 191, 0.15)',
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginBottom: 16,
    },
    badgeText: {
        color: '#2DD4BF',
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    // VIP Card Style (Gold / Yellow)
    vipCard: {
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.25)',
        marginBottom: 20,
        overflow: 'hidden',
        position: 'relative',
    },
    vipBadgeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(245, 158, 11, 0.18)',
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.35)',
    },
    vipBadgeText: {
        color: '#FBBF24',
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    title: {
        fontSize: 20,
    },
    subtitle: {
        fontSize: 14,
        marginBottom: 20,
        lineHeight: 20,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 16,
    },
    itemCard: {
        width: '47%',
        borderRadius: 16,
        padding: 14,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
        position: 'relative',
        marginBottom: 8,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    previewWrapper: {
        position: 'relative',
        width: 72,
        height: 72,
        marginBottom: 10,
        borderRadius: 16,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconImage: {
        width: 72,
        height: 72,
        borderRadius: 16,
    },
    // Mini Stats Preview
    statsPreviewBox: {
        width: 72,
        height: 72,
        borderRadius: 16,
        padding: 6,
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    miniStatsBadge: {
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    miniStatsBadgeText: {
        color: '#FFFFFF',
        fontSize: 7,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    miniStatsContentRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 4,
    },
    miniStatsCircle: {
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 1.5,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    miniStatsBar: {
        height: 3,
        width: '80%',
        borderRadius: 2,
        alignSelf: 'center',
    },
    // Mini LocalCast Preview
    localCastPreviewBox: {
        width: 72,
        height: 72,
        borderRadius: 16,
        padding: 8,
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    miniLcRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    miniLcCover: {
        width: 22,
        height: 22,
        borderRadius: 5,
    },
    miniLcLines: {
        flex: 1,
        gap: 3,
    },
    miniLcLine1: {
        height: 4,
        width: '100%',
        borderRadius: 2,
        opacity: 0.9,
    },
    miniLcLine2: {
        height: 3,
        width: '60%',
        borderRadius: 2,
        opacity: 0.7,
    },
    miniLcProgressContainer: {
        height: 3,
        width: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    miniLcProgressFill: {
        height: '100%',
        width: '55%',
        borderRadius: 2,
    },
    itemName: {
        fontSize: 14,
        textAlign: 'center',
        fontWeight: '700',
    },
    itemDesc: {
        fontSize: 11,
        textAlign: 'center',
        marginTop: 2,
    },
    lockedOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    lockIconContainer: {
        backgroundColor: 'rgba(20, 184, 166, 0.4)',
        padding: 7,
        borderRadius: 18,
    },
    vipLockIconContainer: {
        backgroundColor: 'rgba(245, 158, 11, 0.45)',
        padding: 7,
        borderRadius: 18,
    },
    activeBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#1E1E1E',
        borderRadius: 12,
    },
    // Accent Color Styles
    activeAccentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    activeAccentSwatch: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    activeAccentLabel: {
        fontSize: 11,
        fontWeight: '600',
    },
    activeAccentHex: {
        fontSize: 15,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    resetAccentBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    resetAccentText: {
        color: '#FBBF24',
        fontSize: 12,
        fontWeight: '700',
    },
    accentPresetsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 8,
    },
    accentPresetCard: {
        width: '18%',
        aspectRatio: 0.85,
        borderRadius: 14,
        padding: 4,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
        position: 'relative',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    accentCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
        position: 'relative',
    },
    lockedOverlayCircle: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        borderRadius: 17,
        justifyContent: 'center',
        alignItems: 'center',
    },
    accentPresetName: {
        fontSize: 10,
        textAlign: 'center',
        fontWeight: '600',
    },
    customColorPickerContainer: {
        marginTop: 16,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    pickerHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 14,
    },
    pickerPreviewDot: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
    },
    pickerHexText: {
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    applyAccentBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        marginTop: 16,
        elevation: 3,
    },
    applyAccentBtnText: {
        fontSize: 14,
        fontWeight: '800',
    },
});
