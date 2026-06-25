import { Ionicons } from '@expo/vector-icons';
import withObservables from '@nozbe/with-observables';
import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
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
import { useAppTabsOrderSheetStore } from '../store/useAppTabsOrderSheetStore';
import { useLibraryTabsOrderSheetStore } from '../store/useLibraryTabsOrderSheetStore';
import { SwipeAction, useSettingsStore } from '../store/useSettingsStore';
import { useSwipeActionSheetStore } from '../store/useSwipeActionSheetStore';
import { useSyncStore } from '../store/useSyncStore';
import { Colors, Layout } from '../theme/theme';

// Tipos para los observables
interface SettingsProps {
    readonly tracksCount: number;
    readonly albumsCount: number;
    readonly artistsCount: number;
}

function SettingsContent({ tracksCount, albumsCount, artistsCount }: SettingsProps) {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<any>();
    const [headerHeight, setHeaderHeight] = useState(100);
    const isScanning = useSyncStore(state => state.isScanning);
    const {
        showTagColors,
        setShowTagColors,
        language,
        setLanguage,
        hideSyncToastOnResume,
        setHideSyncToastOnResume,
        swipeLeftAction,
        swipeRightAction,
        isNormalizationEnabled,
        setNormalizationEnabled,
        preampLevel,
        setPreampLevel,
        fallbackGainDB,
        setFallbackGain,
        userAlias,
        setForceWelcomeModal
    } = useSettingsStore();
    const { t } = useTranslation();
    const { openSheet } = useSwipeActionSheetStore();
    const openLibraryTabsOrderSheet = useLibraryTabsOrderSheetStore(s => s.openSheet);
    const openAppTabsOrderSheet = useAppTabsOrderSheetStore(s => s.openSheet);

    const swipeOptions: { label: string, value: SwipeAction, icon: any }[] = [
        { label: t('settings.swipe_action_add_next'), value: 'add_next', icon: 'return-down-forward' },
        { label: t('settings.swipe_action_add_last'), value: 'add_last', icon: 'list' },
        { label: t('actions.add_to_playlist'), value: 'add_to_playlist', icon: 'add-circle-outline' },
        { label: t('settings.swipe_action_toggle_favorite'), value: 'toggle_favorite', icon: 'heart' },
        { label: t('settings.swipe_action_none'), value: 'none', icon: 'close' },
    ];


    return (
        <View style={[styles.container, { backgroundColor: Colors.background }]}>

            {/* 2. CAPA DEL HUMO (INTERMEDIO) */}
            <LinearGradient
                colors={['#000000', 'rgba(0, 0, 0, 0.9)', 'rgba(0, 0, 0, 0.7)', 'transparent']}
                locations={[0, 0.4, 0.7, 1]}
                style={[styles.smokeEffect, { height: headerHeight + 30 }]}
                pointerEvents="none"
            />

            {/* 2.5 CAPA DE ILUMINACIÓN MORADA (SOBRE EL HUMO) */}
            <LinearGradient
                colors={["#8B5CF633", "transparent"]}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200, zIndex: 2 }}
                pointerEvents="none"
            />

            {/* 3. CAPA DE LA INTERFAZ (FRENTE) */}
            <View
                onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + 10, paddingHorizontal: 20, zIndex: 10 }}
            >
                <Text style={styles.headerTitle}>{t('settings.title')}</Text>
            </View>

            {/* 1. CAPA DE CONTENIDO (AL FONDO) */}
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={[
                    styles.scrollContent,
                    {
                        paddingTop: headerHeight + 20,
                        paddingBottom: Layout.MINI_PLAYER_HEIGHT + Layout.TAB_BAR_HEIGHT + Layout.PLAYER_MARGIN + insets.bottom
                    }
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* --- SECCIÓN DE ESTADÍSTICAS --- */}
                <View style={styles.statsCard}>
                    <Text style={styles.sectionTitle}>{t('settings.library_status')}</Text>
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{tracksCount}</Text>
                            <Text style={styles.statLabel}>{t('library.songs')}</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{albumsCount}</Text>
                            <Text style={styles.statLabel}>{t('library.albums')}</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{artistsCount}</Text>
                            <Text style={styles.statLabel}>{t('library.artists')}</Text>
                        </View>
                    </View>
                </View>

                {/* --- SECCIÓN DE IDIOMA --- */}
                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
                    <View style={styles.languageContainer}>
                        <TouchableOpacity
                            style={[
                                styles.languageButton,
                                language === 'es' && styles.languageButtonActive
                            ]}
                            onPress={() => setLanguage('es')}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.flagEmoji}>🇪🇸</Text>
                            <Text style={[
                                styles.languageText,
                                language === 'es' && styles.languageTextActive
                            ]}>Español</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.languageButton,
                                language === 'en' && styles.languageButtonActive
                            ]}
                            onPress={() => setLanguage('en')}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.flagEmoji}>🇬🇧</Text>
                            <Text style={[
                                styles.languageText,
                                language === 'en' && styles.languageTextActive
                            ]}>English</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* --- SECCIÓN DE AJUSTES --- */}
                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>{t('settings.visualization') || 'Visualización y Apariencia'}</Text>

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
                </View>

                {/* --- SECCIÓN DE AUDIO (NORMALIZACIÓN) --- */}
                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>{t('settings.audio_section')}</Text>
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
                                        // Aplicar volumen en tiempo real
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



                {/* --- SECCIÓN DE GESTOS --- */}
                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>{t('settings.swipe_actions')}</Text>
                    <TouchableOpacity
                        style={styles.buttonRow}
                        onPress={() => {
                            openSheet('left');
                        }}
                    >
                        <View style={{ flex: 1, paddingRight: 15 }}>
                            <Text style={styles.settingLabel}>{t('settings.swipe_left')}</Text>
                            <Text style={styles.settingDescription}>
                                {swipeOptions.find(o => o.value === swipeLeftAction)?.label}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#8B5CF6" />
                    </TouchableOpacity>
                    <View style={styles.separator} />
                    <TouchableOpacity
                        style={styles.buttonRow}
                        onPress={() => {
                            openSheet('right');
                        }}
                    >
                        <View style={{ flex: 1, paddingRight: 15 }}>
                            <Text style={styles.settingLabel}>{t('settings.swipe_right')}</Text>
                            <Text style={styles.settingDescription}>
                                {swipeOptions.find(o => o.value === swipeRightAction)?.label}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#8B5CF6" />
                    </TouchableOpacity>
                </View>


                {/* --- SECCIÓN DE EXCLUSIONES --- */}
                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>{t('settings.exclusions')}</Text>
                    <TouchableOpacity
                        style={styles.buttonRow}
                        onPress={() => navigation.navigate('ExcludedFolders')}
                    >
                        <View style={{ flex: 1, paddingRight: 15 }}>
                            <Text style={styles.settingLabel}>{t('settings.excluded_folders')}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#8B5CF6" />
                    </TouchableOpacity>
                    <View style={styles.separator} />
                    <TouchableOpacity
                        style={styles.buttonRow}
                        onPress={() => navigation.navigate('ExcludedSongs')}
                    >
                        <View style={{ flex: 1, paddingRight: 15 }}>
                            <Text style={styles.settingLabel}>{t('settings.excluded_songs')}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#8B5CF6" />
                    </TouchableOpacity>
                </View>

                {/* --- SECCIÓN DE DEBUG --- */}
                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>{t('settings.debug')}</Text>
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


                {/* --- SECCIÓN DE INFORMACIÓN --- */}
                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>{t('settings.info')}</Text>
                    <TouchableOpacity
                        style={styles.buttonRow}
                        onPress={() => navigation.navigate('ChangelogScreen')}
                    >
                        <View style={{ flex: 1, paddingRight: 15 }}>
                            <Text style={styles.settingLabel}>{t('settings.about_version')}</Text>
                            <Text style={styles.settingDescription}>
                                {t('settings.release_notes')}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#8B5CF6" />
                    </TouchableOpacity>
                </View>

                {/* --- SECCIÓN DE APP INFO FOOTER --- */}
                <View style={styles.infoTextContainer}>
                    <Text style={styles.infoText}>MMPlayer v{Constants.expoConfig?.version || '1.1.0'}</Text>
                    <Text style={styles.infoTextSub}>{t('settings.credits')}</Text>
                </View>
            </ScrollView>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
    },
    headerTitle: {
        fontSize: 32,
        fontFamily: 'Montserrat',
        fontWeight: '900',
        color: '#FFFFFF',
        marginBottom: 24,
    },
    statsCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
    },
    sectionCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 16,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 22,
        fontFamily: 'Montserrat',
        fontWeight: '800',
        color: '#8B5CF6',
    },
    statLabel: {
        fontSize: 12,
        fontFamily: 'Montserrat', fontWeight: '600',
        color: '#9A9A9A',
        marginTop: 4,
    },
    divider: {
        width: 1,
        height: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    infoTextContainer: {
        marginTop: 40,
        alignItems: 'center',
    },
    infoText: {
        color: '#888888',
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    infoTextSub: {
        color: '#666666',
        fontSize: 12,
        fontFamily: 'Montserrat', fontWeight: '700',
        marginTop: 4,
    },
    smokeEffect: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 160,
        zIndex: 1,
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
    noExcludedText: {
        color: '#888888',
        fontStyle: 'italic',
        fontSize: 14,
        fontFamily: 'Montserrat', fontWeight: '600',
    },
    excludedFolderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    folderNameText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    folderPathText: {
        color: '#666666',
        fontSize: 11,
        fontFamily: 'Montserrat', fontWeight: '600',
        marginTop: 2,
    },
    restoreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 15,
        gap: 4,
    },
    restoreButtonText: {
        color: '#8B5CF6',
        fontSize: 12,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    languageContainer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 4,
    },
    languageButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        paddingVertical: 12,
        gap: 8,
    },
    languageButtonActive: {
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        borderColor: '#8B5CF6',
    },
    flagEmoji: {
        fontSize: 20,
    },
    languageText: {
        color: '#888888',
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    languageTextActive: {
        color: '#FFFFFF',
    },
    lyricsSyncProgress: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 4,
    },
    lyricsSyncText: {
        flex: 1,
        color: '#CCCCCC',
        fontSize: 13,
        fontFamily: 'Montserrat',
        fontWeight: '600',
    },
    lyricsCancelText: {
        color: '#EF4444',
        fontSize: 13,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    lyricsStartButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#8B5CF6',
        borderRadius: 12,
        paddingVertical: 13,
        paddingHorizontal: 20,
        marginTop: 4,
    },
    lyricsStartButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
});

const SettingsScreen = withObservables([], () => ({
    tracksCount: database.get('tracks').query().observeCount(),
    albumsCount: database.get('albums').query().observeCount(),
    artistsCount: database.get('artists').query().observeCount(),
}))(SettingsContent);

SettingsScreen.displayName = 'SettingsScreen';

export default SettingsScreen;
