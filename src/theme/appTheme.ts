export type AppTheme = 'none' | 'legendary' | 'develETSII' | 'retro';

export function normalizeAppTheme(theme: unknown): AppTheme {
  return theme === 'legendary' || theme === 'develETSII' || theme === 'retro' ? theme : 'none';
}

export function resolveAppTheme(theme: unknown, tier: string, ignoreTheme = false): AppTheme {
  if (ignoreTheme || (tier !== 'SUPPORTER' && tier !== 'VIP')) return 'none';
  return normalizeAppTheme(theme);
}

export function getAppThemeIcon(theme: AppTheme) {
  if (theme === 'legendary') return 'legend';
  if (theme === 'develETSII') return 'develpink';
  if (theme === 'retro') return 'crt';
  return null;
}
