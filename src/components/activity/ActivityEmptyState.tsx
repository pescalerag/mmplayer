import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';

export function ActivityEmptyState() {
  const { colors, fonts } = useAppTheme();
  const { t } = useTranslation();

  return (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="bar-chart-outline"
        size={64}
        color={colors.textSecondary}
        style={{ marginBottom: 16, opacity: 0.5 }}
      />
      <Text style={[styles.emptyText, { fontFamily: fonts.bold, color: colors.textSecondary }]}>
        {t('activity.no_data')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 30,
  },
});
