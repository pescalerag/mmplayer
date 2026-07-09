import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { openLibraryTabsOrder, openAppTabsOrder, openHomeSections } from '@/store/useUIStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { ScreenHeaderLayout } from '../../components/ScreenHeaderLayout';

export default function SettingsAppearanceScreen() {
    const { t } = useTranslation();

    const {
        showTagColors,
        setShowTagColors,
        hideSyncToastOnResume,
        setHideSyncToastOnResume,
        userAlias,
        setForceWelcomeModal,
        isKeepAwakeEnabled,
        setIsKeepAwakeEnabled
    } = useSettingsStore();

    const openLibraryTabsOrderSheet = openLibraryTabsOrder;
    const openAppTabsOrderSheet = openAppTabsOrder;
    const openHomeSectionsSheet = openHomeSections;

    return (
        <ScreenHeaderLayout title={t('settings.visualization') || 'Apariencia'}>
            {({ headerHeight, bottomPadding }) => (
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={[
                        styles.scrollContent,
                        {
                            paddingTop: headerHeight + 20,
                            paddingBottom: bottomPadding
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

                        <View style={styles.settingRow}>
                            <View style={{ flex: 1, paddingRight: 15 }}>
                                <Text style={styles.settingLabel}>{t('settings.keep_awake') || 'Reproductor persistente'}</Text>
                                <Text style={styles.settingDescription}>
                                    {t('settings.keep_awake_desc') || 'Evita que la pantalla se apague mientras el reproductor o las letras están abiertos'}
                                </Text>
                            </View>
                            <Switch
                                value={isKeepAwakeEnabled}
                                onValueChange={setIsKeepAwakeEnabled}
                                trackColor={{ false: '#282828', true: '#8B5CF6' }}
                                thumbColor={isKeepAwakeEnabled ? '#FFFFFF' : '#888888'}
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
            )}
        </ScreenHeaderLayout>
    );
}

const styles = StyleSheet.create({
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
        paddingVertical: 12,
    },
    settingLabel: {
        fontSize: 16,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        color: '#FFFFFF',
    },
    settingDescription: {
        fontSize: 12,
        fontFamily: 'Montserrat',
        fontWeight: '700',
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
