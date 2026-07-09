import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useSheetProps } from '@/hooks/useSheetProps';
import { LibraryTabType, useSettingsStore } from '../../store/useSettingsStore';
import { saveSettingsAndRestart } from '../../utils/restartHelper';
import { DraggableTabItem } from '@/components/common/DraggableTabItem';

const ALL_TABS: { id: LibraryTabType, labelKey: string, icon: any }[] = [
  { id: 'albums', labelKey: 'library.albums', icon: 'albums' },
  { id: 'playlists', labelKey: 'library.playlists', icon: 'list' },
  { id: 'artists', labelKey: 'library.artists', icon: 'people' },
  { id: 'folders', labelKey: 'library.folders', icon: 'folder' },
  { id: 'tracks', labelKey: 'library.songs', icon: 'musical-notes' },
];

export default function LibraryTabsOrderSheet() {
  const { t } = useTranslation();
  const { close: closeSheet } = useSheetProps('library-tabs-order');
  const { libraryTabsOrder } = useSettingsStore();

  const [data, setData] = useState(ALL_TABS);
  const [isRestarting, setIsRestarting] = useState(false);

  // Sync initially
  useEffect(() => {
    const ordered = libraryTabsOrder.map(tabId => ALL_TABS.find(t => t.id === tabId)!).filter(Boolean);
    const missing = ALL_TABS.filter(t => !libraryTabsOrder.includes(t.id));
    setData([...ordered, ...missing]);
  }, [libraryTabsOrder]);

  const onDragEnd = ({ data }: { data: typeof ALL_TABS }) => {
    setData(data);
  };

  const handleConfirmAndRestart = async () => {
    if (isRestarting) return;
    setIsRestarting(true);

    await saveSettingsAndRestart({
      libraryTabsOrder: data.map(t => t.id)
    });

    closeSheet();
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<typeof ALL_TABS[0]>) => {
    return (
      <DraggableTabItem
        icon={item.icon}
        label={t(item.labelKey)}
        drag={drag}
        isActive={isActive}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('settings.library_tabs_title') || 'Pestañas de la biblioteca'}</Text>
        <Text style={styles.subtitle}>{t('settings.library_tabs_subtitle') || 'Personaliza la biblioteca'}</Text>
      </View>

      <Text style={styles.sectionTitle}>
        {t('settings.drag_to_reorder_library_tabs') || 'Orden de las pestañas (Mantén presionado para mover)'}
      </Text>

      <GestureHandlerRootView style={{ height: 350 }}>
        <DraggableFlatList
          data={data}
          onDragEnd={onDragEnd}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </GestureHandlerRootView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.confirmButton, isRestarting && { opacity: 0.7 }]}
          onPress={handleConfirmAndRestart}
          disabled={isRestarting}
        >
          {isRestarting ? (
            <ActivityIndicator size="small" color="#FFF" style={{ marginRight: 8 }} />
          ) : (
            <Ionicons name="refresh" size={20} color="#FFF" style={{ marginRight: 8 }} />
          )}
          <Text style={styles.confirmButtonText}>
            {isRestarting
              ? (t('settings.restarting') || 'Reiniciando...')
              : (t('settings.confirm_restart') || 'Confirmar y Reiniciar')}
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
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Montserrat',
    fontWeight: '700',
    color: '#B3B3B3',
    marginVertical: 12,
  },
  listContent: {
    paddingTop: 10,
    paddingBottom: 40,
  },
  footer: {
    paddingTop: 10,
  },
  confirmButton: {
    backgroundColor: '#8B5CF6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
  },
  confirmButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Montserrat',
    fontWeight: '800',
  }
});
