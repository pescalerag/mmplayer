import { getAppColors } from './theme';

export const DEVEL_PALETTE = {
  background: '#171223',
  card: '#281E37',
  sheet: '#312440',
  inset: '#20172D',
  border: '#58436B',
  coral: '#F4A1B6',
  violet: '#B89AFF',
  text: '#F7F0FF',
  secondaryText: '#C9BED9',
} as const;

export const DEVEL_BRAND_GRADIENT = ['#F28B9B', '#BE74CE', '#8456F5'] as const;

export const DEVEL_HEADER_GLOW = ['rgba(242,139,155,0.22)', 'rgba(132,86,245,0.12)', 'rgba(23,18,35,0)'] as const;

export const DEVEL_GRADIENTS = {
  header: ['#21172E', 'rgba(23,18,35,0.96)', 'rgba(23,18,35,0.78)', 'rgba(23,18,35,0)'],
  navigation: ['rgba(23,18,35,0)', 'rgba(23,18,35,0.65)', 'rgba(23,18,35,0.90)', 'rgba(23,18,35,0.98)', '#171223'],
} as const;

export function getDevelColors() {
  return {
    ...getAppColors(DEVEL_PALETTE.coral),
    background: DEVEL_PALETTE.background,
    cardBackground: DEVEL_PALETTE.card,
    sheetBackground: DEVEL_PALETTE.sheet,
    inputBackground: DEVEL_PALETTE.inset,
    border: DEVEL_PALETTE.border,
    text: DEVEL_PALETTE.text,
    textSecondary: DEVEL_PALETTE.secondaryText,
    disabled: '#867394',
    icon: '#B8A6CC',
    tint: DEVEL_PALETTE.coral,
    tabIconSelected: DEVEL_PALETTE.coral,
    tabIconDefault: '#A794BE',
    accentSecondary: DEVEL_PALETTE.violet,
    overlayAlpha08: 'rgba(208, 181, 255, 0.08)',
    overlayAlpha10: 'rgba(208, 181, 255, 0.10)',
    overlayAlpha15: 'rgba(208, 181, 255, 0.15)',
  };
}
