import { useMemo } from 'react';
import { getAppColors, Layout, Typography, Spacing, Radii, FontWeights, Shadows, NavigationThemeDark } from '../theme/theme';
import { Fonts } from '../theme/fonts';
import { useSettingsStore } from '../store/useSettingsStore';
import { getLegendaryColors, isLegendaryThemeEnabled, LEGENDARY_PALETTE, DEFAULT_GRADIENTS, LEGENDARY_GRADIENTS } from '../theme/legendaryTheme';

export const LEGENDARY_ACCENT = LEGENDARY_PALETTE.gold;

interface UseAppThemeOptions {
  ignoreTheme?: boolean;
}

export function useAppTheme(options?: UseAppThemeOptions) {
  const userTier = useSettingsStore(state => state.userTier);
  const customAccentColor = useSettingsStore(state => state.customAccentColor);
  const activeAppTheme = useSettingsStore(state => state.activeAppTheme);
  const isVip = userTier === 'VIP';
  const isLegendaryTheme = isLegendaryThemeEnabled(activeAppTheme, userTier, options?.ignoreTheme);

  // Legendary theme overrides custom accent; custom accent only applies when no theme is active
  const effectiveAccent = isLegendaryTheme
    ? LEGENDARY_ACCENT
    : (isVip && customAccentColor ? customAccentColor : null);


  const colors = useMemo(() => {
    return isLegendaryTheme ? getLegendaryColors() : getAppColors(effectiveAccent);
  }, [effectiveAccent, isLegendaryTheme]);

  const navigationTheme = useMemo(() => ({
    ...NavigationThemeDark,
    colors: {
      ...NavigationThemeDark.colors,
      primary: colors.tint,
      background: colors.background,
      card: colors.cardBackground,
      text: colors.text,
      border: colors.border,
      notification: colors.accent,
    },
  }), [colors]);

  return {
    colors,
    gradients: isLegendaryTheme ? LEGENDARY_GRADIENTS : DEFAULT_GRADIENTS,
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
