import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '@/hooks/useAppTheme';

interface ABRepeatIconProps {
  pointA: number | null;
  pointB: number | null;
  disabled?: boolean;
  size?: number;
}

export const ABRepeatIcon: React.FC<ABRepeatIconProps> = ({
  pointA,
  pointB,
  disabled = false,
  size = 24,
}) => {
  const { colors, fonts } = useAppTheme();

  const isAActive = !disabled && pointA !== null;
  const isBActive = !disabled && pointB !== null;

  const colorA = disabled
    ? colors.disabled
    : isAActive
    ? colors.accentLight
    : colors.textSecondary;

  const colorB = disabled
    ? colors.disabled
    : isBActive
    ? colors.accentLight
    : colors.textSecondary;

  const activeGlow = {
    textShadowColor: colors.accentAlpha40 || 'rgba(167, 139, 250, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  };

  const fontSize = Math.round(size * 0.58);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Text
        style={[
          styles.letter,
          {
            fontSize,
            fontFamily: fonts.bold,
            color: colorA,
            opacity: disabled ? 0.5 : isAActive ? 1 : 0.65,
          },
          isAActive && activeGlow,
        ]}
      >
        A
      </Text>
      <Text
        style={[
          styles.letter,
          {
            fontSize,
            fontFamily: fonts.bold,
            color: colorB,
            opacity: disabled ? 0.5 : isBActive ? 1 : 0.65,
          },
          isBActive && activeGlow,
        ]}
      >
        B
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontWeight: '800',
    includeFontPadding: false,
    textAlignVertical: 'center',
    letterSpacing: -0.5,
  },
});

export default ABRepeatIcon;
