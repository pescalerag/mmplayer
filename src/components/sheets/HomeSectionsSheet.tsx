import { useAppTheme } from '@/hooks/useAppTheme';
import { useSheetProps } from '@/hooks/useSheetProps';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dimensions,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeSection, useSettingsStore } from '../../store/useSettingsStore';

interface SectionItem {
  id: HomeSection;
  labelKey: string;
  fallbackLabel: string;
}

const ALL_SECTIONS: SectionItem[] = [
  { id: 'recent_media', labelKey: 'home.recently_played', fallbackLabel: 'Escuchado recientemente' },
  { id: 'stats', labelKey: 'settings.home_section_stats', fallbackLabel: 'Widget de estadísticas' },
  { id: 'smart_playlists', labelKey: 'home.smart_playlists_title', fallbackLabel: 'Listas inteligentes' },
  { id: 'recent_playlists', labelKey: 'home.my_playlists', fallbackLabel: 'Mis listas de reproducción' },
  { id: 'recently_added', labelKey: 'home.recently_added_albums', fallbackLabel: 'Álbumes añadidos recientemente' },
  { id: 'most_played', labelKey: 'home.most_played_songs', fallbackLabel: 'Tus más escuchadas' },
  { id: 'explore', labelKey: 'home.explore_albums', fallbackLabel: 'Explorar álbumes aleatorios' },
  { id: 'shuffle_button', labelKey: 'settings.home_section_shuffle', fallbackLabel: 'Botón de reproducción aleatoria' },
];

export default function HomeSectionsSheet() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { close: closeSheet } = useSheetProps('home-sections');
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get('window').height;

  // Calculamos la altura disponible para la lista para evitar overflow en pantallas con barra de navegación
  const listHeight = Math.min(320, Math.max(220, screenHeight * 0.38));

  const {
    homeSectionsOrder,
    setHomeSectionsOrder,
    homeSectionsVisibility,
    setHomeSectionsVisibility,
    setShowGlobalShuffle,
    showHomeGreeting,
    setShowHomeGreeting,
  } = useSettingsStore();

  const [localShowGreeting, setLocalShowGreeting] = useState(() => showHomeGreeting ?? true);
  const [data, setData] = useState<SectionItem[]>(() => {
    const currentOrder = homeSectionsOrder || [];
    const ordered = currentOrder
      .map((id) => ALL_SECTIONS.find((s) => s.id === id)!)
      .filter(Boolean);
    const missing = ALL_SECTIONS.filter((s) => !currentOrder.includes(s.id));
    return [...ordered, ...missing];
  });
  const [localVisibility, setLocalVisibility] = useState<Record<HomeSection, boolean>>(() => ({
    ...(homeSectionsVisibility || ({} as Record<HomeSection, boolean>)),
  }));

  const onDragEnd = ({ data }: { data: SectionItem[] }) => {
    setData(data);
  };

  const handleToggle = (sectionId: HomeSection, value: boolean) => {
    setLocalVisibility((prev) => ({
      ...prev,
      [sectionId]: value,
    }));
  };

  const handleDone = () => {
    setHomeSectionsOrder(data.map((item) => item.id));
    setHomeSectionsVisibility(localVisibility);
    setShowHomeGreeting(localShowGreeting);
    if (localVisibility.shuffle_button !== undefined) {
      setShowGlobalShuffle(localVisibility.shuffle_button);
    }
    closeSheet();
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<SectionItem>) => {
    const isEnabled = localVisibility[item.id] ?? true;

    return (
      <ScaleDecorator>
        <View
          style={[
            styles.itemContainer,
            { backgroundColor: isActive ? (colors.accentAlpha15 || 'rgba(139, 92, 246, 0.15)') : 'transparent' }
          ]}
        >
          <View style={styles.itemLeft}>
            <Text
              style={[
                styles.itemText,
                !isEnabled && { color: colors.textSecondary || '#888888' }
              ]}
              numberOfLines={1}
            >
              {t(item.labelKey) || item.fallbackLabel}
            </Text>
          </View>

          <View style={styles.itemRight}>
            <Switch
              value={isEnabled}
              onValueChange={(val) => handleToggle(item.id, val)}
              trackColor={{ false: '#282828', true: colors.accent }}
              thumbColor={isEnabled ? '#FFFFFF' : '#888888'}
              ios_backgroundColor="#282828"
            />
            <TouchableOpacity
              onLongPress={drag}
              delayLongPress={200}
              style={styles.dragHandle}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              <Ionicons name="menu" size={24} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
      </ScaleDecorator>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('settings.home_sections_title') || 'Secciones de inicio'}</Text>
        <Text style={styles.subtitle}>{t('settings.home_sections_subtitle') || 'Personaliza el orden y visibilidad de las secciones'}</Text>
      </View>

      <View style={styles.fixedOptionContainer}>
        <View style={styles.itemLeft}>
          <Text
            style={[
              styles.itemText,
              !localShowGreeting && { color: colors.textSecondary || '#888888' },
            ]}
            numberOfLines={1}
          >
            {t('settings.home_greeting') || 'Saludo de bienvenida'}
          </Text>
          <Text style={styles.itemSubtext}>
            {t('settings.home_greeting_desc') || 'Mostrar saludo al inicio de la pantalla'}
          </Text>
        </View>

        <View style={styles.itemRight}>
          <Switch
            value={localShowGreeting}
            onValueChange={setLocalShowGreeting}
            trackColor={{ false: '#282828', true: colors.accent }}
            thumbColor={localShowGreeting ? '#FFFFFF' : '#888888'}
            ios_backgroundColor="#282828"
          />
        </View>
      </View>

      <Text style={styles.sectionTitle}>
        {t('settings.drag_to_reorder_home_sections') || 'Orden de las secciones (Mantén presionado para mover)'}
      </Text>

      <GestureHandlerRootView style={{ height: listHeight }}>
        <DraggableFlatList
          data={data}
          onDragEnd={onDragEnd}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </GestureHandlerRootView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={[styles.confirmButton, { backgroundColor: colors.accent }]}
          onPress={handleDone}
          activeOpacity={0.8}
        >
          <Text style={[styles.confirmButtonText, { color: colors.onAccent || '#FFFFFF' }]}>
            {t('common.done') || 'Listo'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    paddingBottom: 16,
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
  fixedOptionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  itemSubtext: {
    fontSize: 12,
    fontFamily: 'Montserrat',
    fontWeight: '700',
    color: '#888888',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Montserrat',
    fontWeight: '700',
    color: '#B3B3B3',
    marginVertical: 12,
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: 10,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginVertical: 2,
  },
  itemLeft: {
    flex: 1,
    paddingRight: 12,
  },
  itemText: {
    fontSize: 15,
    fontFamily: 'Montserrat',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dragHandle: {
    paddingLeft: 4,
    paddingVertical: 4,
  },
  footer: {
    paddingTop: 12,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 16,
  },
  confirmButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat',
    fontWeight: '800',
  },
});
