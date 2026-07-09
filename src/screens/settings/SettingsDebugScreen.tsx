import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ScannerService } from '../../services/ScannerService';
import { useSyncStore } from '../../store/useSyncStore';
import { ScreenHeaderLayout } from '@/components/layouts/ScreenHeaderLayout';

export default function SettingsDebugScreen() {
    const navigation = useNavigation<any>();
    const { t } = useTranslation();
    const isScanning = useSyncStore(state => state.isScanning);

    return (
        <ScreenHeaderLayout title={t('settings.debug') || 'Depuración'}>
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
                            onPress={() => navigation.navigate('DebugHistory')}
                        >
                            <View style={{ flex: 1, paddingRight: 15 }}>
                                <Text style={styles.settingLabel}>{t('settings.debug_history')}</Text>
                                <Text style={styles.settingDescription}>
                                    {t('settings.debug_history_desc')}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#8B5CF6" />
                        </TouchableOpacity>
                        
                        <View style={styles.separator} />
                        
                        <TouchableOpacity
                            style={styles.buttonRow}
                            onPress={() => {
                                Alert.alert(
                                    t('settings.repair_alert_title'),
                                    t('settings.repair_alert_desc'),
                                    [
                                        { text: t('actions.cancel'), style: "cancel" },
                                        {
                                            text: t('actions.continue'),
                                            style: "default",
                                            onPress: async () => {
                                                await ScannerService.repairCollaborators();
                                                Alert.alert(t('settings.success'), t('settings.repair_success'));
                                            }
                                        }
                                    ]
                                );
                            }}
                        >
                            <View style={{ flex: 1, paddingRight: 15 }}>
                                <Text style={styles.settingLabel}>{t('settings.repair_library')}</Text>
                                <Text style={styles.settingDescription}>
                                    {t('settings.repair_library_desc')}
                                </Text>
                            </View>
                            <Ionicons name="build" size={20} color="#8B5CF6" />
                        </TouchableOpacity>

                        <View style={styles.separator} />

                        <TouchableOpacity
                            style={[styles.buttonRow, isScanning && { opacity: 0.5 }]}
                            disabled={isScanning}
                            onPress={() => {
                                Alert.alert(
                                    t('settings.repair_covers_alert_title') || 'Reparar carátulas vacías',
                                    t('settings.repair_covers_alert_desc') || 'Este proceso buscará carátulas dañadas o vacías en tu biblioteca y les asignará la imagen por defecto si ya no existen en el dispositivo. ¿Deseas continuar?',
                                    [
                                        { text: t('actions.cancel'), style: "cancel" },
                                        {
                                            text: t('actions.continue'),
                                            style: "default",
                                            onPress: async () => {
                                                if (useSyncStore.getState().isScanning) return;
                                                try {
                                                    useSyncStore.getState().setIsScanning(true, false);
                                                    const repairedCount = await ScannerService.repairMissingAlbumCovers();
                                                    Alert.alert(
                                                        t('settings.success'),
                                                        t('settings.repair_covers_success', { count: repairedCount }) || `Se han reparado las carátulas de ${repairedCount} álbumes.`
                                                    );
                                                } catch (err) {
                                                    console.error("Error al reparar carátulas:", err);
                                                    Alert.alert(t('actions.error'), 'No se pudo completar la reparación.');
                                                } finally {
                                                    useSyncStore.getState().setIsScanning(false, false);
                                                }
                                            }
                                        }
                                    ]
                                );
                            }}
                        >
                            <View style={{ flex: 1, paddingRight: 15 }}>
                                <Text style={styles.settingLabel}>{t('settings.repair_covers') || 'Reparar carátulas vacías'}</Text>
                                <Text style={styles.settingDescription}>
                                    {t('settings.repair_covers_desc') || 'Corrige las carátulas de los álbumes que se quedaron en blanco tras el último fallo del escáner'}
                                </Text>
                            </View>
                            <Ionicons name="image" size={20} color="#8B5CF6" />
                        </TouchableOpacity>

                        <View style={styles.separator} />

                        <TouchableOpacity
                            style={styles.buttonRow}
                            onPress={() => {
                                Alert.alert(
                                    t('settings.wipe_alert_title'),
                                    t('settings.wipe_alert_desc'),
                                    [
                                        { text: t('actions.cancel'), style: "cancel" },
                                        {
                                            text: t('settings.wipe_confirm'),
                                            style: "destructive",
                                            onPress: () => ScannerService.fullDataWipe()
                                        }
                                    ]
                                );
                            }}
                        >
                            <View style={{ flex: 1, paddingRight: 15 }}>
                                <Text style={[styles.settingLabel, { color: '#EF4444' }]}>{t('settings.full_data_removal')}</Text>
                                <Text style={styles.settingDescription}>
                                    {t('settings.full_data_removal_desc')}
                                </Text>
                            </View>
                            <Ionicons name="trash" size={24} color="#EF4444" />
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
