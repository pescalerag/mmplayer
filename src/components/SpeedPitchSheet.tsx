import { useAppTheme } from "@/hooks/useAppTheme";
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { usePlayerStore } from '../store/usePlayerStore';

// Maps speed S in [0.5, 2.0] to slider value X in [-1.0, 1.0]
const speedToSliderValue = (speed: number): number => {
  if (speed < 1) {
    return (speed - 1) * 2;
  } else {
    return speed - 1;
  }
};

// Maps slider value X in [-1.0, 1.0] to speed S in [0.5, 2.0] rounded to the nearest 0.05
const sliderValueToSpeed = (val: number): number => {
  let rawSpeed = 1;
  if (val < 0) {
    rawSpeed = 1 + val * 0.5;
  } else {
    rawSpeed = 1 + val * 1;
  }
  return Math.round(rawSpeed / 0.05) * 0.05;
};

// Pitch helpers: Convert between semitones [-2, 2] and playback pitch factor
const semitonesToPitch = (semitones: number): number => {
  return Math.pow(2, semitones / 12);
};

const pitchToSemitones = (pitch: number): number => {
  return Math.round(12 * Math.log2(pitch));
};

export default function SpeedPitchSheet() {
  const { colors, fonts, layout } = useAppTheme();
  const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
  const {
    playbackSpeed,
    setPlaybackSpeed,
    playbackPitch,
    setPlaybackPitch,
    isVinylModeEnabled,
    setVinylModeEnabled
  } = usePlayerStore();
  const { t } = useTranslation();

  // Local state to track/smooth layout updates
  const [localSpeed, setLocalSpeed] = useState(playbackSpeed);
  const [localPitch, setLocalPitch] = useState(playbackPitch || 1);

  // Sync local state when store values change (e.g. on mount/hydrate)
  useEffect(() => {
    setLocalSpeed(playbackSpeed);
    setLocalPitch(isVinylModeEnabled ? playbackSpeed : (playbackPitch || 1));
  }, [playbackSpeed, playbackPitch, isVinylModeEnabled]);

  const handleResetSpeed = () => {
    setLocalSpeed(1);
    setPlaybackSpeed(1);
    if (isVinylModeEnabled) {
      setLocalPitch(1);
    }
  };

  const handleSpeedSliderChange = (val: number) => {
    const newSpeed = sliderValueToSpeed(val);
    if (newSpeed !== localSpeed) {
      setLocalSpeed(newSpeed);
      if (isVinylModeEnabled) {
        setLocalPitch(newSpeed);
      }
    }
  };

  const handleSpeedSlidingComplete = (val: number) => {
    const newSpeed = sliderValueToSpeed(val);
    setPlaybackSpeed(newSpeed);
  };

  const handleResetPitch = () => {
    if (isVinylModeEnabled) return;
    setLocalPitch(1);
    setPlaybackPitch(1);
  };

  const handlePitchSliderChange = (val: number) => {
    if (isVinylModeEnabled) return;
    const newPitch = semitonesToPitch(val);
    if (newPitch !== localPitch) {
      setLocalPitch(newPitch);
    }
  };

  const handlePitchSlidingComplete = (val: number) => {
    if (isVinylModeEnabled) return;
    const newPitch = semitonesToPitch(val);
    setPlaybackPitch(newPitch);
  };

  const currentSemitones = pitchToSemitones(localPitch);
  let semitonesText = '';
  if (isVinylModeEnabled) {
    semitonesText = t('audio_effects.pitch_locked') || 'Bloqueado';
  } else if (currentSemitones === 0) {
    semitonesText = "Normal";
  } else if (currentSemitones > 0) {
    semitonesText = `+${currentSemitones} st`;
  } else {
    semitonesText = `${currentSemitones} st`;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('audio_effects.title') || 'Efectos de Audio'}</Text>
      </View>

      {/* Speed Controls */}
      <View style={styles.controlSection}>
        <View style={styles.labelRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="speedometer-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.controlLabel}>{t('audio_effects.speed') || 'Velocidad'}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={styles.valueText}>{localSpeed.toFixed(2)}x</Text>
            {localSpeed !== 1 && (
              <TouchableOpacity onPress={handleResetSpeed} style={styles.resetButton}>
                <Text style={styles.resetButtonText}>{t('audio_effects.reset') || 'Restablecer'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={-1}
          maximumValue={1}
          step={0.01}
          value={speedToSliderValue(localSpeed)}
          onValueChange={handleSpeedSliderChange}
          onSlidingComplete={handleSpeedSlidingComplete}
          minimumTrackTintColor={colors.accent}
          maximumTrackTintColor="#282828"
          thumbTintColor="#FFFFFF"
        />
      </View>

      {/* Vinyl Mode Toggle */}
      <View style={styles.toggleRow}>
        <View style={{ flex: 1, paddingRight: 15 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Ionicons name="disc-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.controlLabel}>{t('audio_effects.vinyl_mode') || 'Modo Vinilo / Hi-Fi'}</Text>
          </View>
          <Text style={styles.toggleDesc}>
            {t('audio_effects.vinyl_mode_desc') || 'Ajusta el tono con la velocidad (analógico puro)'}
          </Text>
        </View>
        <Switch
          value={isVinylModeEnabled}
          onValueChange={setVinylModeEnabled}
          trackColor={{ false: '#282828', true: colors.accent }}
          thumbColor={isVinylModeEnabled ? '#FFFFFF' : '#888888'}
          ios_backgroundColor="#282828"
        />
      </View>

      {/* Pitch Controls */}
      <View style={[styles.controlSection, isVinylModeEnabled && { opacity: 0.4 }]}>
        <View style={styles.labelRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="musical-notes-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.controlLabel}>{t('audio_effects.pitch') || 'Tono'}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={styles.valueText}>{semitonesText}</Text>
            {!isVinylModeEnabled && localPitch !== 1 && (
              <TouchableOpacity onPress={handleResetPitch} style={styles.resetButton}>
                <Text style={styles.resetButtonText}>{t('audio_effects.reset') || 'Restablecer'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={-2}
          maximumValue={2}
          step={1}
          value={currentSemitones}
          onValueChange={handlePitchSliderChange}
          onSlidingComplete={handlePitchSlidingComplete}
          minimumTrackTintColor={colors.accent}
          maximumTrackTintColor="#282828"
          thumbTintColor="#FFFFFF"
          disabled={isVinylModeEnabled}
        />
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
  controlSection: {
    marginBottom: 24,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  controlLabel: {
    color: colors.text,
    fontSize: 16,
    fontFamily: fonts.regular,
    fontWeight: '700',
  },
  valueText: {
    color: colors.accentLight,
    fontSize: 16,
    fontFamily: fonts.regular,
    fontWeight: '700',
  },
  resetButton: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  resetButtonText: {
    color: colors.accentLight,
    fontSize: 11,
    fontFamily: fonts.regular,
    fontWeight: '700',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1C1C1E',
    paddingVertical: 14,
    marginBottom: 24,
  },
  toggleDesc: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: fonts.regular,
    marginTop: 2,
  },
});
