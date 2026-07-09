import { View, type ViewProps } from 'react-native';

import { useAppTheme } from '@/hooks/useAppTheme';

import { Colors } from '@/theme/theme';

export type ThemeColorName = keyof typeof Colors;

export type ThemedViewProps = ViewProps & {
  colorName?: ThemeColorName;
};

export function ThemedView({ style, colorName, ...otherProps }: ThemedViewProps) {
  const { colors } = useAppTheme();
  const backgroundColor = colorName ? colors[colorName] : colors.background;

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
