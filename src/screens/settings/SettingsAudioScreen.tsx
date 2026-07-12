import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Animated, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import TrackPlayer from 'react-native-track-player';
import { database } from '../../database';
import Track from '../../database/models/Track';
import { ScannerService } from '../../services/ScannerService';
import { EqualizerService } from '../../services/EqualizerService';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useSyncStore } from '../../store/useSyncStore';
import { ScreenHeaderLayout } from '@/components/layouts/ScreenHeaderLayout';

export default function SettingsAudioScreen() {
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
        setIsFadeEnabled,
        isEqualizerEnabled,
        setIsEqualizerEnabled,
        equalizerBands,
        setEqualizerBand,
        setEqualizerBands,
        bassBoostStrength,
        setBassBoostStrength,
    } = useSettingsStore();

    const [bandFreqs, setBandFreqs] = useState<number[]>([]);
    const [bandRange, setBandRange] = useState<{ min: number; max: number }>({ min: -1500, max: 1500 });
    const [scrollEnabled, setScrollEnabled] = useState(true);
    const eqInitialized = useRef(false);

    useEffect(() => {
        if (!eqInitialized.current) {
            eqInitialized.current = true;
            EqualizerService.initialize().then(() => {
                setBandFreqs(EqualizerService.getBandFrequencies());
                setBandRange(EqualizerService.getBandLevelRange());
                if (isEqualizerEnabled) {
                    EqualizerService.applyCurrentSettings();
                }
            });
        }
    }, [isEqualizerEnabled]);

    return (
        <ScreenHeaderLayout title={t('settings.audio_section') || 'Audio'}>
            {({ headerHeight, bottomPadding }) => (
                <ScrollView
                    style={{ flex: 1 }}
                    scrollEnabled={scrollEnabled}
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
                                                    Alert.alert(t('actions.error'), t('settings.scan_replaygain_error'));
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

                    <View style={styles.sectionCard}>
                        <View style={styles.settingRow}>
                            <View style={{ flex: 1, paddingRight: 15 }}>
                                <Text style={styles.settingLabel}>{t('settings.equalizer')}</Text>
                                <Text style={styles.settingDescription}>
                                    {t('settings.equalizer_desc')}
                                </Text>
                            </View>
                            <Switch
                                value={isEqualizerEnabled}
                                onValueChange={async (value) => {
                                    setIsEqualizerEnabled(value);
                                    await EqualizerService.setEnabled(value);
                                    if (value) {
                                        await EqualizerService.applyCurrentSettings();
                                    }
                                }}
                                trackColor={{ false: '#282828', true: '#8B5CF6' }}
                                thumbColor={isEqualizerEnabled ? '#FFFFFF' : '#888888'}
                                ios_backgroundColor="#282828"
                            />
                        </View>

                        {isEqualizerEnabled && (
                            <>
                                <View style={styles.separator} />

                                <View style={{ marginVertical: 8 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                        <Text style={styles.settingLabel}>{t('settings.equalizer')}</Text>
                                        <TouchableOpacity
                                            onPress={async () => {
                                                const zeros = new Array(equalizerBands.length).fill(0);
                                                setEqualizerBands(zeros);
                                                for (let i = 0; i < zeros.length; i++) {
                                                    await EqualizerService.setBandLevel(i, 0);
                                                }
                                            }}
                                            style={styles.eqResetBtn}
                                        >
                                            <Text style={styles.eqResetText}>{t('settings.eq_reset')}</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.eqBandsContainer}>
                                        {equalizerBands.map((level, index) => {
                                            const freq = bandFreqs[index];
                                            const freqLabel = freq === undefined
                                                ? `B${index + 1}`
                                                : freq >= 1000
                                                    ? `${(freq / 1000).toFixed(0)}${t('settings.eq_khz')}`
                                                    : `${Math.round(freq)}${t('settings.eq_hz')}`;
                                            const dbValue = (level / 100).toFixed(1);
                                            const isPositive = level > 0;
                                            return (
                                                <View key={index} style={styles.eqBand}>
                                                    <Text style={[styles.eqBandDb, { color: isPositive ? '#8B5CF6' : level < 0 ? '#999' : '#555' }]}>
                                                        {isPositive ? `+${dbValue}` : dbValue}
                                                    </Text>
                                                    <View style={styles.eqSliderTrack}>
                                                        <View style={[
                                                            styles.eqSliderFill,
                                                            {
                                                                height: `${((level - bandRange.min) / (bandRange.max - bandRange.min)) * 100}%`,
                                                                backgroundColor: isPositive ? '#8B5CF6' : '#444',
                                                            }
                                                        ]} />
                                                        <Animated.View
                                                            style={[
                                                                styles.eqSliderThumb,
                                                                {
                                                                    bottom: `${((level - bandRange.min) / (bandRange.max - bandRange.min)) * 100}%`,
                                                                    marginBottom: -8,
                                                                }
                                                            ]}
                                                        />
                                                    </View>
                                                    <View style={styles.eqTouchArea}
                                                        onStartShouldSetResponder={() => true}
                                                        onMoveShouldSetResponder={() => true}
                                                        onResponderGrant={(e) => {
                                                            setScrollEnabled(false);
                                                            const { pageY: touchY } = e.nativeEvent;
                                                            e.target.measure((_x, _y, _w, h, _px, pageY) => {
                                                                const ratio = 1 - Math.max(0, Math.min(1, (touchY - pageY) / h));
                                                                const newLevel = Math.round(bandRange.min + ratio * (bandRange.max - bandRange.min));
                                                                setEqualizerBand(index, newLevel);
                                                                EqualizerService.setBandLevel(index, newLevel);
                                                            });
                                                        }}
                                                        onResponderMove={(e) => {
                                                            const { pageY: touchY } = e.nativeEvent;
                                                            e.target.measure((_x, _y, _w, h, _px, pageY) => {
                                                                const ratio = 1 - Math.max(0, Math.min(1, (touchY - pageY) / h));
                                                                const newLevel = Math.round(bandRange.min + ratio * (bandRange.max - bandRange.min));
                                                                setEqualizerBand(index, newLevel);
                                                                EqualizerService.setBandLevel(index, newLevel);
                                                            });
                                                        }}
                                                        onResponderRelease={() => setScrollEnabled(true)}
                                                        onResponderTerminate={() => setScrollEnabled(true)}
                                                    />
                                                    <Text style={styles.eqBandFreq}>{freqLabel}</Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                </View>

                                <View style={styles.separator} />

                                <View style={{ marginVertical: 8 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text style={styles.settingLabel}>{t('settings.bass_boost')}</Text>
                                        <Text style={[styles.settingLabel, { color: '#8B5CF6' }]}>
                                            {Math.round(bassBoostStrength / 10)}%
                                        </Text>
                                    </View>
                                    <Text style={styles.settingDescription}>{t('settings.bass_boost_desc')}</Text>
                                    <Slider
                                        style={{ width: '100%', height: 40, marginTop: 8 }}
                                        minimumValue={0}
                                        maximumValue={1000}
                                        step={10}
                                        value={bassBoostStrength}
                                        onValueChange={async (value) => {
                                            setBassBoostStrength(value);
                                            await EqualizerService.setBassBoost(value);
                                        }}
                                        minimumTrackTintColor="#8B5CF6"
                                        maximumTrackTintColor="#282828"
                                        thumbTintColor="#FFFFFF"
                                    />
                                </View>
                            </>
                        )}
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
    eqBandsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        height: 180,
        paddingTop: 24,
        paddingBottom: 24,
        marginTop: 8,
    },
    eqBand: {
        flex: 1,
        alignItems: 'center',
        height: '100%',
        position: 'relative',
    },
    eqBandDb: {
        fontSize: 9,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        marginBottom: 4,
        position: 'absolute',
        top: 0,
    },
    eqSliderTrack: {
        width: 6,
        flex: 1,
        backgroundColor: '#1C1C1C',
        borderRadius: 3,
        overflow: 'hidden',
        justifyContent: 'flex-end',
        marginTop: 18,
        marginBottom: 18,
        position: 'relative',
    },
    eqSliderFill: {
        width: '100%',
        borderRadius: 3,
    },
    eqSliderThumb: {
        position: 'absolute',
        left: -5,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
        elevation: 4,
    },
    eqTouchArea: {
        position: 'absolute',
        top: 18,
        bottom: 18,
        left: -10,
        right: -10,
        zIndex: 10,
    },
    eqBandFreq: {
        fontSize: 8,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        color: '#666',
        position: 'absolute',
        bottom: 0,
        textAlign: 'center',
    },
    eqResetBtn: {
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.3)',
    },
    eqResetText: {
        fontSize: 12,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        color: '#8B5CF6',
    },
});
