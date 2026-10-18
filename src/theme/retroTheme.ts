import { getAppColors } from './theme';

export const RETRO_PALETTE = {
  background: '#08090B',
  card: '#161416',
  sheet: '#1D191D',
  inset: '#0B0C0E',
  border: '#403132',
  amber: '#FF9A4B',
  violet: '#C08AFF',
  text: '#F4F2E9',
  secondaryText: '#BFB8AF',
} as const;

// Static phosphor glow only on screen headings; body text stays crisp.
export const RETRO_TITLE_GLOW = {
  textShadowColor: 'rgba(255,154,75,0.45)',
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: 4,
};

export const RETRO_HEADER_GLOW = ['rgba(255,154,75,0.16)', 'rgba(192,138,255,0.06)', 'rgba(8,9,11,0)'] as const;

export const RETRO_GRADIENTS = {
  header: ['#221713', 'rgba(8,9,11,0.96)', 'rgba(8,9,11,0.78)', 'rgba(8,9,11,0)'],
  navigation: ['rgba(8,9,11,0)', 'rgba(8,9,11,0.65)', 'rgba(8,9,11,0.90)', 'rgba(8,9,11,0.98)', '#08090B'],
} as const;

export function getRetroColors() {
  return {
    ...getAppColors(RETRO_PALETTE.amber),
    background: RETRO_PALETTE.background,
    cardBackground: RETRO_PALETTE.card,
    sheetBackground: RETRO_PALETTE.sheet,
    inputBackground: RETRO_PALETTE.inset,
    border: RETRO_PALETTE.border,
    text: RETRO_PALETTE.text,
    textSecondary: RETRO_PALETTE.secondaryText,
    disabled: '#827A78',
    icon: RETRO_PALETTE.secondaryText,
    tint: RETRO_PALETTE.amber,
    tabIconSelected: RETRO_PALETTE.amber,
    tabIconDefault: RETRO_PALETTE.secondaryText,
    accentSecondary: RETRO_PALETTE.violet,
    overlayAlpha08: 'rgba(255, 220, 182, 0.08)',
    overlayAlpha10: 'rgba(255, 220, 182, 0.10)',
    overlayAlpha15: 'rgba(255, 220, 182, 0.15)',
  };
}
