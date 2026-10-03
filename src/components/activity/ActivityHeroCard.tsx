import React from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';
import { Metric } from '../../screens/activity/utils/activityStatUtils';

interface ActivityHeroCardProps {
  readonly metric: Metric;
  readonly totalHours: number;
  readonly totalPlays: number;
  readonly formattedPeriodText: string;
  readonly heroCardRef: React.RefObject<any>;
  readonly heroCardLayout: React.RefObject<any>;
}

export function ActivityHeroCard({
  metric,
  totalHours,
  totalPlays,
  formattedPeriodText,
  heroCardRef,
  heroCardLayout,
}: ActivityHeroCardProps) {
  const { colors, fonts, radii } = useAppTheme();
  const { t } = useTranslation();

  const handleLayout = (e: LayoutChangeEvent) => {
    if (e?.nativeEvent?.layout) {
      heroCardLayout.current = e.nativeEvent.layout;
    }
  };

  const isDuration = metric === 'duration';
  const iconName = isDuration ? 'time-outline' : 'musical-notes-outline';
  const displayValue = isDuration ? `${totalHours.toFixed(1)} ` : `${totalPlays} `;
  const valueSuffix = isDuration ? t('activity.hour_suffix') : t('activity.plays');
  const labelText = isDuration
    ? t('activity.total_listening_time', { period: formattedPeriodText })
    : t('activity.total_plays', { period: formattedPeriodText });

  return (
    <View
      ref={heroCardRef}
      onLayout={handleLayout}
      style={[
        styles.heroCard,
        { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: radii.lg || 12 },
      ]}
    >
      <View style={styles.heroRow}>
        <Ionicons name={iconName} size={28} color={colors.accentLight} />
        <Text style={[styles.heroValue, { fontFamily: fonts.bold, color: colors.text }]}>
          {displayValue}
          <Text style={styles.heroSuffix}>{valueSuffix}</Text>
        </Text>
      </View>
      <Text style={[styles.heroLabel, { fontFamily: fonts.regular, color: colors.textSecondary }]}>
        {labelText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  heroValue: {
    fontSize: 28,
    fontWeight: '900',
  },
  heroSuffix: {
    fontSize: 16,
    fontWeight: '500',
  },
  heroLabel: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    textTransform: 'capitalize',
  },
});
