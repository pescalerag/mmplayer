import { useAppTheme } from "@/hooks/useAppTheme";
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSleepTimerStore } from '../store/useSleepTimerStore';

const formatHHMMSS = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

export default function SleepTimerSheet() {
  const { colors, fonts, layout } = useAppTheme();
  const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
  const { isActive, timeLeft, startTimer, deactivate } = useSleepTimerStore();
  const { t } = useTranslation();

  const timerOptions = [
    { label: `5 ${t('sleep_timer.minutes')}`, value: 5 },
    { label: `10 ${t('sleep_timer.minutes')}`, value: 10 },
    { label: `20 ${t('sleep_timer.minutes')}`, value: 20 },
    { label: `30 ${t('sleep_timer.minutes')}`, value: 30 },
    { label: `45 ${t('sleep_timer.minutes')}`, value: 45 },
    { label: t('sleep_timer.hour'), value: 60 },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('sleep_timer.title')}</Text>
        <Text style={styles.headerSubtitle}>
          {isActive ? t('sleep_timer.status_active') : t('sleep_timer.off')}
        </Text>
      </View>

      {/* Digital Clock Display */}
      <View style={styles.clockContainer}>
        <Text style={[styles.clockText, isActive && styles.clockTextActive]}>
          {formatHHMMSS(timeLeft)}
        </Text>
      </View>

      {/* Controls */}
      <View style={styles.contentContainer}>
        {isActive ? (
          <TouchableOpacity
            style={styles.deactivateButton}
            onPress={deactivate}
          >
            <Ionicons name="stop-circle-outline" size={20} color={colors.text} style={{ marginRight: 8 }} />
            <Text style={styles.deactivateButtonText}>
              {t('sleep_timer.deactivate')}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.optionsGrid}>
            {timerOptions.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={styles.optionButton}
                onPress={() => startTimer(opt.value)}
              >
                <Text style={styles.optionButtonText}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const getStyles = (colors: any, fonts: any, layout: any) => StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBackground,
    paddingBottom: 15,
  },
  headerTitle: {
    color: colors.accent,
    fontSize: 14,
    fontFamily: fonts.regular,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerSubtitle: {
    color: colors.text,
    fontSize: 20,
    fontFamily: fonts.regular,
    fontWeight: '800',
    marginTop: 4,
  },
  clockContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginBottom: 20,
  },
  clockText: {
    color: '#535353',
    fontSize: 48,
    fontWeight: 'bold',
    fontFamily: fonts.regular,
    letterSpacing: 2,
  },
  clockTextActive: {
    color: colors.accentLight,
  },
  contentContainer: {
    marginBottom: 10,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  optionButton: {
    backgroundColor: '#181818',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: '28%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionButtonText: {
    color: colors.text,
    fontSize: 14,
    fontFamily: fonts.regular,
    fontWeight: '700',
  },
  deactivateButton: {
    backgroundColor: colors.heartIcon,
    borderRadius: 24,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
  },
  deactivateButtonText: {
    color: colors.text,
    fontSize: 16,
    fontFamily: fonts.regular,
    fontWeight: 'bold',
  },
});
