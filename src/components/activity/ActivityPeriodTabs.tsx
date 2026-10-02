import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';
import { Period, PERIODS } from '../../screens/activity/utils/activityDateUtils';

interface ActivityPeriodTabsProps {
  readonly period: Period;
  readonly onPeriodChange: (p: Period) => void;
  readonly periodTabsRef: React.RefObject<any>;
  readonly periodTabsLayout: React.RefObject<any>;
}

export function ActivityPeriodTabs({
  period,
  onPeriodChange,
  periodTabsRef,
  periodTabsLayout,
}: ActivityPeriodTabsProps) {
  const { colors, fonts } = useAppTheme();
  const { t } = useTranslation();

  const handleLayout = (e: LayoutChangeEvent) => {
    if (e?.nativeEvent?.layout) {
      periodTabsLayout.current = e.nativeEvent.layout;
    }
  };

  return (
    <View ref={periodTabsRef} onLayout={handleLayout} style={styles.periodTabsRow}>
      {PERIODS.map((p) => {
        const isActive = p === period;
        return (
          <TouchableOpacity
            key={p}
            onPress={() => onPeriodChange(p)}
            activeOpacity={0.75}
            style={[styles.periodTab, isActive && { backgroundColor: colors.accent }]}
          >
            <Text
              style={[
                styles.periodTabText,
                { fontFamily: fonts.bold },
                isActive ? { color: colors.onAccent } : { color: colors.textSecondary },
              ]}
            >
              {t(`activity.periods.${p}`)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  periodTabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  periodTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  periodTabText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
