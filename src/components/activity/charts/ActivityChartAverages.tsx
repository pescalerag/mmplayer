import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActivityChartStats } from '../../../utils/activityCharts';
import { useAppTheme } from '../../../hooks/useAppTheme';

function AverageCard({ value, label }: { readonly value: string; readonly label: string }) {
  const { colors, fonts, radii } = useAppTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.accentAlpha8, borderRadius: radii.lg }]}>
      <Text style={[styles.value, { color: colors.accentLight, fontFamily: fonts.bold }]}>{value}</Text>
      <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{label}</Text>
    </View>
  );
}

export function ActivityChartAverages({ stats }: { readonly stats: ActivityChartStats }) {
  const { t } = useTranslation();
  const locale = t('activity.locale_code');
  return (
    <View style={styles.row}>
      <AverageCard value={stats.averageMinutes.toLocaleString(locale, { maximumFractionDigits: 1 })} label={t('activity.charts.average_minutes')} />
      <AverageCard value={stats.averagePlays.toLocaleString(locale, { maximumFractionDigits: 1 })} label={t('activity.charts.average_plays')} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  card: { flex: 1, padding: 16, gap: 6 },
  value: { fontSize: 26 },
  label: { fontSize: 12, lineHeight: 18 },
});
