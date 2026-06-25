import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Animated,
    BackHandler,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import RNRestart from 'react-native-restart';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTabsOrderSheetStore } from '../store/useAppTabsOrderSheetStore';
import { AppTabType, useSettingsStore } from '../store/useSettingsStore';

const { height } = Dimensions.get('window');

const ALL_TABS: { id: AppTabType, labelKey: string, icon: any }[] = [
    { id: 'Inicio', labelKey: 'navigation.home', icon: 'home' },
    { id: 'Biblioteca', labelKey: 'navigation.library', icon: 'library' },
    { id: 'Buscar', labelKey: 'navigation.search', icon: 'search' },
    { id: 'Etiquetas', labelKey: 'navigation.tags', icon: 'pricetags' },
    { id: 'Configuración', labelKey: 'navigation.settings', icon: 'settings' },
];

export default function AppTabsOrderSheet() {
    const { t } = useTranslation();
    const { isVisible, closeSheet } = useAppTabsOrderSheetStore();
    const insets = useSafeAreaInsets();

    const { appTabsOrder, setAppTabsOrder, initialAppRoute, setInitialAppRoute } = useSettingsStore();

    // Estados temporales en el sheet antes de confirmar
    const [data, setData] = useState(ALL_TABS);
    const [selectedInitial, setSelectedInitial] = useState<AppTabType>(initialAppRoute);
    const [isRestarting, setIsRestarting] = useState(false);

    const slideAnim = useRef(new Animated.Value(height)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Sincronizar datos al abrir
    useEffect(() => {
        if (isVisible) {
            const ordered = appTabsOrder.map(tabId => ALL_TABS.find(t => t.id === tabId)!).filter(Boolean);
            const missing = ALL_TABS.filter(t => !appTabsOrder.includes(t.id));
            setData([...ordered, ...missing]);
            setSelectedInitial(initialAppRoute);
        }
    }, [isVisible, appTabsOrder, initialAppRoute]);

    // --- ANIMACIONES ---
    useEffect(() => {
        if (isVisible) {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
                Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true })
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: height, duration: 250, useNativeDriver: true })
            ]).start();
        }
    }, [isVisible, fadeAnim, slideAnim]);

    // --- BACKHANDLER ---
    useEffect(() => {
        if (!isVisible) return;
        const onBackPress = () => { closeSheet(); return true; };
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [isVisible, closeSheet]);

    const [shouldRender, setShouldRender] = useState(isVisible);
    useEffect(() => {
        if (isVisible) {
            setShouldRender(true);
        } else {
            const timer = setTimeout(() => setShouldRender(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isVisible]);

    const onDragEnd = ({ data }: { data: typeof ALL_TABS }) => {
        setData(data);
    };

    const handleConfirmAndRestart = async () => {
        if (isRestarting) return;
        setIsRestarting(true);

        setAppTabsOrder(data.map(t => t.id));
        setInitialAppRoute(selectedInitial);

        try {
            const state = useSettingsStore.getState();
            const rawState: any = {};
            for (const key of Object.keys(state)) {
                if (typeof (state as any)[key] !== 'function') {
                    rawState[key] = (state as any)[key];
                }
            }
            // Ensure the newly selected values are included
            rawState.appTabsOrder = data.map(t => t.id);
            rawState.initialAppRoute = selectedInitial;

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
                        <Text style={styles.itemText}>{t(item.labelKey) || item.id}</Text>
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

    if (!shouldRender && !isVisible) return null;

    return (
        <View style={[StyleSheet.absoluteFill, { zIndex: 99999, elevation: 100 }]} pointerEvents={isVisible ? 'auto' : 'none'}>
            <TouchableWithoutFeedback onPress={closeSheet}>
                <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} />
            </TouchableWithoutFeedback>

            <Animated.View style={[
                styles.sheetContainer,
                {
                    paddingBottom: insets.bottom + 20,
                    transform: [{ translateY: slideAnim }]
                }
            ]}>
                <View style={styles.dragIndicator} />

                <View style={styles.header}>
                    <Text style={styles.title}>{t('settings.app_tabs_order') || 'Navegación principal'}</Text>
                    <Text style={styles.subtitle}>{t('settings.app_tabs_desc') || 'Personaliza la barra inferior'}</Text>
                </View>

                {/* --- SELECTOR DE INICIO --- */}
                <View style={styles.initialRouteSection}>
                    <Text style={styles.sectionTitle}>{t('settings.initial_route') || 'Pantalla de inicio'}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer}>
                        {ALL_TABS.map(tab => {
                            const isSelected = selectedInitial === tab.id;
                            return (
                                <TouchableOpacity
                                    key={`initial-${tab.id}`}
                                    style={[styles.chip, isSelected && styles.chipSelected]}
                                    onPress={() => setSelectedInitial(tab.id)}
                                >
                                    <Ionicons name={tab.icon} size={16} color={isSelected ? "#FFF" : "#888"} style={{ marginRight: 6 }} />
                                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                                        {t(tab.labelKey) || tab.id}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* --- LISTA REORDENABLE --- */}
                <Text style={[styles.sectionTitle, { paddingHorizontal: 24, marginTop: 10 }]}>
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
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    sheetContainer: {
        backgroundColor: '#0E0E0E',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        position: 'absolute',
        bottom: 0,
        width: '100%',
        borderTopWidth: 1,
        borderColor: '#1E1E1E',
        overflow: 'hidden',
    },
    dragIndicator: {
        width: 40,
        height: 4,
        backgroundColor: '#2E2E2E',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 14,
        marginBottom: 16,
    },
    header: {
        paddingHorizontal: 24,
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
        paddingHorizontal: 24,
    },
    chipsContainer: {
        paddingHorizontal: 20,
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
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 24,
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
        paddingHorizontal: 24,
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
