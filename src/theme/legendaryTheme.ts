import { getAppColors } from './theme';

// A quiet forest palette with aged brass details and warm, readable text.
export const LEGENDARY_PALETTE = {
  background: '#0A1511',
  card: '#15271F',
  sheet: '#192E24',
  inset: '#101F18',
  border: '#354B3B',
  gold: '#C9AA64',
  goldLight: '#E7D7A9',
  bronze: '#89703F',
  jade: '#75A58A',
  text: '#F3EDDF',
  secondaryText: '#B6C3B5',
} as const;

export const DEFAULT_GRADIENTS = {
  header: ['#000000', 'rgba(0,0,0,0.9)', 'rgba(0,0,0,0.7)', 'transparent'],
  navigation: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.65)', 'rgba(0,0,0,0.90)', 'rgba(0,0,0,0.98)', '#0F0F0F'],
} as const;

export const LEGENDARY_GRADIENTS = {
  header: ['#0A1511', 'rgba(10,21,17,0.94)', 'rgba(10,21,17,0.75)', 'transparent'],
  navigation: ['rgba(10,21,17,0)', 'rgba(10,21,17,0.65)', 'rgba(10,21,17,0.90)', 'rgba(10,21,17,0.98)', '#0A1511'],
} as const;

export function getLegendaryColors() {
  const base = getAppColors(LEGENDARY_PALETTE.gold);
  return {
    ...base,
    background: LEGENDARY_PALETTE.background,
    cardBackground: LEGENDARY_PALETTE.card,
    sheetBackground: LEGENDARY_PALETTE.sheet,
    inputBackground: LEGENDARY_PALETTE.inset,
    border: LEGENDARY_PALETTE.border,
    text: LEGENDARY_PALETTE.text,
    textSecondary: LEGENDARY_PALETTE.secondaryText,
    disabled: '#647569',
    icon: '#9EAD9D',
    tint: LEGENDARY_PALETTE.gold,
    tabIconSelected: LEGENDARY_PALETTE.gold,
    tabIconDefault: '#8B9E8D',
    accentSecondary: LEGENDARY_PALETTE.jade,
    overlayAlpha08: 'rgba(231, 215, 169, 0.08)',
    overlayAlpha10: 'rgba(231, 215, 169, 0.10)',
    overlayAlpha15: 'rgba(231, 215, 169, 0.15)',
  };
}

export function isLegendaryThemeEnabled(theme: string, tier: string, ignoreTheme = false) {
  return !ignoreTheme && theme === 'legendary' && (tier === 'SUPPORTER' || tier === 'VIP');
}
