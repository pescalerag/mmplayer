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
    r = Number.parseInt(hex[0] + hex[0], 16);
    g = Number.parseInt(hex[1] + hex[1], 16);
    b = Number.parseInt(hex[2] + hex[2], 16);
  } else if (hex.length === 6) {
    r = Number.parseInt(hex.substring(0, 2), 16);
    g = Number.parseInt(hex.substring(2, 4), 16);
    b = Number.parseInt(hex.substring(4, 6), 16);
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
      colors: ['#38234C', '#2E1C3F', '#251633', '#1F122C'] as [string, string, string, string],
      accent: '#C4B5FD',
      glow: 'rgba(167, 139, 250, 0.4)',
    };
  }
  try {
    const hsl = hexToHsl(extractedHex);
    // Use the exact hue from the cover, similar to LyricsScreen
    const h = hsl.s < 10 ? 245 : hsl.h;
    // Controlled, elegant saturation around the 30-40% level used by LyricsScreen
    const baseS = hsl.s < 10 ? 30 : Math.min(Math.max(hsl.s, 30), 45);

    // Color 1 (Top-Left): Intermediate tone based on LyricsScreen (L ~ 25%), not bright/neon
    const topColor = hslToHex(
      h,
      baseS + 4,
      25
    );

    // Color 2 (Upper-Mid): Smooth transition tone (L ~ 22%)
    const midColor1 = hslToHex(
      (h + 4) % 360,
      baseS + 1,
      22
    );

    // Color 3 (Lower-Mid): Deeper tone with subtle analogous shift (L ~ 19%)
    const midColor2 = hslToHex(
      (h - 6 + 360) % 360,
      baseS - 2,
      19
    );

    // Color 4 (Bottom-Right): Deep, rich colored base tone (L ~ 16%) - NEVER BLACK!
    const bottomColor = hslToHex(
      (h - 10 + 360) % 360,
      baseS - 4,
      16
    );

    const accent = hslToHex(h, Math.min(Math.max(hsl.s, 70), 90), 65);
    const glow = `rgba(${Math.round(baseS * 2.5)}, 120, 240, 0.4)`;

    return {
      colors: [topColor, midColor1, midColor2, bottomColor] as [string, string, string, string],
      accent,
      glow,
    };
  } catch {
    return {
      colors: ['#38234C', '#2E1C3F', '#251633', '#1F122C'] as [string, string, string, string],
      accent: '#C4B5FD',
      glow: 'rgba(167, 139, 250, 0.4)',
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

interface CardTypography {
  fontSize: number;
  lineHeight: number;
  phraseGap: number;
}

interface TypographyPreset {
  phraseGap: number;
  totalCharsThreshold: number;
  small: { fontSize: number; lineHeight: number };
  medium: { fontSize: number; lineHeight: number };
  large: { fontSize: number; lineHeight: number };
}

const LINE_COUNT_PRESETS: Record<number, TypographyPreset> = {
  1: {
    phraseGap: 0,
    totalCharsThreshold: Infinity,
    small: { fontSize: 20, lineHeight: 28 },
    medium: { fontSize: 24, lineHeight: 33 },
    large: { fontSize: 28, lineHeight: 38 },
  },
  2: {
    phraseGap: 12,
    totalCharsThreshold: 120,
    small: { fontSize: 17, lineHeight: 24 },
    medium: { fontSize: 20, lineHeight: 28 },
    large: { fontSize: 23, lineHeight: 32 },
  },
  3: {
    phraseGap: 10,
    totalCharsThreshold: 160,
    small: { fontSize: 15, lineHeight: 21 },
    medium: { fontSize: 17, lineHeight: 24 },
    large: { fontSize: 19, lineHeight: 27 },
  },
  4: {
    phraseGap: 8,
    totalCharsThreshold: 180,
    small: { fontSize: 13, lineHeight: 18 },
    medium: { fontSize: 15, lineHeight: 21 },
    large: { fontSize: 17, lineHeight: 23 },
  },
};

const DEFAULT_PRESET: TypographyPreset = {
  phraseGap: 6,
  totalCharsThreshold: 200,
  small: { fontSize: 12, lineHeight: 16.5 },
  medium: { fontSize: 13.5, lineHeight: 19 },
  large: { fontSize: 15, lineHeight: 21 },
};

function getCardTypography(phrases: string[]): CardTypography {
  const lineCount = Math.max(1, phrases.length);
  const maxChars = phrases.reduce((max, line) => Math.max(max, line.length), 0);
  const totalChars = phrases.reduce((sum, line) => sum + line.length, 0);

  const preset = LINE_COUNT_PRESETS[lineCount] ?? DEFAULT_PRESET;

  let textSizes = preset.large;
  if (maxChars > 70 || totalChars > preset.totalCharsThreshold) {
    textSizes = preset.small;
  } else if (maxChars > 40) {
    textSizes = preset.medium;
  }

  return {
    fontSize: textSizes.fontSize,
    lineHeight: textSizes.lineHeight,
    phraseGap: preset.phraseGap,
  };
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
    const { fontSize, lineHeight, phraseGap } = getCardTypography(phrases);

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
            start={{ x: 0.1, y: 0.05 }}
            end={{ x: 0.9, y: 0.95 }}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Top Brand Header: Real App Icon at top-left (Same as stats share) */}
          <View style={cardStyles.brandHeader}>
            <Image
              source={require('../../assets/images/splash-icon.png')}
              style={cardStyles.appIcon}
              contentFit="contain"
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
                  key={`${phrase}-${idx}`}
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

function getSingleLineSpan(current: number, index: number): number[] {
  if (index === current) return [];
  const start = Math.min(current, index);
  const end = Math.max(current, index);
  const span = end - start + 1;
  return span <= 5 ? Array.from({ length: span }, (_, i) => start + i) : [index];
}

function handleDeselectFromRange(prev: number[], index: number): number[] {
  const min = prev[0];
  const max = prev.at(-1);
  if (index === min) return prev.slice(1);
  if (index === max) return prev.slice(0, -1);
  return [index];
}

function notifySelectionLimit(isLimit: boolean, t: any) {
  const message = isLimit
    ? t('lyrics.max_phrases_reached', { defaultValue: 'Has alcanzado el límite de 5 frases' })
    : t('lyrics.consecutive_phrases_only', { defaultValue: 'Las frases deben ser consecutivas' });
  useToastStore.getState().showToast(message, 'information-circle');
}

function extendSelectionRange(prev: number[], index: number, t: any): number[] {
  const min = prev[0];
  const max = prev.at(-1)!;
  const newStart = Math.min(min, index);
  const newEnd = Math.max(max, index);
  const newSpan = newEnd - newStart + 1;

  if (newSpan <= 5) {
    return Array.from({ length: newSpan }, (_, i) => newStart + i);
  }

  notifySelectionLimit(prev.length >= 5, t);
  return prev;
}

function getNextSelectedIndices(prev: number[], index: number, t: any): number[] {
  if (prev.length === 0) return [index];
  if (prev.length === 1) return getSingleLineSpan(prev[0], index);
  if (prev.includes(index)) return handleDeselectFromRange(prev, index);
  return extendSelectionRange(prev, index, t);
}

function checkIsLineDimmed(index: number, selectedIndices: number[]): boolean {
  const isSelected = selectedIndices.includes(index);
  if (isSelected) return false;

  const count = selectedIndices.length;
  if (count >= 5) return true;
  if (count <= 1) return false;

  const minIndex = selectedIndices[0];
  const maxIndex = selectedIndices[count - 1];
  const canExtend =
    (index > maxIndex && index - minIndex + 1 <= 5) ||
    (index < minIndex && maxIndex - index + 1 <= 5);

  return !canExtend;
}

function getCardDimensions(insets: { top: number; bottom: number }) {
  const availableHeight = SCREEN_HEIGHT - insets.top - insets.bottom - 170;
  let cardHeight = Math.min(availableHeight, 540);
  let cardWidth = cardHeight * (9 / 16);

  if (cardWidth > SCREEN_WIDTH - 44) {
    cardWidth = SCREEN_WIDTH - 44;
    cardHeight = cardWidth * (16 / 9);
  }

  return { cardWidth, cardHeight };
}

interface LyricsLineItemProps {
  item: string;
  index: number;
  isSelected: boolean;
  isDimmed: boolean;
  accentLight: string;
  onAccentLight: string;
  onToggle: (index: number) => void;
}

const LyricsLineItem = React.memo(function LyricsLineItem({
  item,
  index,
  isSelected,
  isDimmed,
  accentLight,
  onAccentLight,
  onToggle,
}: LyricsLineItemProps) {
  return (
    <TouchableOpacity
      onPress={() => onToggle(index)}
      activeOpacity={0.7}
      style={[
        styles.lineItem,
        isSelected && [styles.lineItemSelected, { borderColor: accentLight }],
        isDimmed && styles.lineItemDimmed,
      ]}
    >
      <View
        style={[
          styles.checkboxCircle,
          isSelected && {
            backgroundColor: accentLight,
            borderColor: accentLight,
          },
        ]}
      >
        {isSelected && <Ionicons name="checkmark" size={14} color={onAccentLight} />}
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
});

interface LyricsSelectStepProps {
  readonly coverUrl: string | null;
  readonly title: string;
  readonly artist: string;
  readonly formattedLines: string[];
  readonly selectedIndices: number[];
  readonly accentColor: string;
  readonly onAccentColor: string;
  readonly accentLight: string;
  readonly onAccentLight: string;
  readonly t: any;
  readonly onToggleLine: (index: number) => void;
  readonly onContinue: () => void;
}

function LyricsSelectStep({
  coverUrl,
  title,
  artist,
  formattedLines,
  selectedIndices,
  accentColor,
  onAccentColor,
  accentLight,
  onAccentLight,
  t,
  onToggleLine,
  onContinue,
}: Readonly<LyricsSelectStepProps>) {
  const isSelectedEmpty = selectedIndices.length === 0;

  return (
    <View style={styles.selectionContainer}>
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

      <View style={styles.hintContainer}>
        <Text style={styles.hintText}>
          {t('lyrics.select_phrases_hint', {
            defaultValue: 'Selecciona de 1 a 5 frases consecutivas para tu tarjeta',
          })}
        </Text>
      </View>

      <FlatList
        data={formattedLines}
        keyExtractor={(_, index) => index.toString()}
        contentContainerStyle={styles.linesListContent}
        showsVerticalScrollIndicator={false}
        extraData={selectedIndices}
        renderItem={({ item, index }) => (
          <LyricsLineItem
            item={item}
            index={index}
            isSelected={selectedIndices.includes(index)}
            isDimmed={checkIsLineDimmed(index, selectedIndices)}
            accentLight={accentLight}
            onAccentLight={onAccentLight}
            onToggle={onToggleLine}
          />
        )}
      />

      <View style={styles.selectionBottomBar}>
        <TouchableOpacity
          onPress={onContinue}
          disabled={isSelectedEmpty}
          style={[
            styles.continueBtn,
            {
              backgroundColor: isSelectedEmpty ? 'rgba(255,255,255,0.15)' : accentColor,
            },
          ]}
          activeOpacity={0.8}
        >
          <Ionicons
            name="sparkles"
            size={18}
            color={isSelectedEmpty ? 'rgba(255,255,255,0.4)' : onAccentColor}
            style={{ marginRight: 8 }}
          />
          <Text
            style={[
              styles.continueBtnText,
              { color: isSelectedEmpty ? 'rgba(255,255,255,0.4)' : onAccentColor },
            ]}
          >
            {t('lyrics.create_card', { defaultValue: 'Ver tarjeta' })}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface LyricsPreviewStepProps {
  readonly viewShotRef: React.RefObject<any>;
  readonly title: string;
  readonly artist: string;
  readonly coverUrl: string | null;
  readonly phrases: string[];
  readonly cardWidth: number;
  readonly cardHeight: number;
  readonly gradientColors: [string, string, string, string];
  readonly cardAccentColor: string;
  readonly btnAccentColor: string;
  readonly onAccentColor: string;
  readonly isCapturing: boolean;
  readonly t: any;
  readonly onCaptureAndShare: () => void;
  readonly onEdit: () => void;
}

function LyricsPreviewStep({
  viewShotRef,
  title,
  artist,
  coverUrl,
  phrases,
  cardWidth,
  cardHeight,
  gradientColors,
  cardAccentColor,
  btnAccentColor,
  onAccentColor,
  isCapturing,
  t,
  onCaptureAndShare,
  onEdit,
}: Readonly<LyricsPreviewStepProps>) {
  return (
    <View style={styles.previewStepWrapper}>
      <View style={styles.previewContainer}>
        <LyricsShareCard
          ref={viewShotRef}
          title={title}
          artist={artist}
          coverUrl={coverUrl}
          phrases={phrases}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
          gradientColors={gradientColors}
          accentColor={cardAccentColor}
          t={t}
        />
      </View>

      <View style={[styles.actionsContainer, { width: Math.min(SCREEN_WIDTH - 40, cardWidth) }]}>
        <TouchableOpacity
          onPress={onCaptureAndShare}
          disabled={isCapturing}
          style={[styles.primaryShareBtn, { backgroundColor: btnAccentColor }]}
          activeOpacity={0.8}
        >
          {isCapturing ? (
            <ActivityIndicator size="small" color={onAccentColor} />
          ) : (
            <>
              <Ionicons name="image-outline" size={19} color={onAccentColor} style={{ marginRight: 8 }} />
              <Text style={[styles.primaryShareBtnText, { color: onAccentColor }]}>
                {t('player.share_as_image', { defaultValue: 'Compartir imagen' })}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onEdit}
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
  );
}

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

  const { colors: gradientColors, accent: gradientAccentColor } = useMemo(
    () => generateCoverGradients(extractedHex),
    [extractedHex]
  );

  // Toggle selection enforcing consecutive phrases (up to 5 consecutive lines, backward or forward)
  const handleToggleLine = (index: number) => {
    setSelectedIndices((prev) => getNextSelectedIndices(prev, index, t));
  };

  // Selected phrases in song order
  const selectedPhrases = useMemo(() => {
    return selectedIndices
      .map((idx) => formattedLines[idx])
      .filter(Boolean);
  }, [selectedIndices, formattedLines]);

  const { cardWidth, cardHeight } = useMemo(
    () => getCardDimensions(insets),
    [insets]
  );

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

  const handleBackPress = () => {
    if (step === 'preview') {
      setStep('select');
    } else {
      navigation.goBack();
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 14) }]}>
      <StatusBar style="light" backgroundColor="#000000" />

      {/* Screen Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBackPress}
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
          <TouchableOpacity
            onPress={() => setSelectedIndices([])}
            disabled={selectedIndices.length === 0}
            activeOpacity={0.7}
            style={[
              styles.counterBadge,
              { backgroundColor: selectedIndices.length > 0 ? colors.accentLight : 'rgba(255, 255, 255, 0.1)' },
            ]}
          >
            <Text
              style={[
                styles.counterBadgeText,
                { color: selectedIndices.length > 0 ? colors.onAccentLight : 'rgba(255, 255, 255, 0.4)' },
              ]}
            >
              {selectedIndices.length}/5
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {step === 'select' ? (
        <LyricsSelectStep
          coverUrl={coverUrl}
          title={title}
          artist={artist}
          formattedLines={formattedLines}
          selectedIndices={selectedIndices}
          accentColor={colors.accent}
          onAccentColor={colors.onAccent}
          accentLight={colors.accentLight}
          onAccentLight={colors.onAccentLight}
          t={t}
          onToggleLine={handleToggleLine}
          onContinue={() => setStep('preview')}
        />
      ) : (
        <LyricsPreviewStep
          viewShotRef={viewShotRef}
          title={title}
          artist={artist}
          coverUrl={coverUrl}
          phrases={selectedPhrases}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
          gradientColors={gradientColors}
          cardAccentColor={gradientAccentColor}
          btnAccentColor={colors.accent}
          onAccentColor={colors.onAccent}
          isCapturing={isCapturing}
          t={t}
          onCaptureAndShare={handleCaptureAndShareImage}
          onEdit={() => setStep('select')}
        />
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
    backgroundColor: 'transparent',
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
    width: 42,
    height: 42,
    borderRadius: 0,
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
