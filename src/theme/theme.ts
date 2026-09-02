/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';
import { DefaultTheme as NavigationDefaultTheme, DarkTheme as NavigationDarkTheme } from '@react-navigation/native';
import { hexToRgba, lightenColor } from '../utils/color';

const tintColorDark = '#fff';

export const DEFAULT_ACCENT_COLOR = '#8B5CF6';

export function getAppColors(customAccent?: string | null) {
  const accent = customAccent || DEFAULT_ACCENT_COLOR;
  const accentLight = lightenColor(accent, 0.22);

  return {
    text: '#ECEDEE',
    textSecondary: '#9BA1A6',
    disabled: '#535353',
    background: '#0F0F0F', // Un negro ligeramente grisáceo para mejorar la legibilidad
    cardBackground: '#1E1E1E',
    heartIcon: '#EF4444',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    accent: accent,
    accentLight: accentLight,
    accentAlpha5: hexToRgba(accent, 0.05),
    accentAlpha8: hexToRgba(accent, 0.08),
    accentAlpha10: hexToRgba(accent, 0.1),
    accentAlpha15: hexToRgba(accent, 0.15),
    accentAlpha18: hexToRgba(accent, 0.18),
    accentAlpha20: hexToRgba(accent, 0.2),
    accentAlpha30: hexToRgba(accent, 0.3),
    accentAlpha40: hexToRgba(accent, 0.4),
    accentLightAlpha12: hexToRgba(accentLight, 0.12),
    accentLightAlpha30: hexToRgba(accentLight, 0.3),
    accentLightAlpha35: hexToRgba(accentLight, 0.35),
    overlayAlpha02: 'rgba(255, 255, 255, 0.02)',
    overlayAlpha03: 'rgba(255, 255, 255, 0.03)',
    overlayAlpha04: 'rgba(255, 255, 255, 0.04)',
    overlayAlpha05: 'rgba(255, 255, 255, 0.05)',
    overlayAlpha08: 'rgba(255, 255, 255, 0.08)',
    overlayAlpha10: 'rgba(255, 255, 255, 0.1)',
    overlayAlpha15: 'rgba(255, 255, 255, 0.15)',
    overlayAlpha20: 'rgba(255, 255, 255, 0.2)',
  };
}

export const Colors = getAppColors();

import { Fonts } from './fonts';

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const Radii = {
  sm: 4,
  md: 8,
  lg: 12,
  full: 9999,
};

export const FontWeights = {
  regular: '400',
  semiBold: '600',
  bold: '700',
} as const;

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.44,
    shadowRadius: 10.32,
    elevation: 16,
  },
};

export const Typography = {
  default: {
    fontFamily: Fonts.regular,
    fontWeight: FontWeights.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  title: {
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
    fontSize: 24,
    lineHeight: 32,
  },
  subtitle: {
    fontFamily: Fonts.bold,
    fontWeight: FontWeights.bold,
    fontSize: 18,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontFamily: Fonts.semiBold, // Using semiBold font file alias
    fontWeight: FontWeights.semiBold,
    fontSize: 16,
    lineHeight: 24,
  },
  link: {
    fontFamily: Fonts.regular,
    fontWeight: FontWeights.regular,
    fontSize: 14,
    lineHeight: 20,
  },
};

export const Layout = {
  MINI_PLAYER_HEIGHT: 64,
  TAB_BAR_HEIGHT: 60,
  PLAYER_MARGIN: 36,
};

export const NavigationThemeDark = {
  ...NavigationDarkTheme,
  colors: {
    ...NavigationDarkTheme.colors,
    primary: Colors.tint,
    background: Colors.background,
    card: Colors.cardBackground,
    text: Colors.text,
    border: Colors.overlayAlpha10,
    notification: Colors.accent,
  },
};
