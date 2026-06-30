import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { useStatsStore } from '../store/useStatsStore';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import MarqueeText from './MarqueeText';

export const StatsWidget: React.FC = () => {
  const { totalHours, topArtist, topAlbum, topSong } = useStatsStore();
  const { colors, fonts, spacing, radii } = useAppTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<any>();

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => navigation.navigate('WeeklyActivity')}
      style={{ marginHorizontal: spacing.lg || 20, marginVertical: 12 }}
    >
      <LinearGradient
        colors={[colors.accentAlpha15, colors.cardBackground]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.container, { borderRadius: radii.md || 8 }]}
      >
        <View style={styles.header}>
          <Ionicons name="stats-chart" size={20} color={colors.accentLight} />
          <Text style={[styles.title, { fontFamily: fonts.regular, color: colors.textSecondary }]}>
            {t('home.weekly_stats_title') || 'ACTIVIDAD SEMANAL'}
          </Text>
        </View>

        <View style={styles.body}>
          {/* ROW 1: Hours & Artist */}
          <View style={styles.row}>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { fontFamily: fonts.regular, color: colors.text, height: 24, lineHeight: 24, marginBottom: 4 }]} numberOfLines={1}>
                {totalHours.toFixed(1)}
              </Text>
              <Text style={[styles.statLabel, { fontFamily: fonts.regular, color: colors.textSecondary }]}>
                {t('home.weekly_stats_hours') || 'Horas escuchadas'}
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statBox}>
              <View style={styles.marqueeContainer}>
                <MarqueeText
                  text={topArtist || t('actions.unknown') || 'Ninguno'}
                  style={[styles.statValue, { fontFamily: fonts.regular, color: colors.accentLight, marginBottom: 0 }]}
                />
              </View>
              <Text style={[styles.statLabel, { fontFamily: fonts.regular, color: colors.textSecondary }]}>
                {t('home.weekly_stats_artist') || 'Artista top'}
              </Text>
            </View>
          </View>

          {/* ROW DIVIDER */}
          <View style={styles.rowDivider} />

          {/* ROW 2: Album & Song */}
          <View style={styles.row}>
            <View style={styles.statBox}>
              <View style={styles.marqueeContainer}>
                <MarqueeText
                  text={topAlbum || t('actions.unknown') || 'Ninguno'}
                  style={[styles.statValue, { fontFamily: fonts.regular, color: colors.accentLight, marginBottom: 0 }]}
                />
              </View>
              <Text style={[styles.statLabel, { fontFamily: fonts.regular, color: colors.textSecondary }]}>
                {t('home.weekly_stats_album') || 'Álbum top'}
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statBox}>
              <View style={styles.marqueeContainer}>
                <MarqueeText
                  text={topSong || t('actions.unknown') || 'Ninguno'}
                  style={[styles.statValue, { fontFamily: fonts.regular, color: colors.accentLight, marginBottom: 0 }]}
                />
              </View>
              <Text style={[styles.statLabel, { fontFamily: fonts.regular, color: colors.textSecondary }]}>
                {t('home.weekly_stats_song') || 'Canción top'}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  body: {
    flexDirection: 'column',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 12,
  },
  statBox: {
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  marqueeContainer: {
    height: 24,
    justifyContent: 'center',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 16,
  },
});
