import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTabsOrderSheetStore } from '../store/useAppTabsOrderSheetStore';
import { useLibraryTabsOrderSheetStore } from '../store/useLibraryTabsOrderSheetStore';
import { useHomeSectionsSheetStore } from '../store/useHomeSectionsSheetStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { Colors, Layout } from '../theme/theme';

export default function SettingsAppearanceScreen() {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();
    const [headerHeight, setHeaderHeight] = useState(100);
    const { t } = useTranslation();

    const {
        showTagColors,
        setShowTagColors,
        hideSyncToastOnResume,
        setHideSyncToastOnResume,
        userAlias,
        setForceWelcomeModal
    } = useSettingsStore();

    const openLibraryTabsOrderSheet = useLibraryTabsOrderSheetStore(s => s.openSheet);
    // Safe hook fetch for app tabs order sheet, handling standard and typescript variants
    const openAppTabsOrderSheet = useAppTabsOrderSheetStore(s => s.openSheet);
    const openHomeSectionsSheet = useHomeSectionsSheetStore(s => s.openSheet);

    return (
        <View style={[styles.container, { backgroundColor: Colors.background }]}>
            {/* CAPA DEL HUMO */}
            <LinearGradient
                colors={['#000000', 'rgba(0, 0, 0, 0.9)', 'rgba(0, 0, 0, 0.7)', 'transparent']}
                locations={[0, 0.4, 0.7, 1]}
                style={[styles.smokeEffect, { height: headerHeight + 30 }]}
                pointerEvents="none"
            />

            {/* CAPA DE ILUMINACIÓN MORADA */}
            <LinearGradient
                colors={["#8B5CF633", "transparent"]}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200, zIndex: 2 }}
                pointerEvents="none"
            />

            {/* INTERFAZ HEADER */}
            <View
                onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
                style={[styles.headerContainer, { paddingTop: insets.top + 10 }]}
            >
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={28} color="#8B5CF6" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle} numberOfLines={1}>{t('settings.visualization') || 'Apariencia'}</Text>
                </View>
            </View>

            {/* CONTENIDO */}
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={[
                    styles.scrollContent,
                    {
                        paddingTop: headerHeight + 20,
                        paddingBottom: Layout.MINI_PLAYER_HEIGHT + Layout.TAB_BAR_HEIGHT + Layout.PLAYER_MARGIN + insets.bottom
                    }
                ]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.sectionCard}>
                    <TouchableOpacity
                        style={styles.buttonRow}
                        onPress={() => setForceWelcomeModal(true)}
                    >
                        <View style={{ flex: 1, paddingRight: 15 }}>
                            <Text style={styles.settingLabel}>{t('welcome.subtitle') || 'Cambiar alias'}</Text>
                            <Text style={styles.settingDescription}>
                                {userAlias ? `Actual: ${userAlias}` : 'No tienes alias configurado'}
                            </Text>
                        </View>
                        <Ionicons name="person" size={20} color="#8B5CF6" />
                    </TouchableOpacity>

                    <View style={styles.separator} />

                    <View style={styles.settingRow}>
                        <View style={{ flex: 1, paddingRight: 15 }}>
                            <Text style={styles.settingLabel}>{t('settings.tag_colors')}</Text>
                            <Text style={styles.settingDescription}>
                                {t('settings.tag_colors_desc')}
                            </Text>
                        </View>
                        <Switch
                            value={showTagColors}
                            onValueChange={setShowTagColors}
                            trackColor={{ false: '#282828', true: '#8B5CF6' }}
                            thumbColor={showTagColors ? '#FFFFFF' : '#888888'}
                            ios_backgroundColor="#282828"
                        />
                    </View>

                    <View style={styles.separator} />

                    <View style={styles.settingRow}>
                        <View style={{ flex: 1, paddingRight: 15 }}>
                            <Text style={styles.settingLabel}>{t('settings.silent_sync')}</Text>
                            <Text style={styles.settingDescription}>
                                {t('settings.silent_sync_desc')}
                            </Text>
                        </View>
                        <Switch
                            value={hideSyncToastOnResume}
                            onValueChange={setHideSyncToastOnResume}
                            trackColor={{ false: '#282828', true: '#8B5CF6' }}
                            thumbColor={hideSyncToastOnResume ? '#FFFFFF' : '#888888'}
                            ios_backgroundColor="#282828"
                        />
                    </View>

                    <View style={styles.separator} />

                    <TouchableOpacity
                        style={styles.buttonRow}
                        onPress={openLibraryTabsOrderSheet}
                    >
                        <View style={{ flex: 1, paddingRight: 15 }}>
                            <Text style={styles.settingLabel}>{t('settings.tab_order')}</Text>
                            <Text style={styles.settingDescription}>
                                {t('settings.tab_order_desc')}
                            </Text>
                        </View>
                        <Ionicons name="list" size={20} color="#8B5CF6" />
                    </TouchableOpacity>

                    <View style={styles.separator} />

                    <TouchableOpacity
                        style={styles.buttonRow}
                        onPress={openAppTabsOrderSheet}
                    >
                        <View style={{ flex: 1, paddingRight: 15 }}>
                            <Text style={styles.settingLabel}>{t('settings.app_tabs_order') || 'Navegación principal'}</Text>
                            <Text style={styles.settingDescription}>
                                {t('settings.app_tabs_desc') || 'Personaliza la barra inferior'}
                            </Text>
                        </View>
                        <Ionicons name="apps" size={20} color="#8B5CF6" />
                    </TouchableOpacity>

                    <View style={styles.separator} />

                    <TouchableOpacity
                        style={styles.buttonRow}
                        onPress={openHomeSectionsSheet}
                    >
                        <View style={{ flex: 1, paddingRight: 15 }}>
                            <Text style={styles.settingLabel}>{t('settings.home_sections') || 'Secciones de inicio'}</Text>
                            <Text style={styles.settingDescription}>
                                {t('settings.home_sections_desc') || 'Elige qué secciones se muestran en la pantalla de inicio'}
                            </Text>
                        </View>
                        <Ionicons name="grid-outline" size={20} color="#8B5CF6" />
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    smokeEffect: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1,
    },
    headerContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
        zIndex: 10,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    backBtn: {
        padding: 4,
        marginLeft: -8,
    },
    headerTitle: {
        fontSize: 24,
        fontFamily: 'Montserrat',
        fontWeight: '900',
        color: '#FFFFFF',
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
    },
    sectionCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    settingLabel: {
        fontSize: 16,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        color: '#FFFFFF',
    },
    settingDescription: {
        fontSize: 12,
        fontFamily: 'Montserrat', fontWeight: '700',
        color: '#888',
        marginTop: 4,
        lineHeight: 16,
    },
    buttonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    separator: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        marginVertical: 4,
    },
});
