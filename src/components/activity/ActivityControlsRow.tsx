import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';
import { Period } from '../../screens/activity/utils/activityDateUtils';
import { Metric } from '../../screens/activity/utils/activityStatUtils';

interface ActivityControlsRowProps {
  readonly period: Period;
  readonly metric: Metric;
  readonly onOpenCustomDate: () => void;
  readonly onMetricChange: (m: Metric) => void;
  readonly metricToggleRef: React.RefObject<any>;
  readonly metricToggleLayout: React.RefObject<any>;
}

export function ActivityControlsRow({
  period,
  metric,
  onOpenCustomDate,
  onMetricChange,
  metricToggleRef,
  metricToggleLayout,
}: ActivityControlsRowProps) {
  const { colors, fonts } = useAppTheme();
  const { t } = useTranslation();

  const handleLayout = (e: LayoutChangeEvent) => {
    if (e?.nativeEvent?.layout) {
      metricToggleLayout.current = e.nativeEvent.layout;
    }
  };

  const isCustom = period === 'custom';
  const isDuration = metric === 'duration';
  const isPlays = metric === 'plays';

  return (
    <View ref={metricToggleRef} onLayout={handleLayout} style={styles.controlsRow}>
      <TouchableOpacity
        style={[
          styles.customDateBtn,
          isCustom && { backgroundColor: colors.accentAlpha15, borderColor: colors.accent },
        ]}
        onPress={onOpenCustomDate}
        activeOpacity={0.75}
      >
        <Ionicons
          name="calendar-outline"
          size={14}
          color={isCustom ? colors.accentLight : colors.textSecondary}
        />
        <Text
          style={[
            styles.customDateBtnText,
            { fontFamily: fonts.bold },
            { color: isCustom ? colors.accentLight : colors.textSecondary },
          ]}
        >
          {t('activity.custom_date_button') || 'Fecha personalizada'}
        </Text>
      </TouchableOpacity>

      <View style={styles.metricToggle}>
        <TouchableOpacity
          onPress={() => onMetricChange('duration')}
          activeOpacity={0.75}
          style={[
            styles.metricBtn,
            isDuration && { backgroundColor: colors.accentAlpha15, borderColor: colors.accent },
          ]}
        >
          <Ionicons
            name="time-outline"
            size={13}
            color={isDuration ? colors.accentLight : colors.textSecondary}
          />
          <Text
            style={[
              styles.metricBtnText,
              { fontFamily: fonts.bold },
              { color: isDuration ? colors.accentLight : colors.textSecondary },
            ]}
          >
            {t('activity.time_label')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onMetricChange('plays')}
          activeOpacity={0.75}
          style={[
            styles.metricBtn,
            isPlays && { backgroundColor: colors.accentAlpha15, borderColor: colors.accent },
          ]}
        >
          <Ionicons
            name="play-outline"
            size={13}
            color={isPlays ? colors.accentLight : colors.textSecondary}
          />
          <Text
            style={[
              styles.metricBtnText,
              { fontFamily: fonts.bold },
              { color: isPlays ? colors.accentLight : colors.textSecondary },
            ]}
          >
            {t('activity.reproductions_label')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  controlsRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    gap: 8,
  },
  customDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  customDateBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metricToggle: {
    flexDirection: 'row',
    gap: 6,
  },
  metricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  metricBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
