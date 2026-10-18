import { getRetroColors, RETRO_PALETTE, RETRO_GRADIENTS } from '../theme/retroTheme';
import { getLegendaryColors, isLegendaryThemeEnabled, LEGENDARY_PALETTE } from '../theme/legendaryTheme';
import { getDevelColors, DEVEL_PALETTE } from '../theme/develTheme';
import { getAppThemeIcon, normalizeAppTheme, resolveAppTheme } from '../theme/appTheme';

jest.mock('@react-navigation/native', () => ({ DefaultTheme: {}, DarkTheme: { colors: {} } }));
jest.mock('../theme/fonts', () => ({ Fonts: {} }));

function luminance(hex: string) {
  const channels = [1, 3, 5].map(offset => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe('legendary appearance', () => {
  it.each(['SUPPORTER', 'VIP'])('unlocks the theme for %s', tier => {
    expect(isLegendaryThemeEnabled('legendary', tier)).toBe(true);
    expect(isLegendaryThemeEnabled('legendary', tier, true)).toBe(false);
  });

  it('keeps the default appearance for standard users and unsupported themes', () => {
    expect(isLegendaryThemeEnabled('legendary', 'USER')).toBe(false);
    expect(isLegendaryThemeEnabled('none', 'VIP')).toBe(false);
    expect(isLegendaryThemeEnabled('unknown', 'SUPPORTER')).toBe(false);
  });

  it('keeps body text, secondary text and accented controls readable on every surface', () => {
    const colors = getLegendaryColors();
    for (const surface of [colors.background, colors.cardBackground, colors.sheetBackground, colors.inputBackground]) {
      for (const foreground of [colors.text, colors.textSecondary, colors.accent]) {
        expect(contrast(foreground, surface)).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrast(colors.onAccent, colors.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.onAccentLight, colors.accentLight)).toBeGreaterThanOrEqual(4.5);
    expect(colors.background).not.toBe('transparent');
    expect(colors.tabIconSelected).toBe(LEGENDARY_PALETTE.gold);
  });
});

describe('develETSII appearance', () => {
  it.each(['SUPPORTER', 'VIP'])('unlocks and retains develETSII for %s', tier => {
    expect(resolveAppTheme('develETSII', tier)).toBe('develETSII');
    expect(resolveAppTheme('develETSII', tier, true)).toBe('none');
  });

  it('rejects unknown themes and keeps premium appearance behind the tier requirement', () => {
    for (const theme of ['none', 'unknown', null, undefined]) expect(normalizeAppTheme(theme)).toBe('none');
    expect(normalizeAppTheme('develETSII')).toBe('develETSII');
    expect(resolveAppTheme('develETSII', 'USER')).toBe('none');
    expect(getAppThemeIcon('develETSII')).toBe('develpink');
    expect(getAppThemeIcon('legendary')).toBe('legend');
    expect(getAppThemeIcon('none')).toBeNull();
  });

  it('keeps text and coral controls readable across the plum surfaces', () => {
    const colors = getDevelColors();
    for (const surface of [colors.background, colors.cardBackground, colors.sheetBackground, colors.inputBackground]) {
      for (const foreground of [colors.text, colors.textSecondary, colors.accent, colors.accentSecondary]) {
        expect(contrast(foreground, surface)).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrast(colors.onAccent, colors.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.onAccentLight, colors.accentLight)).toBeGreaterThanOrEqual(4.5);
    expect(colors.background).toBe(DEVEL_PALETTE.background);
    expect(colors.tabIconSelected).toBe(DEVEL_PALETTE.coral);
  });
});


describe('Retro CRT appearance', () => {
  it.each(['SUPPORTER', 'VIP'])('retains the theme for %s while respecting access', tier => {
    expect(normalizeAppTheme('retro')).toBe('retro');
    expect(resolveAppTheme('retro', tier)).toBe('retro');
    expect(resolveAppTheme('retro', tier, true)).toBe('none');
    expect(resolveAppTheme('retro', 'USER')).toBe('none');
    expect(getAppThemeIcon('retro')).toBe('crt');
  });

  it('keeps text and both phosphor accents readable on all surfaces', () => {
    const colors = getRetroColors();
    for (const surface of [colors.background, colors.cardBackground, colors.sheetBackground, colors.inputBackground]) {
      for (const foreground of [colors.text, colors.textSecondary, colors.accent, colors.accentSecondary]) {
        expect(contrast(foreground, surface)).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrast(colors.onAccent, colors.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.onAccentLight, colors.accentLight)).toBeGreaterThanOrEqual(4.5);
    expect(colors.background).toBe(RETRO_PALETTE.background);
    expect(RETRO_GRADIENTS.navigation.at(-1)).toBe(colors.background);
  });
});
