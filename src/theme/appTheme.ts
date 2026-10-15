export type AppTheme = 'none' | 'legendary' | 'develETSII';

export function normalizeAppTheme(theme: unknown): AppTheme {
  return theme === 'legendary' || theme === 'develETSII' ? theme : 'none';
}

export function resolveAppTheme(theme: unknown, tier: string, ignoreTheme = false): AppTheme {
  if (ignoreTheme || (tier !== 'SUPPORTER' && tier !== 'VIP')) return 'none';
  return normalizeAppTheme(theme);
}

export function getAppThemeIcon(theme: AppTheme) {
  if (theme === 'legendary') return 'legend';
  if (theme === 'develETSII') return 'develpink';
  return null;
}
