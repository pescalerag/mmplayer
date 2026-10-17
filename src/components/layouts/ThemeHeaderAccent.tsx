import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useAppTheme } from '../../hooks/useAppTheme';

export function ThemeHeaderAccent() {
  const { isLegendaryTheme, colors } = useAppTheme();
  if (!isLegendaryTheme) return null;
  return (
    <View pointerEvents="none" accessible={false} style={styles.container}>
      <Svg width="100%" height="100%" viewBox="0 0 390 180" preserveAspectRatio="xMaxYMin slice">
        <Path
          d="M210 -30L390 150 M265 -30L420 125 M320 -30L420 70 M265 0L390 125 M390 15L265 140 M390 70L320 140 M240 140H378"
          stroke={colors.accent}
          strokeWidth={0.7}
          opacity={0.13}
          fill="none"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, right: 0, height: 180, zIndex: 3 },
});
