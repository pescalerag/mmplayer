import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from 'react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSettingsStore, StatsCardTheme } from '../../store/useSettingsStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function formatDuration(seconds: number, t: any): string {
  if (!seconds || seconds <= 0) return `0 ${t('activity.min_suffix', { defaultValue: 'min' })}`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} ${t('activity.min_suffix', { defaultValue: 'min' })}`;
  const hours = (seconds / 3600).toFixed(1);
  return `${hours} ${t('activity.hour_suffix', { defaultValue: 'h' })}`;
}

interface ThemeConfig {
  backgroundColors: [string, string, string, string];
  badgeBackgroundColor: string;
  badgeTextColor: string;
  sectionTitleColor: string;
  cleanRankColor: string;
  totalStatValueColor: string;
  artistBorderColor: string;
  songBorderColor: string;
}

const THEME_CONFIGS: Record<StatsCardTheme, ThemeConfig> = {
  default: {
    backgroundColors: ['#05020a', '#0d051a', '#1a0a33', '#33125d'],
    badgeBackgroundColor: '#8B5CF6',
    badgeTextColor: '#FFFFFF',
    sectionTitleColor: '#A78BFA',
    cleanRankColor: '#C4B5FD',
    totalStatValueColor: '#FFFFFF',
    artistBorderColor: 'rgba(167, 139, 250, 0.4)',
    songBorderColor: 'rgba(167, 139, 250, 0.4)',
  },
  glass: {
    backgroundColors: ['#020617', '#06182a', '#0d3257', '#174f85'],
    badgeBackgroundColor: '#38BDF8',
    badgeTextColor: '#020617',
    sectionTitleColor: '#38BDF8',
    cleanRankColor: '#7DD3FC',
    totalStatValueColor: '#F0F9FF',
    artistBorderColor: 'rgba(56, 189, 248, 0.5)',
    songBorderColor: 'rgba(56, 189, 248, 0.5)',
  },
  holographic: {
    backgroundColors: ['#060012', '#1a0430', '#3b0a57', '#8a1674'],
    badgeBackgroundColor: '#EC4899',
    badgeTextColor: '#FFFFFF',
    sectionTitleColor: '#F472B6',
    cleanRankColor: '#F0ABFC',
    totalStatValueColor: '#FDF4FF',
    artistBorderColor: 'rgba(236, 72, 153, 0.55)',
    songBorderColor: 'rgba(236, 72, 153, 0.55)',
  },
  gold: {
    backgroundColors: ['#070501', '#171104', '#2d1f07', '#5c3e0c'],
    badgeBackgroundColor: '#FBBF24',
    badgeTextColor: '#1A1002',
    sectionTitleColor: '#FBBF24',
    cleanRankColor: '#FDE68A',
    totalStatValueColor: '#FFFBEB',
    artistBorderColor: 'rgba(251, 191, 36, 0.6)',
    songBorderColor: 'rgba(251, 191, 36, 0.6)',
  },
  emerald: {
    backgroundColors: ['#010906', '#031910', '#063321', '#0b5a38'],
    badgeBackgroundColor: '#10B981',
    badgeTextColor: '#010906',
    sectionTitleColor: '#34D399',
    cleanRankColor: '#6EE7B7',
    totalStatValueColor: '#ECFDF5',
    artistBorderColor: 'rgba(16, 185, 129, 0.5)',
    songBorderColor: 'rgba(16, 185, 129, 0.5)',
  },
  sunset: {
    backgroundColors: ['#0c0309', '#240616', '#4a0d24', '#851b2e'],
    badgeBackgroundColor: '#F43F5E',
    badgeTextColor: '#FFFFFF',
    sectionTitleColor: '#FB7185',
    cleanRankColor: '#FDA4AF',
    totalStatValueColor: '#FFF1F2',
    artistBorderColor: 'rgba(244, 63, 94, 0.5)',
    songBorderColor: 'rgba(244, 63, 94, 0.5)',
  },
  midnight: {
    backgroundColors: ['#000000', '#090a0f', '#12151f', '#222838'],
    badgeBackgroundColor: '#E2E8F0',
    badgeTextColor: '#0F172A',
    sectionTitleColor: '#94A3B8',
    cleanRankColor: '#CBD5E1',
    totalStatValueColor: '#FFFFFF',
    artistBorderColor: 'rgba(226, 232, 240, 0.45)',
    songBorderColor: 'rgba(226, 232, 240, 0.45)',
  },
  crimson: {
    backgroundColors: ['#080103', '#1c0308', '#380611', '#660b1e'],
    badgeBackgroundColor: '#E11D48',
    badgeTextColor: '#FFFFFF',
    sectionTitleColor: '#FB7185',
    cleanRankColor: '#FECDD3',
    totalStatValueColor: '#FFF1F2',
    artistBorderColor: 'rgba(225, 29, 72, 0.5)',
    songBorderColor: 'rgba(225, 29, 72, 0.5)',
  },
};

interface StatsThemeOption {
  id: StatsCardTheme;
  nameKey: string;
  colors: [string, string, string];
  accent: string;
}

const STATS_THEMES: StatsThemeOption[] = [
  {
    id: 'default',
    nameKey: 'support.stats_theme_default',
    colors: ['#05020a', '#1a0a33', '#33125d'],
    accent: '#8B5CF6',
  },
  {
    id: 'glass',
    nameKey: 'support.stats_theme_glass',
    colors: ['#020617', '#0d3257', '#174f85'],
    accent: '#38BDF8',
  },
  {
    id: 'holographic',
    nameKey: 'support.stats_theme_holographic',
    colors: ['#060012', '#3b0a57', '#8a1674'],
    accent: '#EC4899',
  },
  {
    id: 'gold',
    nameKey: 'support.stats_theme_gold',
    colors: ['#070501', '#2d1f07', '#5c3e0c'],
    accent: '#FBBF24',
  },
  {
    id: 'emerald',
    nameKey: 'support.stats_theme_emerald',
    colors: ['#010906', '#063321', '#0b5a38'],
    accent: '#10B981',
  },
  {
    id: 'sunset',
    nameKey: 'support.stats_theme_sunset',
    colors: ['#0c0309', '#4a0d24', '#851b2e'],
    accent: '#F43F5E',
  },
  {
    id: 'midnight',
    nameKey: 'support.stats_theme_midnight',
    colors: ['#000000', '#12151f', '#222838'],
    accent: '#E2E8F0',
  },
  {
    id: 'crimson',
    nameKey: 'support.stats_theme_crimson',
    colors: ['#080103', '#380611', '#660b1e'],
    accent: '#E11D48',
  },
];

interface ShareCardProps {
  formattedPeriodText: string;
  metric: 'duration' | 'plays';
  totalValue: string;
  totalLabel: string;
  topArtists: any[];
  topSongs: any[];
  cardWidth: number;
  cardHeight: number;
  theme: StatsCardTheme;
  t: any;
}

const ShareCard = React.forwardRef<any, ShareCardProps>(
  (
    {
      formattedPeriodText,
      metric,
      totalValue,
      totalLabel,
      topArtists,
      topSongs,
      cardWidth,
      cardHeight,
      theme,
      t,
    },
    ref
  ) => {
    const top3Artists = topArtists.slice(0, 3);
    const remainingArtists = topArtists.slice(3, 5);

    const top3Songs = topSongs.slice(0, 3);
    const remainingSongs = topSongs.slice(3, 5);

    const cfg = THEME_CONFIGS[theme] || THEME_CONFIGS.default;

    return (
      <ViewShot
        ref={ref}
        options={{ format: 'png', quality: 1, width: 1440, height: 2560 }}
      >
        <View style={[cardStyles.card, { width: cardWidth, height: cardHeight }]}>
          {/* Full Background Gradient */}
          <LinearGradient
            colors={cfg.backgroundColors}
            start={{ x: 0.9, y: 0.05 }}
            end={{ x: 0.05, y: 0.95 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Header Branding */}
          <View style={cardStyles.brandHeader}>
            <Image
              source={require('../../assets/images/splash-icon.png')}
              style={cardStyles.appIcon}
              contentFit="contain"
            />
            <View style={[cardStyles.statsBadge, { backgroundColor: cfg.badgeBackgroundColor }]}>
              <Text style={[cardStyles.statsBadgeText, { color: cfg.badgeTextColor }]}>STATS</Text>
            </View>
          </View>

          {/* Date Range */}
          <Text style={cardStyles.dateRangeText}>{formattedPeriodText}</Text>

          {/* Main Content (Top Artists + Top Songs) */}
          <View style={cardStyles.mainContent}>
            {/* Top 5 Artists */}
            {topArtists.length > 0 && (
              <View style={cardStyles.section}>
                <Text style={[cardStyles.sectionTitle, { color: cfg.sectionTitleColor }]}>
                  {t('activity.top_artists', { defaultValue: 'TOP ARTISTAS' })}
                </Text>

                {/* Top 3 Artists */}
                <View style={cardStyles.top3Container}>
                  {top3Artists.map((artist, idx) => (
                    <View key={artist.id || idx} style={[cardStyles.top3Col, { width: (cardWidth - 40) / 3 }]}>
                      <View style={cardStyles.avatarWrapper}>
                        {artist.imageUrl ? (
                          <Image
                            source={{ uri: artist.imageUrl }}
                            style={[cardStyles.artistAvatar, { borderColor: cfg.artistBorderColor }]}
                            contentFit="cover"
                          />
                        ) : (
                          <View style={[cardStyles.artistAvatar, cardStyles.placeholderAvatar, { borderColor: cfg.artistBorderColor }]}>
                            <Ionicons name="person" size={20} color="#666666" />
                          </View>
                        )}
                        <View
                          style={[
                            cardStyles.rankBadge,
                            idx === 0 ? cardStyles.rank1 : idx === 1 ? cardStyles.rank2 : cardStyles.rank3,
                          ]}
                        >
                          <Text style={cardStyles.rankBadgeText}>{idx + 1}</Text>
                        </View>
                      </View>
                      <Text style={cardStyles.itemName} numberOfLines={1}>
                        {artist.name}
                      </Text>
                      <Text style={cardStyles.itemDetail} numberOfLines={1}>
                        {metric === 'duration'
                          ? formatDuration(artist.duration, t)
                          : `${artist.plays || 0} reps`}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Remaining Artists 4 & 5 */}
                {remainingArtists.length > 0 && (
                  <View style={cardStyles.cleanList}>
                    {remainingArtists.map((artist, idx) => (
                      <View key={artist.id || idx} style={cardStyles.cleanRow}>
                        <Text style={[cardStyles.cleanRank, { color: cfg.cleanRankColor }]}>{idx + 4}.</Text>
                        <Text style={cardStyles.cleanName} numberOfLines={1}>
                          {artist.name}
                        </Text>
                        <Text style={cardStyles.cleanStat}>
                          {metric === 'duration'
                            ? formatDuration(artist.duration, t)
                            : `${artist.plays || 0} reps`}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Top 5 Songs */}
            {topSongs.length > 0 && (
              <View style={cardStyles.section}>
                <Text style={[cardStyles.sectionTitle, { color: cfg.sectionTitleColor }]}>
                  {t('activity.top_songs', { defaultValue: 'TOP CANCIONES' })}
                </Text>

                {/* Top 3 Songs */}
                <View style={cardStyles.top3Container}>
                  {top3Songs.map((song, idx) => (
                    <View key={song.id || idx} style={[cardStyles.top3Col, { width: (cardWidth - 40) / 3 }]}>
                      <View style={cardStyles.coverWrapper}>
                        {song.coverUrl ? (
                          <Image
                            source={{ uri: song.coverUrl }}
                            style={[cardStyles.songCover, { borderColor: cfg.songBorderColor }]}
                            contentFit="cover"
                          />
                        ) : (
                          <View style={[cardStyles.songCover, cardStyles.placeholderAvatar, { borderColor: cfg.songBorderColor }]}>
                            <Ionicons name="musical-note" size={18} color="#666666" />
                          </View>
                        )}
                        <View
                          style={[
                            cardStyles.rankBadgeSquare,
                            idx === 0 ? cardStyles.rank1 : idx === 1 ? cardStyles.rank2 : cardStyles.rank3,
                          ]}
                        >
                          <Text style={cardStyles.rankBadgeText}>{idx + 1}</Text>
                        </View>
                      </View>
                      <Text style={cardStyles.itemName} numberOfLines={1}>
                        {song.title}
                      </Text>
                      <Text style={cardStyles.itemDetail} numberOfLines={1}>
                        {song.artistName || 'Desconocido'}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Remaining Songs 4 & 5 */}
                {remainingSongs.length > 0 && (
                  <View style={cardStyles.cleanList}>
                    {remainingSongs.map((song, idx) => (
                      <View key={song.id || idx} style={cardStyles.cleanRow}>
                        <Text style={[cardStyles.cleanRank, { color: cfg.cleanRankColor }]}>{idx + 4}.</Text>
                        <Text style={cardStyles.cleanName} numberOfLines={1}>
                          {song.title} <Text style={{ color: '#666666' }}>• {song.artistName}</Text>
                        </Text>
                        <Text style={cardStyles.cleanStat}>
                          {metric === 'duration'
                            ? formatDuration(song.duration, t)
                            : `${song.plays || 0} reps`}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Large Total Stat Block */}
          <View style={cardStyles.totalStatContainer}>
            <Text style={cardStyles.totalStatLabel}>{totalLabel}</Text>
            <Text style={[cardStyles.totalStatValue, { color: cfg.totalStatValueColor }]}>{totalValue}</Text>
          </View>

          {/* Footer Slogan */}
          <View style={cardStyles.cardFooter}>
            <Text style={cardStyles.cardFooterText}>MMPlayer • Tu música local</Text>
          </View>
        </View>
      </ViewShot>
    );
  }
);

ShareCard.displayName = 'ShareCard';

export default function ActivityShareScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useTranslation();

  const userTier = useSettingsStore(state => state.userTier);
  const statsCardTheme = useSettingsStore(state => state.statsCardTheme) || 'default';
  const setStatsCardTheme = useSettingsStore(state => state.setStatsCardTheme);
  const isVip = userTier === 'VIP';
  const effectiveTheme: StatsCardTheme = isVip ? statsCardTheme : 'default';

  const {
    formattedPeriodText = '',
    metric = 'duration',
    totalHours = 0,
    totalPlays = 0,
    topArtists = [],
    topSongs = [],
  } = route.params || {};

  const [isCapturing, setIsCapturing] = useState(false);
  const viewShotRef = useRef<any>(null);

  // Calculate 9:16 card dimensions to fit on screen without scrolling
  const themeBarHeight = isVip ? 48 : 0;
  const availableHeight = SCREEN_HEIGHT - insets.top - insets.bottom - 130 - themeBarHeight;
  let cardHeight = Math.min(availableHeight, 550);
  let cardWidth = cardHeight * (9 / 16);

  if (cardWidth > SCREEN_WIDTH - 40) {
    cardWidth = SCREEN_WIDTH - 40;
    cardHeight = cardWidth * (16 / 9);
  }

  const handleCaptureAndShare = async () => {
    if (!viewShotRef.current) return;
    try {
      setIsCapturing(true);
      const uri = await captureRef(viewShotRef, {
        format: 'png',
        quality: 1,
        width: 1440,
        height: 2560,
        result: 'tmpfile',
      });
      setIsCapturing(false);

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: t('activity.share_title', { defaultValue: 'Compartir Estadísticas' }),
        });
      }
    } catch (err) {
      console.error('[ActivityShareScreen] Error capturing or sharing:', err);
      setIsCapturing(false);
    }
  };

  const totalValue =
    metric === 'duration'
      ? formatDuration(totalHours * 3600, t)
      : `${totalPlays} ${totalPlays === 1 ? t('activity.play_singular', { defaultValue: 'reproducción' }) : t('activity.play_plural', { defaultValue: 'reproducciones' })}`;

  const totalLabel =
    metric === 'duration'
      ? 'TIEMPO TOTAL DE ESCUCHA'
      : 'TOTAL DE REPRODUCCIONES';

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 14) }]}>
      <StatusBar style="light" backgroundColor="#000000" />

      {/* Screen Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t('activity.share_preview', { defaultValue: 'Vista previa de estadísticas' })}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Card Preview Container */}
      <View style={styles.previewContainer}>
        <ShareCard
          ref={viewShotRef}
          formattedPeriodText={formattedPeriodText}
          metric={metric}
          totalValue={totalValue}
          totalLabel={totalLabel}
          topArtists={topArtists}
          topSongs={topSongs}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
          theme={effectiveTheme}
          t={t}
        />
      </View>

      {/* Selector Horizontal de Temas (Exclusivo para VIP) */}
      {isVip && (
        <View style={styles.themesSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.themesScroll}
          >
            {STATS_THEMES.map((item) => {
              const isSelected = effectiveTheme === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.themeChip,
                    isSelected && [styles.themeChipActive, { borderColor: item.accent }],
                  ]}
                  onPress={() => setStatsCardTheme(item.id)}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={item.colors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.themeSwatch}
                  >
                    {isSelected && (
                      <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                    )}
                  </LinearGradient>
                  <Text
                    style={[
                      styles.themeChipText,
                      isSelected && { color: item.accent, fontWeight: '700' },
                    ]}
                    numberOfLines={1}
                  >
                    {t(item.nameKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Share Button Below Card */}
      <TouchableOpacity
        onPress={handleCaptureAndShare}
        disabled={isCapturing}
        style={[styles.shareBtn, { width: Math.min(SCREEN_WIDTH - 40, cardWidth) }]}
        activeOpacity={0.8}
      >
        {isCapturing ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="share-social" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.shareBtnText}>
              {t('activity.share_btn', { defaultValue: 'Compartir' })}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 6,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: 14,
    borderRadius: 25,
    marginTop: 4,
    marginBottom: 4,
  },
  shareBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  // Selector horizontal de temas VIP
  themesSection: {
    width: '100%',
    paddingVertical: 4,
  },
  themesScroll: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  themeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 7,
  },
  themeChipActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  themeSwatch: {
    width: 15,
    height: 15,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeChipText: {
    color: '#D4D4D8',
    fontSize: 12,
    fontWeight: '500',
  },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#030106',
    borderRadius: 0,
    padding: 20,
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  appIcon: {
    width: 42,
    height: 42,
    borderRadius: 0,
    marginRight: 10,
  },
  statsBadge: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statsBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  dateRangeText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'capitalize',
  },
  mainContent: {
    flex: 1,
    justifyContent: 'space-around',
  },
  section: {
    marginVertical: 4,
  },
  sectionTitle: {
    color: '#8B5CF6',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  top3Container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  top3Col: {
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 4,
  },
  coverWrapper: {
    position: 'relative',
    marginBottom: 4,
  },
  artistAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: '#333333',
  },
  songCover: {
    width: 52,
    height: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  placeholderAvatar: {
    backgroundColor: '#18181B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000000',
  },
  rankBadgeSquare: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000000',
  },
  rank1: { backgroundColor: '#FFD700' },
  rank2: { backgroundColor: '#C0C0C0' },
  rank3: { backgroundColor: '#CD7F32' },
  rankBadgeText: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '900',
  },
  itemName: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
  itemDetail: {
    color: '#71717A',
    fontSize: 9,
    textAlign: 'center',
    marginTop: 1,
  },
  cleanList: {
    marginTop: 4,
    gap: 4,
  },
  cleanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 1,
  },
  cleanRank: {
    color: '#8B5CF6',
    fontSize: 10,
    fontWeight: '700',
    width: 16,
  },
  cleanName: {
    flex: 1,
    color: '#D4D4D8',
    fontSize: 10,
    fontWeight: '600',
    marginRight: 6,
  },
  cleanStat: {
    color: '#71717A',
    fontSize: 9,
    fontWeight: '500',
  },
  totalStatContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    paddingVertical: 12,
  },
  totalStatLabel: {
    color: '#A1A1AA',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  totalStatValue: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  cardFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  cardFooterText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
