import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Animated,
    BackHandler,
    Dimensions,
    StyleSheet,
    Switch,
    Text,
    TouchableWithoutFeedback,
    View,
    ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHomeSectionsSheetStore } from '../store/useHomeSectionsSheetStore';
import { HomeSection, useSettingsStore } from '../store/useSettingsStore';

const { height } = Dimensions.get('window');

const SECTIONS_METADATA: { id: HomeSection; labelKey: string; fallbackLabel: string; icon: any }[] = [
    { id: 'stats', labelKey: 'home.weekly_highlights', fallbackLabel: 'Destacados de la semana', icon: 'stats-chart' },
    { id: 'recent_media', labelKey: 'home.recently_played', fallbackLabel: 'Escuchado recientemente', icon: 'time' },
    { id: 'recent_playlists', labelKey: 'home.my_playlists', fallbackLabel: 'Mis listas de reproducción', icon: 'list' },
    { id: 'recently_added', labelKey: 'home.recently_added_albums', fallbackLabel: 'Álbumes añadidos recientemente', icon: 'albums' },
    { id: 'most_played', labelKey: 'home.most_played_songs', fallbackLabel: 'Tus más escuchadas', icon: 'musical-notes' },
    { id: 'explore', labelKey: 'home.explore_albums', fallbackLabel: 'Explorar álbumes aleatorios', icon: 'compass' },
];

export default function HomeSectionsSheet() {
    const { t } = useTranslation();
    const { isVisible, closeSheet } = useHomeSectionsSheetStore();
    const insets = useSafeAreaInsets();

    const {
        homeSectionsVisibility,
        setHomeSectionsVisibility,
        showGlobalShuffle,
        setShowGlobalShuffle
    } = useSettingsStore();

    const slideAnim = useRef(new Animated.Value(height)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

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

    const handleToggle = (sectionId: HomeSection, value: boolean) => {
        const updated = {
            ...homeSectionsVisibility,
            [sectionId]: value
        };
        setHomeSectionsVisibility(updated);
    };

    if (!shouldRender && !isVisible) return null;

    return (
        <View style={[StyleSheet.absoluteFill, { zIndex: 9999 }]} pointerEvents={isVisible ? 'auto' : 'none'}>
            <TouchableWithoutFeedback onPress={closeSheet}>
                <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} />
            </TouchableWithoutFeedback>

            <Animated.View
                style={[
                    styles.sheetContainer,
                    {
                        paddingBottom: insets.bottom + 20,
                        transform: [{ translateY: slideAnim }]
                    }
                ]}
            >
                <View style={styles.dragIndicator} />

                <View style={styles.header}>
                    <Text style={styles.title}>{t('settings.home_sections_title') || "Secciones de inicio"}</Text>
                    <Text style={styles.subtitle}>{t('settings.home_sections_subtitle') || "Activa o desactiva las secciones de la pantalla principal"}</Text>
                </View>

                <ScrollView style={styles.listContent} showsVerticalScrollIndicator={false}>
                    {SECTIONS_METADATA.map((section) => {
                        const isEnabled = homeSectionsVisibility[section.id] ?? true;
                        return (
                            <View key={section.id} style={styles.itemContainer}>
                                <View style={styles.itemLeft}>
                                    <Ionicons name={section.icon} size={22} color="#8B5CF6" style={styles.itemIcon} />
                                    <Text style={styles.itemText}>{t(section.labelKey) || section.fallbackLabel}</Text>
                                </View>
                                <Switch
                                    value={isEnabled}
                                    onValueChange={(val) => handleToggle(section.id, val)}
                                    trackColor={{ false: '#282828', true: '#8B5CF6' }}
                                    thumbColor={isEnabled ? '#FFFFFF' : '#888888'}
                                    ios_backgroundColor="#282828"
                                />
                            </View>
                        );
                    })}

                    <View style={styles.separator} />

                    <View style={styles.itemContainer}>
                        <View style={styles.itemLeft}>
                            <Ionicons name="shuffle" size={22} color="#8B5CF6" style={styles.itemIcon} />
                            <Text style={styles.itemText}>{t('home.home_shuffle_button') || "Botón de reproducción aleatoria"}</Text>
                        </View>
                        <Switch
                            value={showGlobalShuffle}
                            onValueChange={setShowGlobalShuffle}
                            trackColor={{ false: '#282828', true: '#8B5CF6' }}
                            thumbColor={showGlobalShuffle ? '#FFFFFF' : '#888888'}
                            ios_backgroundColor="#282828"
                        />
                    </View>
                </ScrollView>
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
        paddingHorizontal: 24,
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
        marginHorizontal: 24,
        marginVertical: 8,
    },
});
