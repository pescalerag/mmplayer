import { useMemo } from 'react';
import { getAppColors, Layout, Typography, Spacing, Radii, FontWeights, Shadows, NavigationThemeDark } from '../theme/theme';
import { Fonts } from '../theme/fonts';
import { useSettingsStore } from '../store/useSettingsStore';
import { getLegendaryColors, LEGENDARY_PALETTE, DEFAULT_GRADIENTS, LEGENDARY_GRADIENTS } from '../theme/legendaryTheme';
import { DEVEL_GRADIENTS, DEVEL_HEADER_GLOW, getDevelColors } from '../theme/develTheme';
import { resolveAppTheme } from '../theme/appTheme';

export const LEGENDARY_ACCENT = LEGENDARY_PALETTE.gold;

interface UseAppThemeOptions {
  ignoreTheme?: boolean;
}

export function useAppTheme(options?: UseAppThemeOptions) {
  const userTier = useSettingsStore(state => state.userTier);
  const customAccentColor = useSettingsStore(state => state.customAccentColor);
  const activeAppTheme = useSettingsStore(state => state.activeAppTheme);
  const isVip = userTier === 'VIP';
  const appTheme = resolveAppTheme(activeAppTheme, userTier, options?.ignoreTheme);
  const isLegendaryTheme = appTheme === 'legendary';
  const isDevelTheme = appTheme === 'develETSII';

  const effectiveAccent = appTheme === 'none' && isVip && customAccentColor ? customAccentColor : null;


  const colors = useMemo(() => {
    if (appTheme === 'legendary') return getLegendaryColors();
    if (appTheme === 'develETSII') return getDevelColors();
    return getAppColors(effectiveAccent);
  }, [effectiveAccent, appTheme]);

  let gradients = DEFAULT_GRADIENTS as typeof DEFAULT_GRADIENTS | typeof LEGENDARY_GRADIENTS | typeof DEVEL_GRADIENTS;
  if (isLegendaryTheme) gradients = LEGENDARY_GRADIENTS;
  if (isDevelTheme) gradients = DEVEL_GRADIENTS;

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
    gradients,
    headerGlow: isDevelTheme ? DEVEL_HEADER_GLOW : [colors.accentAlpha20, 'transparent'] as const,
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
    isDevelTheme,
    appTheme,
  };
}
