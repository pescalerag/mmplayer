import React, { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useUIStore } from '@/store/useUIStore';
import {
  NotificationType,
  NotificationPreferences,
  useSettingsStore,
} from '@/store/useSettingsStore';

interface NotificationSettingItem {
  id: NotificationType;
  titleKey: string;
  descKey: string;
  fallbackTitle: string;
  fallbackDesc: string;
}

interface NotificationSection {
  titleKey: string;
  fallbackTitle: string;
  items: NotificationSettingItem[];
}

const NOTIFICATION_SECTIONS: NotificationSection[] = [
  {
    titleKey: 'notifications.settings_section_library',
    fallbackTitle: 'Biblioteca',
    items: [
      {
        id: 'songs_added',
        titleKey: 'notifications.settings_songs_added',
        descKey: 'notifications.settings_songs_added_desc',
        fallbackTitle: 'Canciones añadidas',
        fallbackDesc: 'Avisar cuando se añaden nuevas canciones a tu biblioteca',
      },
      {
        id: 'songs_moved',
        titleKey: 'notifications.settings_songs_moved',
        descKey: 'notifications.settings_songs_moved_desc',
        fallbackTitle: 'Canciones reubicadas',
        fallbackDesc: 'Avisar cuando se mueven o renombran pistas',
      },
      {
        id: 'songs_deleted',
        titleKey: 'notifications.settings_songs_deleted',
        descKey: 'notifications.settings_songs_deleted_desc',
        fallbackTitle: 'Canciones eliminadas',
        fallbackDesc: 'Avisar cuando se eliminan archivos de la biblioteca',
      },
    ],
  },
  {
    titleKey: 'notifications.settings_section_summaries',
    fallbackTitle: 'Resúmenes y actividad',
    items: [
      {
        id: 'summary_weekly',
        titleKey: 'notifications.settings_summary_weekly',
        descKey: 'notifications.settings_summary_weekly_desc',
        fallbackTitle: 'Resumen semanal',
        fallbackDesc: 'Informe semanal de escucha cada lunes a las 9:00 AM',
      },
      {
        id: 'summary_monthly',
        titleKey: 'notifications.settings_summary_monthly',
        descKey: 'notifications.settings_summary_monthly_desc',
        fallbackTitle: 'Resumen mensual',
        fallbackDesc: 'Estadísticas del mes transcurrido el día 1 de cada mes',
      },
      {
        id: 'summary_yearly',
        titleKey: 'notifications.settings_summary_yearly',
        descKey: 'notifications.settings_summary_yearly_desc',
        fallbackTitle: 'Resumen anual',
        fallbackDesc: 'Retrospectiva musical de todo el año transcurrido',
      },
    ],
  },
  {
    titleKey: 'notifications.settings_section_system',
    fallbackTitle: 'Sistema',
    items: [
      {
        id: 'app_update',
        titleKey: 'notifications.settings_app_update',
        descKey: 'notifications.settings_app_update_desc',
        fallbackTitle: 'Actualizaciones de la app',
        fallbackDesc: 'Avisar cuando haya una nueva versión disponible',
      },
    ],
  },
];

export default function NotificationSettingsSheet() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const closeSheet = useUIStore((state) => state.closeSheet);

  const { notificationPreferences, setNotificationPreferences } = useSettingsStore();

  // Estado borrador local: sólo se confirma al pulsar el botón de guardar
  const [draftPreferences, setDraftPreferences] = useState<NotificationPreferences>(() => ({
    ...notificationPreferences,
  }));

  const handleToggle = useCallback((id: NotificationType, value: boolean) => {
    setDraftPreferences((prev) => ({
      ...prev,
      [id]: value,
    }));
  }, []);

  const handleSave = useCallback(() => {
    setNotificationPreferences(draftPreferences);
    closeSheet();
  }, [draftPreferences, setNotificationPreferences, closeSheet]);

  const renderedSections = useMemo(() => {
    return NOTIFICATION_SECTIONS.map((section) => (
      <View key={section.titleKey} style={styles.sectionBlock}>
        <Text style={styles.sectionHeader}>
          {t(section.titleKey) || section.fallbackTitle}
        </Text>
        {section.items.map((item) => {
          const isEnabled = draftPreferences[item.id] ?? true;
          return (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text
                  style={[
                    styles.itemTitle,
                    !isEnabled && { color: colors.textSecondary || '#888888' },
                  ]}
                  numberOfLines={1}
                >
                  {t(item.titleKey) || item.fallbackTitle}
                </Text>
                <Text
                  style={[
                    styles.itemSubtitle,
                    !isEnabled && { color: '#666666' },
                  ]}
                  numberOfLines={2}
                >
                  {t(item.descKey) || item.fallbackDesc}
                </Text>
              </View>

              <Switch
                value={isEnabled}
                onValueChange={(val) => handleToggle(item.id, val)}
                trackColor={{ false: '#282828', true: colors.accent }}
                thumbColor={isEnabled ? '#FFFFFF' : '#888888'}
                ios_backgroundColor="#282828"
              />
            </View>
          );
        })}
      </View>
    ));
  }, [t, colors, draftPreferences, handleToggle]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {t('notifications.settings_title') || 'Ajustes de notificaciones'}
        </Text>
        <Text style={styles.subtitle}>
          {t('notifications.settings_subtitle') || 'Las notificaciones se mostrarán exclusivamente en el buzón de la app, sin avisos del sistema'}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderedSections}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.confirmButton, { backgroundColor: colors.accent }]}
          onPress={handleSave}
          activeOpacity={0.8}
        >
          <Text style={[styles.confirmButtonText, { color: colors.onAccent || '#FFFFFF' }]}>
            {t('notifications.save_preferences') || 'Guardar preferencias'}
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
  scrollArea: {
    maxHeight: 380,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 12,
  },
  sectionBlock: {
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontFamily: 'Montserrat',
    fontWeight: '800',
    color: '#B3B3B3',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginVertical: 8,
    paddingHorizontal: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginVertical: 2,
  },
  itemInfo: {
    flex: 1,
    paddingRight: 16,
  },
  itemTitle: {
    fontSize: 15,
    fontFamily: 'Montserrat',
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: 12,
    fontFamily: 'Montserrat',
    fontWeight: '700',
    color: '#AAAAAA',
    lineHeight: 16,
  },
  footer: {
    paddingTop: 14,
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
