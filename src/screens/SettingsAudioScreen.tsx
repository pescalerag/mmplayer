import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TrackPlayer from 'react-native-track-player';
import { database } from '../database';
import Track from '../database/models/Track';
import { ScannerService } from '../services/ScannerService';
import { useSettingsStore } from '../store/useSettingsStore';
import { useSyncStore } from '../store/useSyncStore';
import { Colors, Layout } from '../theme/theme';

export default function SettingsAudioScreen() {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();
    const [headerHeight, setHeaderHeight] = useState(100);
    const { t } = useTranslation();
    const isScanning = useSyncStore(state => state.isScanning);

    const {
        isNormalizationEnabled,
        setNormalizationEnabled,
        preampLevel,
        setPreampLevel,
        fallbackGainDB,
        setFallbackGain,
        isFadeEnabled,
        setIsFadeEnabled
    } = useSettingsStore();

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
                    <Text style={styles.headerTitle} numberOfLines={1}>{t('settings.audio_section') || 'Audio'}</Text>
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
                    <View style={styles.settingRow}>
                        <View style={{ flex: 1, paddingRight: 15 }}>
                            <Text style={styles.settingLabel}>{t('settings.normalization')}</Text>
                            <Text style={styles.settingDescription}>
                                {t('settings.normalization_desc')}
                            </Text>
                        </View>
                        <Switch
                            value={isNormalizationEnabled}
                            onValueChange={async (value) => {
                                setNormalizationEnabled(value);
                                try {
                                    if (value) {
                                        const activeTrackIndex = await TrackPlayer.getActiveTrackIndex();
                                        if (activeTrackIndex !== null && activeTrackIndex !== undefined) {
                                            const track = await TrackPlayer.getTrack(activeTrackIndex);
                                            if (track && track.id) {
                                                const cleanId = track.id.toString().split('-')[0];
                                                const trackModel = await database.get<Track>('tracks').find(cleanId);
                                                const trackGainDB = trackModel.replayGain ?? fallbackGainDB;
                                                const totalTargetDB = trackGainDB + preampLevel;
                                                let linearVolume = Math.pow(10, totalTargetDB / 20);
                                                linearVolume = Math.min(Math.max(linearVolume, 0), 1.0);
                                                await TrackPlayer.setVolume(linearVolume);
                                            }
                                        }
                                    } else {
                                        await TrackPlayer.setVolume(1.0);
                                    }
                                } catch (err) {
                                    console.error("Error actualizando volumen al activar/desactivar normalización:", err);
                                }
                            }}
                            trackColor={{ false: '#282828', true: '#8B5CF6' }}
                            thumbColor={isNormalizationEnabled ? '#FFFFFF' : '#888888'}
                            ios_backgroundColor="#282828"
                        />
                    </View>

                    {isNormalizationEnabled && (
                        <>
                            <View style={styles.separator} />

                            <View style={{ marginVertical: 8 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={styles.settingLabel}>{t('settings.preamp')}</Text>
                                    <Text style={[styles.settingLabel, { color: '#8B5CF6' }]}>
                                        {preampLevel >= 0 ? `+${preampLevel.toFixed(1)}` : preampLevel.toFixed(1)} dB
                                    </Text>
                                </View>
                                <Text style={styles.settingDescription}>
                                    {t('settings.preamp_desc')}
                                </Text>
                                <Slider
                                    style={{ width: '100%', height: 40, marginTop: 8 }}
                                    minimumValue={0}
                                    maximumValue={6}
                                    step={0.5}
                                    value={preampLevel}
                                    onValueChange={async (value) => {
                                        setPreampLevel(value);
                                        try {
                                            const activeTrackIndex = await TrackPlayer.getActiveTrackIndex();
                                            if (activeTrackIndex !== null && activeTrackIndex !== undefined) {
                                                const track = await TrackPlayer.getTrack(activeTrackIndex);
                                                if (track && track.id) {
                                                    const cleanId = track.id.toString().split('-')[0];
                                                    const trackModel = await database.get<Track>('tracks').find(cleanId);
                                                    const trackGainDB = trackModel.replayGain ?? fallbackGainDB;
                                                    const totalTargetDB = trackGainDB + value;
                                                    let linearVolume = Math.pow(10, totalTargetDB / 20);
                                                    linearVolume = Math.min(Math.max(linearVolume, 0), 1.0);
                                                    await TrackPlayer.setVolume(linearVolume);
                                                }
                                            }
                                        } catch (err) {
                                            console.error("Error actualizando volumen en tiempo real:", err);
                                        }
                                    }}
                                    minimumTrackTintColor="#8B5CF6"
                                    maximumTrackTintColor="#282828"
                                    thumbTintColor="#FFFFFF"
                                />
                            </View>

                            <View style={styles.separator} />

                            <View style={{ marginVertical: 8 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={styles.settingLabel}>{t('settings.fallback_gain')}</Text>
                                    <Text style={[styles.settingLabel, { color: '#8B5CF6' }]}>
                                        {fallbackGainDB.toFixed(0)} dB
                                    </Text>
                                </View>
                                <Text style={styles.settingDescription}>
                                    {t('settings.fallback_gain_desc')}
                                </Text>
                                <Slider
                                    style={{ width: '100%', height: 40, marginTop: 8 }}
                                    minimumValue={-10}
                                    maximumValue={0}
                                    step={1}
                                    value={fallbackGainDB}
                                    onValueChange={async (value) => {
                                        setFallbackGain(value);
                                        try {
                                            const activeTrackIndex = await TrackPlayer.getActiveTrackIndex();
                                            if (activeTrackIndex !== null && activeTrackIndex !== undefined) {
                                                const track = await TrackPlayer.getTrack(activeTrackIndex);
                                                if (track && track.id) {
                                                    const cleanId = track.id.toString().split('-')[0];
                                                    const trackModel = await database.get<Track>('tracks').find(cleanId);
                                                    if (trackModel.replayGain === null || trackModel.replayGain === undefined) {
                                                        const totalTargetDB = value + preampLevel;
                                                        let linearVolume = Math.pow(10, totalTargetDB / 20);
                                                        linearVolume = Math.min(Math.max(linearVolume, 0), 1.0);
                                                        await TrackPlayer.setVolume(linearVolume);
                                                    }
                                                }
                                            }
                                        } catch (err) {
                                            console.error("Error actualizando volumen fallback en tiempo real:", err);
                                        }
                                    }}
                                    minimumTrackTintColor="#8B5CF6"
                                    maximumTrackTintColor="#282828"
                                    thumbTintColor="#FFFFFF"
                                />
                            </View>
                        </>
                    )}

                    <View style={styles.separator} />

                    <View style={styles.settingRow}>
                        <View style={{ flex: 1, paddingRight: 15 }}>
                            <Text style={styles.settingLabel}>{t('settings.fade') || 'Atenuación suave (Fade)'}</Text>
                            <Text style={styles.settingDescription}>
                                {t('settings.fade_desc') || 'Baja y sube el volumen suavemente al pausar y reproducir'}
                            </Text>
                        </View>
                        <Switch
                            value={isFadeEnabled}
                            onValueChange={(value) => {
                                setIsFadeEnabled(value);
                            }}
                            trackColor={{ false: '#282828', true: '#8B5CF6' }}
                            thumbColor={isFadeEnabled ? '#FFFFFF' : '#888888'}
                            ios_backgroundColor="#282828"
                        />
                    </View>

                    <View style={styles.separator} />

                    <TouchableOpacity
                        style={[styles.buttonRow, isScanning && { opacity: 0.5 }]}
                        disabled={isScanning}
                        onPress={() => {
                            Alert.alert(
                                t('settings.scan_replaygain_alert_title') || 'Analizar volumen de canciones',
                                t('settings.scan_replaygain_alert_desc') || 'Este proceso buscará y analizará las canciones de tu biblioteca que aún no tengan una ganancia de volumen asignada. Esto puede tomar unos minutos en colecciones grandes. ¿Deseas continuar?',
                                [
                                    { text: t('actions.cancel'), style: "cancel" },
                                    {
                                        text: t('actions.continue'),
                                        style: "default",
                                        onPress: async () => {
                                            if (useSyncStore.getState().isScanning) return;
                                            try {
                                                useSyncStore.getState().setIsScanning(true, false);
                                                const scannedCount = await ScannerService.runDeepReplayGainScan();
                                                Alert.alert(
                                                    t('settings.success'),
                                                    t('settings.scan_replaygain_success', { count: scannedCount }) || `Se han analizado y guardado las ganancias de ${scannedCount} canciones.`
                                                );
                                            } catch (err) {
                                                console.error("Error al escanear ReplayGain:", err);
                                                Alert.alert(t('actions.error'), 'No se pudo completar el análisis.');
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
                            <Text style={styles.settingLabel}>{t('settings.scan_replaygain') || 'Escanear ganancias de volumen'}</Text>
                            <Text style={styles.settingDescription}>
                                {t('settings.scan_replaygain_desc') || 'Busca y analiza el volumen (ReplayGain) de tus archivos de audio para nivelarlos'}
                            </Text>
                        </View>
                        <Ionicons name="volume-high" size={20} color="#8B5CF6" />
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
