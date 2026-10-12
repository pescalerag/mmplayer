import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../hooks/useAppTheme';
import { ActivityChartStats, getChartTotals } from '../../../utils/activityCharts';
import { ActivityChartCard } from './ActivityChartCard';

export function ActivityChartTotals({ stats }: { readonly stats: ActivityChartStats }) {
  const { t } = useTranslation();
  const { colors, fonts } = useAppTheme();
  const locale = t('activity.locale_code');
  const totals = getChartTotals(stats.hours);
  return (
    <ActivityChartCard title={t('activity.charts.totals')}>
      <View style={styles.row}>
        <View style={styles.item}>
          <Text style={[styles.value, { color: colors.accentLight, fontFamily: fonts.bold }]}>{(totals.seconds / 3600).toLocaleString(locale, { maximumFractionDigits: 1 })} {t('activity.hour_suffix')}</Text>
          <Text style={{ color: colors.textSecondary, fontFamily: fonts.regular }}>{t('activity.charts.listening_time')}</Text>
        </View>
        <View style={styles.item}>
          <Text style={[styles.value, { color: colors.accentLight, fontFamily: fonts.bold }]}>{totals.plays.toLocaleString(locale)}</Text>
          <Text style={{ color: colors.textSecondary, fontFamily: fonts.regular }}>{t('activity.charts.play_count')}</Text>
        </View>
      </View>
    </ActivityChartCard>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 12 }, item: { flex: 1, gap: 6 }, value: { fontSize: 24 } });
