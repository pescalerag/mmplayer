import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import RNRestart from 'react-native-restart';
import { useLibraryTabsOrderSheetStore } from '../store/useLibraryTabsOrderSheetStore';
import { LibraryTabType, useSettingsStore } from '../store/useSettingsStore';

const ALL_TABS: { id: LibraryTabType, labelKey: string, icon: any }[] = [
  { id: 'albums', labelKey: 'library.albums', icon: 'albums' },
  { id: 'playlists', labelKey: 'library.playlists', icon: 'list' },
  { id: 'artists', labelKey: 'library.artists', icon: 'people' },
  { id: 'folders', labelKey: 'library.folders', icon: 'folder' },
  { id: 'tracks', labelKey: 'library.songs', icon: 'musical-notes' },
];

export default function LibraryTabsOrderSheet() {
  const { t } = useTranslation();
  const { closeSheet } = useLibraryTabsOrderSheetStore();
  const { libraryTabsOrder, setLibraryTabsOrder } = useSettingsStore();

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

    setLibraryTabsOrder(data.map(t => t.id));

    try {
      const state = useSettingsStore.getState();
      const rawState: any = {};
      for (const key of Object.keys(state)) {
        if (typeof (state as any)[key] !== 'function') {
          rawState[key] = (state as any)[key];
        }
      }
      rawState.libraryTabsOrder = data.map(t => t.id);

      await AsyncStorage.setItem('mmplayer-settings', JSON.stringify({
        state: rawState,
        version: 0
      }));
    } catch (e) {
      console.error("Error persisting settings before restart:", e);
    }

    setTimeout(() => {
      closeSheet();
      RNRestart.restart();
    }, 800);
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<typeof ALL_TABS[0]>) => {
    return (
      <ScaleDecorator>
        <View
          style={[
            styles.itemContainer,
            { backgroundColor: isActive ? '#252525' : 'transparent' }
          ]}
        >
          <View style={styles.itemLeft}>
            <Ionicons name={item.icon} size={24} color="#8B5CF6" style={styles.itemIcon} />
            <Text style={styles.itemText}>{t(item.labelKey)}</Text>
          </View>
          <TouchableOpacity
            onLongPress={drag}
            delayLongPress={350}
            style={{ paddingLeft: 16, paddingVertical: 8 }}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <Ionicons name="menu" size={24} color="#666" />
          </TouchableOpacity>
        </View>
      </ScaleDecorator>
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
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemIcon: {
    marginRight: 16,
  },
  itemText: {
    fontSize: 16,
    fontFamily: 'Montserrat',
    fontWeight: '700',
    color: '#FFFFFF',
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
