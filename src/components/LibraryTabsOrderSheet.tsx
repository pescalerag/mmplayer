import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    BackHandler,
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useLibraryTabsOrderSheetStore } from '../store/useLibraryTabsOrderSheetStore';
import { LibraryTabType, useSettingsStore } from '../store/useSettingsStore';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import RNRestart from 'react-native-restart';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { height } = Dimensions.get('window');

const ALL_TABS: { id: LibraryTabType, labelKey: string, icon: any }[] = [
    { id: 'albums', labelKey: 'library.albums', icon: 'albums' },
    { id: 'playlists', labelKey: 'library.playlists', icon: 'list' },
    { id: 'artists', labelKey: 'library.artists', icon: 'people' },
    { id: 'folders', labelKey: 'library.folders', icon: 'folder' },
    { id: 'tracks', labelKey: 'library.songs', icon: 'musical-notes' },
];

export default function LibraryTabsOrderSheet() {
    const { t } = useTranslation();
    const { isVisible, closeSheet } = useLibraryTabsOrderSheetStore();
    const insets = useSafeAreaInsets();
    
    const { libraryTabsOrder, setLibraryTabsOrder } = useSettingsStore();
    const [data, setData] = useState(ALL_TABS);
    const [isRestarting, setIsRestarting] = useState(false);

    const slideAnim = useRef(new Animated.Value(height)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Sincronizar datos al abrir
    useEffect(() => {
        if (isVisible) {
            // Reordenar ALL_TABS basándose en libraryTabsOrder
            const ordered = libraryTabsOrder.map(tabId => ALL_TABS.find(t => t.id === tabId)!).filter(Boolean);
            
            // Si hay pestañas nuevas que no estaban en libraryTabsOrder, agregarlas al final
            const missing = ALL_TABS.filter(t => !libraryTabsOrder.includes(t.id));
            setData([...ordered, ...missing]);
        }
    }, [isVisible, libraryTabsOrder]);

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

    // Render/unmount controlado
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

        setLibraryTabsOrder(data.map(t => t.id));

        try {
            const state = useSettingsStore.getState();
            const rawState: any = {};
            for (const key of Object.keys(state)) {
                if (typeof (state as any)[key] !== 'function') {
                    rawState[key] = (state as any)[key];
                }
            }
            // Ensure the newly selected values are included
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
                    <Text style={styles.title}>{t('settings.library_tabs_title') || 'Pestañas de la biblioteca'}</Text>
                    <Text style={styles.subtitle}>{t('settings.library_tabs_subtitle') || 'Personaliza la biblioteca'}</Text>
                </View>

                <Text style={[styles.sectionTitle, { paddingHorizontal: 24, marginTop: 20 }]}>
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
    sectionTitle: {
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        color: '#B3B3B3',
        marginBottom: 12,
        paddingHorizontal: 24,
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
