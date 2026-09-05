import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { useAppTheme } from '../../hooks/useAppTheme';
import { usePlayerStore } from '../../store/usePlayerStore';
import { database } from '../../database';
import Track from '../../database/models/Track';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useToastStore } from '../../store/useToastStore';
import { LinearGradient } from 'expo-linear-gradient';

export const GlobalShuffleButton: React.FC = () => {
  const { colors, fonts, spacing, radii } = useAppTheme();
  const { t } = useTranslation();
  const [loading, setLoading] = React.useState(false);

  const handleShuffle = async () => {
    setLoading(true);
    try {
      const allTracks = await database.collections.get<Track>('tracks').query().fetch();
      if (allTracks.length === 0) {
        useToastStore.getState().showToast(t('home.no_tracks_to_shuffle') || "No hay canciones para reproducir", "warning");
        return;
      }
      await usePlayerStore.getState().startShuffled(allTracks, 'global');
      useToastStore.getState().showToast(t('home.shuffling_library') || "Reproduciendo biblioteca aleatoriamente", "shuffle");
    } catch (e) {
      console.error("[GlobalShuffleButton] Shuffle error:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={handleShuffle}
      disabled={loading}
      activeOpacity={0.85}
      style={{
        marginHorizontal: spacing.lg || 20,
        marginVertical: 10,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      }}
    >
      <LinearGradient
        colors={[colors.accent, colors.accentDark || '#4C1D95']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.banner,
          {
            borderRadius: radii.md || 8,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.onAccent} style={{ alignSelf: 'center', width: '100%' }} />
        ) : (
          <>
            <View style={styles.textContainer}>
              <Text style={[styles.text, { fontFamily: fonts.bold, color: colors.onAccent }]}>
                {t('home.global_shuffle') || 'REPRODUCCIÓN ALEATORIA'}
              </Text>
            </View>
            <Ionicons name="shuffle" size={24} color={colors.onAccent} />
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  textContainer: {
    flex: 1,
    marginRight: 10,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    letterSpacing: 1.2,
    fontWeight: '800',
  },
});
