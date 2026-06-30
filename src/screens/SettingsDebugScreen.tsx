import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScannerService } from '../services/ScannerService';
import { useSyncStore } from '../store/useSyncStore';
import { Colors, Layout } from '../theme/theme';

export default function SettingsDebugScreen() {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<any>();
    const [headerHeight, setHeaderHeight] = useState(100);
    const { t } = useTranslation();
    const isScanning = useSyncStore(state => state.isScanning);

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
                    <Text style={styles.headerTitle} numberOfLines={1}>{t('settings.debug') || 'Depuración'}</Text>
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
