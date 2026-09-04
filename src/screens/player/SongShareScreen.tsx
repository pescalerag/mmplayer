import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
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
import { useAppTheme } from '@/hooks/useAppTheme';
import { extractColorFromImage } from '../../../modules/native-equalizer';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// --- Helper functions for dynamic cover gradient generation ---
const hexToHsl = (hex: string): { h: number; s: number; l: number } => {
  let r = 0, g = 0, b = 0;
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length === 6) {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  }
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
};

const hslToHex = (h: number, s: number, l: number): string => {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
};

const generateCoverGradients = (extractedHex: string | null) => {
  if (!extractedHex) {
    return {
      colors: ['#231238', '#140822', '#0c0416', '#040108'] as [string, string, string, string],
      accent: '#A78BFA',
      glow: 'rgba(167, 139, 250, 0.35)',
    };
  }
  try {
    const hsl = hexToHsl(extractedHex);
    const topGradient = hslToHex(hsl.h, Math.min(hsl.s + 10, 60), 24);
    const midGradient = hslToHex(hsl.h, Math.min(hsl.s, 45), 14);
    const baseColor = hslToHex(hsl.h, Math.min(hsl.s - 5, 35), 8);
    const bottomGradient = hslToHex(hsl.h, 20, 4);
    const accent = hslToHex(hsl.h, 85, 60);
    const glow = `rgba(${Math.round(hsl.s * 2.5)}, 120, 240, 0.4)`;
    return {
      colors: [topGradient, midGradient, baseColor, bottomGradient] as [string, string, string, string],
      accent,
      glow,
    };
  } catch {
    return {
      colors: ['#231238', '#140822', '#0c0416', '#040108'] as [string, string, string, string],
      accent: '#A78BFA',
      glow: 'rgba(167, 139, 250, 0.35)',
    };
  }
};

function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

interface SongCardProps {
  title: string;
  artist: string;
  album?: string;
  coverUrl?: string | null;
  duration?: number;
  cardWidth: number;
  cardHeight: number;
  gradientColors: [string, string, string, string];
  accentColor: string;
  t: any;
}

const SongShareCard = React.forwardRef<any, SongCardProps>(
  (
    {
      title,
      artist,
      album,
      coverUrl,
      duration,
      cardWidth,
      cardHeight,
      gradientColors,
      accentColor,
      t,
    },
    ref
  ) => {
    const coverSize = Math.round(cardWidth * 0.74);
    const formattedDuration = formatDuration(duration);

    return (
      <ViewShot
        ref={ref}
        options={{ format: 'png', quality: 1 }}
        style={{ width: cardWidth, height: cardHeight, overflow: 'hidden' }}
      >
        <View style={[cardStyles.card, { width: cardWidth, height: cardHeight }]}>
          {/* Background Gradient */}
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Top Brand Header: Real App Icon */}
          <View style={cardStyles.brandHeader}>
            <Image
              source={require('../../assets/images/icon.png')}
              style={cardStyles.appIcon}
              contentFit="cover"
            />
          </View>

          {/* Center: Artwork + Metadata */}
          <View style={cardStyles.centerContent}>
            <View style={[cardStyles.artworkWrapper, { width: coverSize, height: coverSize }]}>
              {coverUrl ? (
                <Image
                  source={{ uri: coverUrl }}
                  style={[cardStyles.artworkImage, { width: coverSize, height: coverSize }]}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View
                  style={[
                    cardStyles.artworkFallback,
                    { width: coverSize, height: coverSize, backgroundColor: 'rgba(255,255,255,0.08)' },
                  ]}
                >
                  <Ionicons name="musical-notes" size={coverSize * 0.4} color="rgba(255,255,255,0.4)" />
                </View>
              )}
            </View>

            {/* Song Details */}
            <View style={cardStyles.metadataContainer}>
              <Text style={cardStyles.songTitle} numberOfLines={2}>
                {title || t('player.unknown', { defaultValue: 'Canción desconocida' })}
              </Text>
              <Text style={cardStyles.artistName} numberOfLines={1}>
                {artist || t('player.unknown', { defaultValue: 'Artista desconocido' })}
              </Text>
              {!!album && (
                <Text style={cardStyles.albumName} numberOfLines={1}>
                  {album}
                </Text>
              )}
              {!!formattedDuration && (
                <Text style={cardStyles.durationText}>{formattedDuration}</Text>
              )}
            </View>
          </View>

          {/* Bottom Footer Watermark */}
          <View style={cardStyles.bottomSection}>
            <View style={cardStyles.cardFooter}>
              <Text style={cardStyles.cardFooterText}>MMPlayer • Tu música local</Text>
            </View>
          </View>
        </View>
      </ViewShot>
    );
  }
);

SongShareCard.displayName = 'SongShareCard';

export default function SongShareScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  const {
    title = '',
    artist = '',
    album = '',
    coverUrl = null,
    fileUrl = '',
    duration = 0,
  } = route.params || {};

  const [extractedHex, setExtractedHex] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSharingAudio, setIsSharingAudio] = useState(false);
  const viewShotRef = useRef<any>(null);

  // Extract cover color for dynamic background
  useEffect(() => {
    let isMounted = true;
    if (coverUrl) {
      extractColorFromImage(coverUrl)
        .then((color) => {
          if (isMounted && color) {
            setExtractedHex(color);
          }
        })
        .catch(() => {
          if (isMounted) setExtractedHex(null);
        });
    } else {
      setExtractedHex(null);
    }
    return () => {
      isMounted = false;
    };
  }, [coverUrl]);

  const { colors: gradientColors, accent: accentColor } = useMemo(
    () => generateCoverGradients(extractedHex),
    [extractedHex]
  );

  // Calculate 9:16 card dimensions to fit inside screen without scrolling
  const availableHeight = SCREEN_HEIGHT - insets.top - insets.bottom - 180;
  let cardHeight = Math.min(availableHeight, 540);
  let cardWidth = cardHeight * (9 / 16);

  if (cardWidth > SCREEN_WIDTH - 44) {
    cardWidth = SCREEN_WIDTH - 44;
    cardHeight = cardWidth * (16 / 9);
  }

  // Handle Share as Image
  const handleCaptureAndShareImage = async () => {
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
          dialogTitle: t('player.share_song_title', { defaultValue: 'Compartir canción' }),
        });
      }
    } catch (err) {
      console.error('[SongShareScreen] Error capturing or sharing image:', err);
      setIsCapturing(false);
    }
  };

  // Handle Share as Audio File
  const handleShareAudio = async () => {
    if (!fileUrl) return;
    try {
      setIsSharingAudio(true);
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUrl, {
          dialogTitle: `${t('player.share', { defaultValue: 'Compartir' })} ${title}`,
          mimeType: 'audio/*',
        });
      }
      setIsSharingAudio(false);
    } catch (err) {
      console.error('[SongShareScreen] Error sharing audio file:', err);
      setIsSharingAudio(false);
    }
  };

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
          {t('player.share_song_preview', { defaultValue: 'Vista previa de la canción' })}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Card Preview Container */}
      <View style={styles.previewContainer}>
        <SongShareCard
          ref={viewShotRef}
          title={title}
          artist={artist}
          album={album}
          coverUrl={coverUrl}
          duration={duration}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
          gradientColors={gradientColors}
          accentColor={accentColor}
          t={t}
        />
      </View>

      {/* Action Buttons Container */}
      <View style={[styles.actionsContainer, { width: Math.min(SCREEN_WIDTH - 40, cardWidth) }]}>
        {/* Primary Button: Share Image */}
        <TouchableOpacity
          onPress={handleCaptureAndShareImage}
          disabled={isCapturing || isSharingAudio}
          style={[styles.primaryShareBtn, { backgroundColor: colors.accent }]}
          activeOpacity={0.8}
        >
          {isCapturing ? (
            <ActivityIndicator size="small" color={colors.onAccent} />
          ) : (
            <>
              <Ionicons name="image-outline" size={19} color={colors.onAccent} style={{ marginRight: 8 }} />
              <Text style={[styles.primaryShareBtnText, { color: colors.onAccent }]}>
                {t('player.share_as_image', { defaultValue: 'Compartir imagen' })}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Secondary Button: Share Audio File */}
        <TouchableOpacity
          onPress={handleShareAudio}
          disabled={isCapturing || isSharingAudio || !fileUrl}
          style={styles.secondaryShareBtn}
          activeOpacity={0.7}
        >
          {isSharingAudio ? (
            <ActivityIndicator size="small" color="#E4E4E7" />
          ) : (
            <>
              <Ionicons name="musical-notes-outline" size={17} color="#E4E4E7" style={{ marginRight: 8 }} />
              <Text style={styles.secondaryShareBtnText}>
                {t('player.share_as_audio', { defaultValue: 'Compartir archivo de audio' })}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
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
    marginVertical: 8,
  },
  actionsContainer: {
    gap: 10,
    paddingBottom: 4,
  },
  primaryShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 25,
  },
  primaryShareBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    paddingVertical: 12,
    borderRadius: 25,
  },
  secondaryShareBtnText: {
    color: '#E4E4E7',
    fontSize: 14,
    fontWeight: '600',
  },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#05020a',
    borderRadius: 0,
    padding: 20,
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
  },
  appIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  artworkWrapper: {
    borderRadius: 18,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  artworkImage: {
    borderRadius: 18,
  },
  artworkFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
  },
  metadataContainer: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  songTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  artistName: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
  },
  albumName: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'center',
  },
  durationText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  bottomSection: {
    alignItems: 'center',
    width: '100%',
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
    opacity: 0.8,
  },
});
