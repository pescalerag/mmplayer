import { useMemo } from 'react';
import { getAppColors, Layout, Typography, Spacing, Radii, FontWeights, Shadows, NavigationThemeDark } from '../theme/theme';
import { Fonts } from '../theme/fonts';
import { useSettingsStore } from '../store/useSettingsStore';

export function useAppTheme() {
  const userTier = useSettingsStore(state => state.userTier);
  const customAccentColor = useSettingsStore(state => state.customAccentColor);
  const isVip = userTier === 'VIP';

  const effectiveAccent = isVip && customAccentColor ? customAccentColor : null;

  const colors = useMemo(() => getAppColors(effectiveAccent), [effectiveAccent]);

  const navigationTheme = useMemo(() => ({
    ...NavigationThemeDark,
    colors: {
      ...NavigationThemeDark.colors,
      primary: colors.tint,
      background: colors.background,
      card: colors.cardBackground,
      text: colors.text,
      border: colors.overlayAlpha10,
      notification: colors.accent,
    },
  }), [colors]);

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
  };
}
