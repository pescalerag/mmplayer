import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  FlatList,
} from 'react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useToastStore } from '@/store/useToastStore';
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

interface LyricsCardProps {
  title: string;
  artist: string;
  coverUrl?: string | null;
  phrases: string[];
  cardWidth: number;
  cardHeight: number;
  gradientColors: [string, string, string, string];
  accentColor: string;
  t: any;
}

const LyricsShareCard = React.forwardRef<any, LyricsCardProps>(
  (
    {
      title,
      artist,
      coverUrl,
      phrases,
      cardWidth,
      cardHeight,
      gradientColors,
      accentColor,
      t,
    },
    ref
  ) => {
    // Dynamic typography calculations based on line count and character length
    const lineCount = Math.max(1, phrases.length);
    const maxChars = phrases.reduce((max, line) => Math.max(max, line.length), 0);
    const totalChars = phrases.reduce((sum, line) => sum + line.length, 0);

    let fontSize = 24;
    let lineHeight = 32;
    let phraseGap = 12;

    if (lineCount === 1) {
      if (maxChars > 70) {
        fontSize = 20;
        lineHeight = 28;
      } else if (maxChars > 40) {
        fontSize = 24;
        lineHeight = 33;
      } else {
        fontSize = 28;
        lineHeight = 38;
      }
      phraseGap = 0;
    } else if (lineCount === 2) {
      if (maxChars > 70 || totalChars > 120) {
        fontSize = 17;
        lineHeight = 24;
      } else if (maxChars > 40) {
        fontSize = 20;
        lineHeight = 28;
      } else {
        fontSize = 23;
        lineHeight = 32;
      }
      phraseGap = 12;
    } else if (lineCount === 3) {
      if (maxChars > 70 || totalChars > 160) {
        fontSize = 15;
        lineHeight = 21;
      } else if (maxChars > 40) {
        fontSize = 17;
        lineHeight = 24;
      } else {
        fontSize = 19;
        lineHeight = 27;
      }
      phraseGap = 10;
    } else if (lineCount === 4) {
      if (maxChars > 70 || totalChars > 180) {
        fontSize = 13;
        lineHeight = 18;
      } else if (maxChars > 40) {
        fontSize = 15;
        lineHeight = 21;
      } else {
        fontSize = 17;
        lineHeight = 23;
      }
      phraseGap = 8;
    } else {
      // 5 lines
      if (maxChars > 70 || totalChars > 200) {
        fontSize = 12;
        lineHeight = 16.5;
      } else if (maxChars > 40) {
        fontSize = 13.5;
        lineHeight = 19;
      } else {
        fontSize = 15;
        lineHeight = 21;
      }
      phraseGap = 6;
    }

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

          {/* Top Brand Header: Real App Icon at top-left */}
          <View style={cardStyles.brandHeader}>
            <Image
              source={require('../../assets/images/icon.png')}
              style={cardStyles.appIcon}
              contentFit="cover"
            />
          </View>

          {/* Upper-Middle: Small Song Cover + Metadata (Above Lyrics) */}
          <View style={cardStyles.songMetadataChip}>
            <View style={cardStyles.miniCoverWrapper}>
              {coverUrl ? (
                <Image
                  source={{ uri: coverUrl }}
                  style={cardStyles.miniCoverImage}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View style={cardStyles.miniCoverFallback}>
                  <Ionicons name="musical-notes" size={18} color="rgba(255,255,255,0.6)" />
                </View>
              )}
            </View>
            <View style={cardStyles.miniSongInfo}>
              <Text style={cardStyles.miniSongTitle} numberOfLines={1}>
                {title || t('player.unknown', { defaultValue: 'Canción desconocida' })}
              </Text>
              <Text style={cardStyles.miniArtistName} numberOfLines={1}>
                {artist || t('player.unknown', { defaultValue: 'Artista desconocido' })}
              </Text>
            </View>
          </View>

          {/* Center: Selected Lyrics (1 to 5 lines) */}
          <View style={cardStyles.lyricsCenterContainer}>
            <View style={[cardStyles.lyricsBox, { gap: phraseGap }]}>
              {phrases.map((phrase, idx) => (
                <Text
                  key={idx}
                  style={[
                    cardStyles.lyricPhraseText,
                    {
                      fontSize,
                      lineHeight,
                    },
                  ]}
                >
                  {phrase}
                </Text>
              ))}
            </View>
          </View>

          {/* Bottom Footer Watermark / Slogan */}
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

LyricsShareCard.displayName = 'LyricsShareCard';

export default function LyricsShareScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  const {
    title = '',
    artist = '',
    coverUrl = null,
    lyricsLines = [],
    initialIndex = -1,
  } = route.params || {};

  // Clean and prepare lines
  const formattedLines: string[] = useMemo(() => {
    if (Array.isArray(lyricsLines)) {
      return lyricsLines
        .map((item: any) => (typeof item === 'string' ? item : item?.text || ''))
        .map((text: string) => text.trim())
        .filter((text: string) => text.length > 0);
    }
    return [];
  }, [lyricsLines]);

  // Initial selection: preselect current active line if valid, or first line
  const [selectedIndices, setSelectedIndices] = useState<number[]>(() => {
    if (formattedLines.length === 0) return [];
    if (initialIndex >= 0 && initialIndex < formattedLines.length) {
      return [initialIndex];
    }
    return [0];
  });

  const [step, setStep] = useState<'select' | 'preview'>('select');
  const [extractedHex, setExtractedHex] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const viewShotRef = useRef<any>(null);

  // Extract cover color for dynamic gradient
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

  // Toggle selection for a line (max 5 lines)
  const handleToggleLine = (index: number) => {
    setSelectedIndices((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index);
      }
      if (prev.length >= 5) {
        useToastStore.getState().showToast(
          t('lyrics.max_phrases_reached', { defaultValue: 'Has alcanzado el límite de 5 frases' }),
          'information-circle'
        );
        return prev;
      }
      // Insert maintaining song order
      const next = [...prev, index].sort((a, b) => a - b);
      return next;
    });
  };

  // Selected phrases in song order
  const selectedPhrases = useMemo(() => {
    return selectedIndices
      .slice()
      .sort((a, b) => a - b)
      .map((idx) => formattedLines[idx])
      .filter(Boolean);
  }, [selectedIndices, formattedLines]);

  // Calculate 9:16 card dimensions to fit inside screen without scrolling
  const availableHeight = SCREEN_HEIGHT - insets.top - insets.bottom - 170;
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
          dialogTitle: t('lyrics.share_lyrics_title', { defaultValue: 'Compartir letras' }),
        });
      }
    } catch (err) {
      console.error('[LyricsShareScreen] Error capturing or sharing image:', err);
      setIsCapturing(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 14) }]}>
      <StatusBar style="light" backgroundColor="#000000" />

      {/* Screen Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (step === 'preview') {
              setStep('select');
            } else {
              navigation.goBack();
            }
          }}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          {step === 'select'
            ? t('lyrics.share_lyrics_title', { defaultValue: 'Compartir letras' })
            : t('lyrics.share_lyrics_preview', { defaultValue: 'Vista previa de la tarjeta' })}
        </Text>

        {step === 'select' ? (
          <View style={[styles.counterBadge, { backgroundColor: colors.accentLight }]}>
            <Text style={[styles.counterBadgeText, { color: colors.onAccentLight }]}>{selectedIndices.length}/5</Text>
          </View>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* STEP 1: Phrase Selection */}
      {step === 'select' ? (
        <View style={styles.selectionContainer}>
          {/* Song Info Bar */}
          <View style={styles.songInfoBar}>
            {coverUrl ? (
              <Image source={{ uri: coverUrl }} style={styles.infoCover} contentFit="cover" />
            ) : (
              <View style={[styles.infoCover, styles.infoCoverFallback]}>
                <Ionicons name="musical-notes" size={16} color="rgba(255,255,255,0.5)" />
              </View>
            )}
            <View style={styles.infoMeta}>
              <Text style={styles.infoTitle} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.infoArtist} numberOfLines={1}>
                {artist}
              </Text>
            </View>
          </View>

          {/* Instructions Hint */}
          <View style={styles.hintContainer}>
            <Text style={styles.hintText}>
              {t('lyrics.select_phrases_hint', { defaultValue: 'Selecciona de 1 a 5 frases para tu tarjeta' })}
            </Text>
          </View>

          {/* Lyrics Lines List */}
          <FlatList
            data={formattedLines}
            keyExtractor={(_, index) => index.toString()}
            contentContainerStyle={styles.linesListContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => {
              const isSelected = selectedIndices.includes(index);
              const isLimitReached = selectedIndices.length >= 5 && !isSelected;

              return (
                <TouchableOpacity
                  onPress={() => handleToggleLine(index)}
                  activeOpacity={0.7}
                  style={[
                    styles.lineItem,
                    isSelected && [
                      styles.lineItemSelected,
                      { borderColor: colors.accentLight },
                    ],
                    isLimitReached && styles.lineItemDimmed,
                  ]}
                >
                  <View
                    style={[
                      styles.checkboxCircle,
                      isSelected && {
                        backgroundColor: colors.accentLight,
                        borderColor: colors.accentLight,
                      },
                    ]}
                  >
                    {isSelected && <Ionicons name="checkmark" size={14} color={colors.onAccentLight} />}
                  </View>
                  <Text
                    style={[
                      styles.lineText,
                      isSelected ? styles.lineTextSelected : styles.lineTextUnselected,
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />

          {/* Continue Button */}
          <View style={styles.selectionBottomBar}>
            <TouchableOpacity
              onPress={() => setStep('preview')}
              disabled={selectedIndices.length === 0}
              style={[
                styles.continueBtn,
                {
                  backgroundColor:
                    selectedIndices.length > 0 ? colors.accent : 'rgba(255,255,255,0.15)',
                },
              ]}
              activeOpacity={0.8}
            >
              <Ionicons
                name="sparkles"
                size={18}
                color={selectedIndices.length > 0 ? colors.onAccent : 'rgba(255,255,255,0.4)'}
                style={{ marginRight: 8 }}
              />
              <Text
                style={[
                  styles.continueBtnText,
                  { color: selectedIndices.length > 0 ? colors.onAccent : 'rgba(255,255,255,0.4)' },
                ]}
              >
                {t('lyrics.create_card', { defaultValue: 'Ver tarjeta' })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* STEP 2: Card Preview & Share Actions */
        <View style={styles.previewStepWrapper}>
          {/* Card Preview Container */}
          <View style={styles.previewContainer}>
            <LyricsShareCard
              ref={viewShotRef}
              title={title}
              artist={artist}
              coverUrl={coverUrl}
              phrases={selectedPhrases}
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
              disabled={isCapturing}
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

            {/* Secondary Button: Edit Lines */}
            <TouchableOpacity
              onPress={() => setStep('select')}
              disabled={isCapturing}
              style={styles.secondaryShareBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={17} color="#E4E4E7" style={{ marginRight: 8 }} />
              <Text style={styles.secondaryShareBtnText}>
                {t('lyrics.edit_phrases', { defaultValue: 'Editar frases' })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
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
  counterBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  selectionContainer: {
    flex: 1,
  },
  songInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  infoCover: {
    width: 36,
    height: 36,
    borderRadius: 6,
    marginRight: 12,
  },
  infoCoverFallback: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoMeta: {
    flex: 1,
  },
  infoTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  infoArtist: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 1,
  },
  hintContainer: {
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  hintText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 13,
    fontWeight: '500',
  },
  linesListContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 8,
  },
  lineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  lineItemSelected: {
    backgroundColor: 'rgba(167, 139, 250, 0.16)',
    borderWidth: 1.5,
  },
  lineItemDimmed: {
    opacity: 0.4,
  },
  checkboxCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    marginRight: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lineText: {
    flex: 1,
    fontSize: 15,
  },
  lineTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  lineTextUnselected: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  selectionBottomBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: '#000000',
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 25,
  },
  continueBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  previewStepWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
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
    padding: 22,
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
  songMetadataChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    marginTop: 10,
    marginBottom: 8,
  },
  miniCoverWrapper: {
    width: 34,
    height: 34,
    borderRadius: 7,
    overflow: 'hidden',
    marginRight: 10,
  },
  miniCoverImage: {
    width: 34,
    height: 34,
    borderRadius: 7,
  },
  miniCoverFallback: {
    width: 34,
    height: 34,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniSongInfo: {
    flexShrink: 1,
  },
  miniSongTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  miniArtistName: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  lyricsCenterContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  lyricsBox: {
    justifyContent: 'center',
  },
  lyricPhraseText: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: -0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 3,
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
