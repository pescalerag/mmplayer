import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  Switch,
  Text,
  View,
  ScrollView,
} from 'react-native';
import { HomeSection, useSettingsStore } from '../../store/useSettingsStore';
import { useAppTheme } from '@/hooks/useAppTheme';

const SECTIONS_METADATA: { id: HomeSection; labelKey: string; fallbackLabel: string; icon: any }[] = [
  { id: 'stats', labelKey: 'home.weekly_highlights', fallbackLabel: 'Destacados de la semana', icon: 'stats-chart' },
  { id: 'recent_media', labelKey: 'home.recently_played', fallbackLabel: 'Escuchado recientemente', icon: 'time' },
  { id: 'smart_playlists', labelKey: 'home.smart_playlists_title', fallbackLabel: 'Listas inteligentes', icon: 'sparkles' },
  { id: 'recent_playlists', labelKey: 'home.my_playlists', fallbackLabel: 'Mis listas de reproducción', icon: 'list' },
  { id: 'recently_added', labelKey: 'home.recently_added_albums', fallbackLabel: 'Álbumes añadidos recientemente', icon: 'albums' },
  { id: 'most_played', labelKey: 'home.most_played_songs', fallbackLabel: 'Tus más escuchadas', icon: 'musical-notes' },
  { id: 'explore', labelKey: 'home.explore_albums', fallbackLabel: 'Explorar álbumes aleatorios', icon: 'compass' },
];

export default function HomeSectionsSheet() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  const {
    homeSectionsVisibility,
    setHomeSectionsVisibility,
    showGlobalShuffle,
    setShowGlobalShuffle
  } = useSettingsStore();

  const handleToggle = (sectionId: HomeSection, value: boolean) => {
    const updated = {
      ...homeSectionsVisibility,
      [sectionId]: value
    };
    setHomeSectionsVisibility(updated);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('settings.home_sections_title') || "Secciones de inicio"}</Text>
        <Text style={styles.subtitle}>{t('settings.home_sections_subtitle') || "Activa o desactiva las secciones de la pantalla principal"}</Text>
      </View>

      <ScrollView style={styles.listContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {SECTIONS_METADATA.map((section) => {
          const isEnabled = homeSectionsVisibility[section.id] ?? true;
          return (
            <View key={section.id} style={styles.itemContainer}>
              <View style={styles.itemLeft}>
                <Ionicons name={section.icon} size={22} color={colors.accent} style={styles.itemIcon} />
                <Text style={styles.itemText}>{t(section.labelKey) || section.fallbackLabel}</Text>
              </View>
              <Switch
                value={isEnabled}
                onValueChange={(val) => handleToggle(section.id, val)}
                trackColor={{ false: '#282828', true: colors.accent }}
                thumbColor={isEnabled ? '#FFFFFF' : '#888888'}
                ios_backgroundColor="#282828"
              />
            </View>
          );
        })}

        <View style={styles.separator} />

        <View style={styles.itemContainer}>
          <View style={styles.itemLeft}>
            <Ionicons name="shuffle" size={22} color={colors.accent} style={styles.itemIcon} />
            <Text style={styles.itemText}>{t('home.home_shuffle_button') || "Botón de reproducción aleatoria"}</Text>
          </View>
          <Switch
            value={showGlobalShuffle}
            onValueChange={setShowGlobalShuffle}
            trackColor={{ false: '#282828', true: colors.accent }}
            thumbColor={showGlobalShuffle ? '#FFFFFF' : '#888888'}
            ios_backgroundColor="#282828"
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  title: {
    fontSize: 20,
    fontFamily: 'Montserrat',
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Montserrat',
    fontWeight: '700',
    color: '#CCCCCC',
    marginTop: 6,
  },
  listContent: {
    paddingTop: 10,
    paddingBottom: 40,
    maxHeight: 400,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },
  itemIcon: {
    marginRight: 16,
  },
  itemText: {
    fontSize: 16,
    fontFamily: 'Montserrat',
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: '#1E1E1E',
    marginVertical: 8,
  },
});
