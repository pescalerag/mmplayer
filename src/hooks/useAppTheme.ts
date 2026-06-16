import { Colors, Layout, Typography, Spacing, Radii, FontWeights, Shadows, NavigationThemeDark } from '../theme/theme';
import { Fonts } from '../theme/fonts';

export function useAppTheme() {
  const colors = Colors;

  return {
    colors,
    fonts: Fonts,
    layout: Layout,
    typography: Typography,
    spacing: Spacing,
    radii: Radii,
    fontWeights: FontWeights,
    shadows: Shadows,
    navigationTheme: NavigationThemeDark,
    isDark: true,
  };
}
