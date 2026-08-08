import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function formatDuration(seconds: number, t: any): string {
  if (!seconds || seconds <= 0) return `0 ${t('activity.min_suffix', { defaultValue: 'min' })}`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} ${t('activity.min_suffix', { defaultValue: 'min' })}`;
  const hours = (seconds / 3600).toFixed(1);
  return `${hours} ${t('activity.hour_suffix', { defaultValue: 'h' })}`;
}

interface ShareCardProps {
  formattedPeriodText: string;
  metric: 'duration' | 'plays';
  totalValue: string;
  totalLabel: string;
  topArtists: any[];
  topSongs: any[];
  cardWidth: number;
  cardHeight: number;
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
      t,
    },
    ref
  ) => {
    const top3Artists = topArtists.slice(0, 3);
    const remainingArtists = topArtists.slice(3, 5);

    const top3Songs = topSongs.slice(0, 3);
    const remainingSongs = topSongs.slice(3, 5);

    return (
      <ViewShot
        ref={ref}
        options={{ format: 'png', quality: 1, width: 1440, height: 2560 }}
      >
        <View style={[cardStyles.card, { width: cardWidth, height: cardHeight }]}>
          {/* Full Background Gradient */}
          <LinearGradient
            colors={['#030106', '#080314', '#150729', '#321063']}
            start={{ x: 0.9, y: 0.05 }}
            end={{ x: 0.05, y: 0.95 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Header Branding: Transparent Splash Icon + STATS Badge */}
          <View style={cardStyles.brandHeader}>
            <Image
              source={require('../../assets/images/splash-icon.png')}
              style={cardStyles.appIcon}
              contentFit="contain"
            />
            <View style={cardStyles.statsBadge}>
              <Text style={cardStyles.statsBadgeText}>STATS</Text>
            </View>
          </View>

          {/* Date Range: Clean text without icon or background */}
          <Text style={cardStyles.dateRangeText}>{formattedPeriodText}</Text>

          {/* Main Content (Top Artists + Top Songs) */}
          <View style={cardStyles.mainContent}>
            {/* Top 5 Artists */}
            {topArtists.length > 0 && (
              <View style={cardStyles.section}>
                <Text style={cardStyles.sectionTitle}>
                  {t('activity.top_artists', { defaultValue: 'TOP ARTISTAS' })}
                </Text>

                {/* Top 3 Artists */}
                <View style={cardStyles.top3Container}>
                  {top3Artists.map((artist, idx) => (
                    <View key={artist.id || idx} style={[cardStyles.top3Col, { width: (cardWidth - 56) / 3 }]}>
                      <View style={cardStyles.avatarWrapper}>
                        {artist.imageUrl ? (
                          <Image
                            source={{ uri: artist.imageUrl }}
                            style={cardStyles.artistAvatar}
                            contentFit="cover"
                          />
                        ) : (
                          <View style={[cardStyles.artistAvatar, cardStyles.placeholderAvatar]}>
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
                        <Text style={cardStyles.cleanRank}>{idx + 4}.</Text>
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
                <Text style={cardStyles.sectionTitle}>
                  {t('activity.top_songs', { defaultValue: 'TOP CANCIONES' })}
                </Text>

                {/* Top 3 Songs */}
                <View style={cardStyles.top3Container}>
                  {top3Songs.map((song, idx) => (
                    <View key={song.id || idx} style={[cardStyles.top3Col, { width: (cardWidth - 56) / 3 }]}>
                      <View style={cardStyles.coverWrapper}>
                        {song.coverUrl ? (
                          <Image
                            source={{ uri: song.coverUrl }}
                            style={cardStyles.songCover}
                            contentFit="cover"
                          />
                        ) : (
                          <View style={[cardStyles.songCover, cardStyles.placeholderAvatar]}>
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
                        <Text style={cardStyles.cleanRank}>{idx + 4}.</Text>
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

          {/* Large Total Stat Block (Total Value in White) */}
          <View style={cardStyles.totalStatContainer}>
            <Text style={cardStyles.totalStatLabel}>{totalLabel}</Text>
            <Text style={cardStyles.totalStatValue}>{totalValue}</Text>
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

interface ActivityShareModalProps {
  visible: boolean;
  onClose: () => void;
  formattedPeriodText: string;
  metric: 'duration' | 'plays';
  totalHours: number;
  totalPlays: number;
  topArtists: any[];
  topSongs: any[];
}

export default function ActivityShareModal({
  visible,
  onClose,
  formattedPeriodText,
  metric,
  totalHours,
  totalPlays,
  topArtists,
  topSongs,
}: ActivityShareModalProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [isCapturing, setIsCapturing] = useState(false);
  const viewShotRef = useRef<any>(null);

  // Dynamically calculate exact 9:16 card dimensions to fit inside screen without scrolling
  const availableHeight = SCREEN_HEIGHT - insets.top - insets.bottom - 130;
  let cardHeight = Math.min(availableHeight, 560);
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
      console.error('[ActivityShareModal] Error capturing or sharing:', err);
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
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={modalStyles.overlay}>
        <View
          style={[
            modalStyles.container,
            { paddingTop: Math.max(insets.top, 14), paddingBottom: Math.max(insets.bottom, 14) },
          ]}
        >
          {/* Header Bar */}
          <View style={modalStyles.header}>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn} activeOpacity={0.8}>
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={modalStyles.title}>
              {t('activity.share_preview', { defaultValue: 'Vista previa de estadísticas' })}
            </Text>
            <View style={{ width: 38 }} />
          </View>

          {/* Card Preview Container (No ScrollView -> Entire Card Fits Directly) */}
          <View style={modalStyles.previewContainer}>
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
              t={t}
            />
          </View>

          {/* Share Button AFTER Preview Image */}
          <TouchableOpacity
            onPress={handleCaptureAndShare}
            disabled={isCapturing}
            style={[modalStyles.shareBtn, { width: Math.min(SCREEN_WIDTH - 40, cardWidth) }]}
            activeOpacity={0.8}
          >
            {isCapturing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="share-social" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={modalStyles.shareBtnText}>
                  {t('activity.share_btn', { defaultValue: 'Compartir' })}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
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
    marginTop: 6,
    marginBottom: 6,
  },
  shareBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#030106',
    borderRadius: 0,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
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
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'transparent',
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
    color: '#52525B',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
