import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useSheetProps } from '@/hooks/useSheetProps';
import { AppTabType, useSettingsStore } from '../../store/useSettingsStore';
import { saveSettingsAndRestart } from '../../utils/restartHelper';
import { DraggableTabItem } from '@/components/common/DraggableTabItem';
import { useAppTheme } from '@/hooks/useAppTheme';

const ALL_TABS: { id: AppTabType, labelKey: string, icon: any }[] = [
  { id: 'Inicio', labelKey: 'navigation.home', icon: 'home' },
  { id: 'Biblioteca', labelKey: 'navigation.library', icon: 'library' },
  { id: 'Buscar', labelKey: 'navigation.search', icon: 'search' },
  { id: 'Etiquetas', labelKey: 'navigation.tags', icon: 'pricetags' },
  { id: 'Configuración', labelKey: 'navigation.settings', icon: 'settings' },
];

export default function AppTabsOrderSheet() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { close: closeSheet } = useSheetProps('app-tabs-order');
  const { appTabsOrder, initialAppRoute } = useSettingsStore();

  const [data, setData] = useState(ALL_TABS);
  const [selectedInitial, setSelectedInitial] = useState<AppTabType>(initialAppRoute);
  const [isRestarting, setIsRestarting] = useState(false);

  // Sync initially
  useEffect(() => {
    const ordered = appTabsOrder.map(tabId => ALL_TABS.find(t => t.id === tabId)!).filter(Boolean);
    const missing = ALL_TABS.filter(t => !appTabsOrder.includes(t.id));
    setData([...ordered, ...missing]);
    setSelectedInitial(initialAppRoute);
  }, [appTabsOrder, initialAppRoute]);

  const onDragEnd = ({ data }: { data: typeof ALL_TABS }) => {
    setData(data);
  };

  const handleConfirmAndRestart = async () => {
    if (isRestarting) return;
    setIsRestarting(true);

    await saveSettingsAndRestart({
      appTabsOrder: data.map(t => t.id),
      initialAppRoute: selectedInitial,
    });

    closeSheet();
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<typeof ALL_TABS[0]>) => {
    return (
      <DraggableTabItem
        icon={item.icon}
        label={t(item.labelKey) || item.id}
        drag={drag}
        isActive={isActive}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('settings.app_tabs_order') || 'Navegación principal'}</Text>
        <Text style={styles.subtitle}>{t('settings.app_tabs_desc') || 'Personaliza la barra inferior'}</Text>
      </View>

      {/* --- SELECTOR DE INICIO --- */}
      <View style={styles.initialRouteSection}>
        <Text style={styles.sectionTitle}>{t('settings.initial_route') || 'Pantalla de inicio'}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer} keyboardShouldPersistTaps="handled">
          {ALL_TABS.map(tab => {
            const isSelected = selectedInitial === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.chip, isSelected && [styles.chipSelected, { backgroundColor: colors.accent }]]}
                onPress={() => setSelectedInitial(tab.id)}
              >
                <Ionicons name={tab.icon} size={16} color={isSelected ? colors.onAccent : "#888"} style={{ marginRight: 6 }} />
                <Text style={[styles.chipText, isSelected && [styles.chipTextSelected, { color: colors.onAccent }]]}>
                  {t(tab.labelKey) || tab.id}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* --- LISTA REORDENABLE --- */}
      <Text style={styles.sectionTitleDrag}>
        {t('settings.drag_to_reorder_tabs') || 'Orden de la barra (Mantén presionado para mover)'}
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
          style={[styles.confirmButton, { backgroundColor: colors.accent }, isRestarting && { opacity: 0.7 }]}
          onPress={handleConfirmAndRestart}
          disabled={isRestarting}
        >
          {isRestarting ? (
            <ActivityIndicator size="small" color={colors.onAccent} style={{ marginRight: 8 }} />
          ) : (
            <Ionicons name="refresh" size={20} color={colors.onAccent} style={{ marginRight: 8 }} />
          )}
          <Text style={[styles.confirmButtonText, { color: colors.onAccent }]}>
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
  initialRouteSection: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Montserrat',
    fontWeight: '700',
    color: '#B3B3B3',
    marginBottom: 12,
  },
  sectionTitleDrag: {
    fontSize: 14,
    fontFamily: 'Montserrat',
    fontWeight: '700',
    color: '#B3B3B3',
    marginVertical: 12,
  },
  chipsContainer: {
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  chipSelected: {
    backgroundColor: '#8B5CF6',
  },
  chipText: {
    fontSize: 14,
    fontFamily: 'Montserrat',
    fontWeight: '600',
    color: '#888',
  },
  chipTextSelected: {
    color: '#FFF',
  },
  listContent: {
    paddingTop: 0,
    paddingBottom: 20,
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
