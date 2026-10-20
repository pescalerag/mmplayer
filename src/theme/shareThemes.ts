import type { StatsCardTheme, LocalCastTheme } from '../store/useSettingsStore';

export interface StatsThemeOption {
    id: StatsCardTheme;
    nameKey: string;
    descKey: string;
    colors: [string, string, string];
    accent: string;
    badgeText: string;
    isVipOnly: boolean;
}

export const STATS_THEMES: StatsThemeOption[] = [
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

export interface LocalCastThemeOption {
    id: LocalCastTheme;
    nameKey: string;
    descKey: string;
    colors: [string, string, string];
    accent: string;
    subAccent: string;
    isVipOnly: boolean;
}

export const LOCALCAST_THEMES: LocalCastThemeOption[] = [
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
    {
        id: 'cover',
        nameKey: 'support.localcast_theme_cover',
        descKey: 'support.localcast_theme_cover_desc',
        colors: ['#17252b', '#34565a', '#b78a53'],
        accent: '#E3BA86',
        subAccent: '#75B6B2',
        isVipOnly: true,
    },

];

