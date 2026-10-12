import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../../../hooks/useAppTheme';

interface Props {
  readonly title: string;
  readonly children: React.ReactNode;
}

export function ActivityChartCard({ title, children }: Props) {
  const { colors, fonts, radii } = useAppTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.overlayAlpha03, borderColor: colors.overlayAlpha05, borderRadius: radii.lg }]}>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.bold }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderWidth: 1, gap: 14 },
  title: { fontSize: 16 },
});
