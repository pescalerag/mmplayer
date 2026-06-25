import { StyleSheet, Text, type TextProps } from 'react-native';

import { useAppTheme } from '@/hooks/useAppTheme';
import { Colors, Typography } from '@/theme/theme';
import React from 'react';

export type ThemeColorName = keyof typeof Colors;

export type ThemedTextProps = TextProps & {
  colorName?: ThemeColorName;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  colorName,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const { colors } = useAppTheme();
  const color = colorName ? colors[colorName] : colors.text;

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    ...Typography.default,
  },
  defaultSemiBold: {
    ...Typography.defaultSemiBold,
  },
  title: {
    ...Typography.title,
  },
  subtitle: {
    ...Typography.subtitle,
  },
  link: {
    ...Typography.link,
    color: Colors.tint,
  },
});
