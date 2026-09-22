import { useMemo } from 'react';
import { getAppColors, Layout, Typography, Spacing, Radii, FontWeights, Shadows, NavigationThemeDark } from '../theme/theme';
import { Fonts } from '../theme/fonts';
import { useSettingsStore } from '../store/useSettingsStore';

// Legendary theme accent colors: Triforce Gold as primary, Sacred Bronze as secondary
export const LEGENDARY_ACCENT = '#F5B800';
export const LEGENDARY_ACCENT_LIGHT = '#FDE047';
export const LEGENDARY_ACCENT_SECONDARY = '#78350F';
export const LEGENDARY_BG_IMAGE = require('../assets/images/legend-theme-bg.webp');

interface UseAppThemeOptions {
  ignoreTheme?: boolean;
}

export function useAppTheme(options?: UseAppThemeOptions) {
  const userTier = useSettingsStore(state => state.userTier);
  const customAccentColor = useSettingsStore(state => state.customAccentColor);
  const activeAppTheme = useSettingsStore(state => state.activeAppTheme);
  const isVip = userTier === 'VIP';
  const isSupporterOrVIP = userTier === 'SUPPORTER' || userTier === 'VIP';
  const isLegendaryTheme = !options?.ignoreTheme && activeAppTheme === 'legendary' && isSupporterOrVIP;

  // Legendary theme overrides custom accent; custom accent only applies when no theme is active
  const effectiveAccent = isLegendaryTheme
    ? LEGENDARY_ACCENT
    : (isVip && customAccentColor ? customAccentColor : null);


  const colors = useMemo(() => {
    const baseColors = getAppColors(effectiveAccent);
    if (isLegendaryTheme) {
      return {
        ...baseColors,
        background: 'transparent',
        accent: LEGENDARY_ACCENT,
        accentSecondary: LEGENDARY_ACCENT_SECONDARY,
        accentDark: LEGENDARY_ACCENT_SECONDARY,
        accentLight: LEGENDARY_ACCENT_LIGHT,
      };
    }
    return baseColors;
  }, [effectiveAccent, isLegendaryTheme]);

  const navigationTheme = useMemo(() => ({
    ...NavigationThemeDark,
    colors: {
      ...NavigationThemeDark.colors,
      primary: colors.tint,
      background: isLegendaryTheme ? 'transparent' : colors.background,
      card: isLegendaryTheme ? 'transparent' : colors.cardBackground,
      text: colors.text,
      border: colors.overlayAlpha10,
      notification: colors.accent,
    },
  }), [colors, isLegendaryTheme]);

  return {
    colors,
    fonts: Fonts,
    layout: Layout,
    typography: Typography,
    spacing: Spacing,
    radii: Radii,
    fontWeights: FontWeights,
    shadows: Shadows,
    navigationTheme,
    isDark: true,
    isLegendaryTheme,
  };
}
