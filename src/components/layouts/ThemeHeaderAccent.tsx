import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Pattern, Mask, Rect, Path } from 'react-native-svg';
import { useAppTheme } from '../../hooks/useAppTheme';

export function ThemeHeaderAccent() {
  const { isLegendaryTheme, isRetroTheme, colors } = useAppTheme();
  if (!isLegendaryTheme && !isRetroTheme) return null;
  if (isRetroTheme) {
    return (
      <View pointerEvents="none" accessible={false} style={styles.container}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="crtFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="white" />
              <Stop offset="1" stopColor="black" />
            </LinearGradient>
            <Mask id="crtMask"><Rect width="100%" height="100%" fill="url(#crtFade)" /></Mask>
            <Pattern id="crtScanlines" width="4" height="4" patternUnits="userSpaceOnUse">
              <Rect width="4" height="1" fill={colors.accent} opacity={0.09} />
            </Pattern>
            <LinearGradient id="crtEdge" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.accent} stopOpacity={0} />
              <Stop offset="0.35" stopColor={colors.accent} stopOpacity={0.45} />
              <Stop offset="0.7" stopColor={colors.accentSecondary} stopOpacity={0.35} />
              <Stop offset="1" stopColor={colors.accentSecondary} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#crtScanlines)" mask="url(#crtMask)" />
          <Rect x="8%" y="2" width="84%" height="1" fill="url(#crtEdge)" />
        </Svg>
      </View>
    );
  }
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
