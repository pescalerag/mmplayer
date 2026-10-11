import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../hooks/useAppTheme';
import { useActivityCharts } from '../../../hooks/useActivityCharts';
import { useArtistChartPeriod } from '../../../hooks/useArtistChartPeriod';
import { ChartMetric } from '../../../utils/activityCharts';
import { ArtistChartControls } from './ArtistChartControls';
import { ActivityChartsResult } from './ActivityChartsTab';

export function ArtistStatisticsSection({ artistId }: { readonly artistId: string }) {
  const { colors, fonts } = useAppTheme();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [metric, setMetric] = useState<ChartMetric>('duration');
  const [firstDate, setFirstDate] = useState<Date | null>(null);
  const navigation = useArtistChartPeriod(firstDate, t);
  const range = navigation.dateRangeInfo;
  const charts = useActivityCharts(range.from, range.to, 0, artistId, expanded);
  let firstTime: number | null | undefined;
  if (charts.data) firstTime = charts.data.firstHistoryDate?.getTime() ?? null;
  useEffect(() => {
    if (firstTime === undefined) return;
    setFirstDate(firstTime === null ? null : new Date(firstTime));
  }, [firstTime]);
  return (
    <View style={styles.section}>
      <TouchableOpacity onPress={() => setExpanded(value => !value)} accessibilityRole="button" accessibilityState={{ expanded }} style={styles.heading}>
        <Text style={[styles.title, { color: colors.text, fontFamily: fonts.bold }]}>{t('activity.charts.artist_statistics')}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color={colors.textSecondary} />
      </TouchableOpacity>
      {expanded && (
        <>
          <ArtistChartControls navigation={navigation} metric={metric} onMetricChange={setMetric} />
          <View style={styles.content}>
            <ActivityChartsResult {...charts} period={navigation.period} metric={metric} contentKey={`${range.from?.getTime()}:${range.to.getTime()}`} showTotals />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({ section: { marginBottom: 16 }, heading: { padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { fontSize: 20 }, content: { paddingHorizontal: 20, paddingTop: 16 } });
