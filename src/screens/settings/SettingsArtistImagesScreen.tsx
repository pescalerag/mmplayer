import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ArtistImageService } from '../../services/ArtistImageService';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useSyncStore } from '../../store/useSyncStore';
import { ScreenHeaderLayout } from '@/components/layouts/ScreenHeaderLayout';
import { useAppTheme } from '../../hooks/useAppTheme';

export default function SettingsArtistImagesScreen() {
    const { t } = useTranslation();
    const { colors } = useAppTheme();

    const {
        artistImageDownloadMode,
        setArtistImageDownloadMode,
        artistImageBackgroundDownload,
        setArtistImageBackgroundDownload
    } = useSettingsStore();
    const isDownloading = useSyncStore(state => state.isDownloadingArtistImages);

    const modes: { value: 'disabled' | 'main' | 'all'; label: string }[] = [
        { value: 'disabled', label: t('settings.artist_images_mode_disabled') || 'Desactivado' },
        { value: 'main', label: t('settings.artist_images_mode_main') || 'Solo artistas principales' },
        { value: 'all', label: t('settings.artist_images_mode_all') || 'Todos (colaboradores incluidos)' },
    ];

    const executeDownload = async (forceRefresh: boolean) => {
        try {
            await ArtistImageService.processMissingArtistImages({ forceRefresh });
            Alert.alert(
                t('settings.success') || 'Éxito',
                t('settings.artist_images_download_success') || 'Se han procesado y descargado las imágenes de artistas disponibles.'
            );
        } catch (e) {
            console.error('Error downloading artist images:', e);
            Alert.alert(
                t('common.error') || 'Error',
                t('settings.artist_images_download_error') || 'Hubo un problema al procesar las imágenes de artistas.'
            );
        }
    };

    const handleStartDownload = () => {
        Alert.alert(
            t('settings.artist_images_download_title') || 'Descargar imágenes de artistas',
            t('settings.artist_images_download_confirm') || '¿Deseas buscar y descargar imágenes para todos los artistas que no tengan una?',
            [
                { text: t('actions.cancel') || 'Cancelar', style: 'cancel' },
                {
                    text: t('settings.artist_images_download_all_btn') || 'Descargar solo faltantes',
                    onPress: () => executeDownload(false),
                },
                {
                    text: t('settings.artist_images_refresh_all_btn') || 'Re-descargar todo',
                    style: 'destructive',
                    onPress: () => executeDownload(true),
                },
            ]
        );
    };

    return (
        <ScreenHeaderLayout title={t('settings.artist_images_title') || 'Imágenes de Artistas'}>
            {({ headerHeight, bottomPadding }) => (
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={[
                        styles.scrollContent,
                        {
                            paddingTop: headerHeight + 20,
                            paddingBottom: bottomPadding + 20
                        }
                    ]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* SELECTOR DE MODO */}
                    <Text style={styles.sectionTitle}>{t('settings.artist_images_mode_section') || 'Modo de descarga'}</Text>
                    <View style={styles.sectionCard}>
                        {modes.map((mode, index) => {
                            const active = artistImageDownloadMode === mode.value;
                            return (
                                <View key={mode.value}>
                                    <TouchableOpacity
                                        style={styles.optionRow}
                                        onPress={() => setArtistImageDownloadMode(mode.value)}
                                        activeOpacity={0.7}
                                        disabled={isDownloading}
                                    >
                                        <Text style={[styles.optionLabel, active && [styles.optionLabelActive, { color: colors.accent }]]}>
                                            {mode.label}
                                        </Text>
                                        {active && (
                                            <Ionicons name="checkmark" size={20} color={colors.accent} />
                                        )}
                                    </TouchableOpacity>
                                    {index < modes.length - 1 && <View style={styles.separator} />}
                                </View>
                            );
                        })}
                    </View>

                    {/* CONFIGURACIÓN DE DESCARGA EN SEGUNDO PLANO */}
                    <Text style={styles.sectionTitle}>{t('settings.artist_images_bg_download') || 'Descarga en segundo plano'}</Text>
                    <View style={styles.sectionCard}>
                        <View style={styles.settingRow}>
                            <View style={{ flex: 1, paddingRight: 15 }}>
                                <Text style={[styles.settingLabel, (isDownloading || artistImageDownloadMode === 'disabled') && { opacity: 0.4 }]}>
                                    {t('settings.artist_images_bg_download_label') || 'Descargar en segundo plano'}
                                </Text>
                                <Text style={[styles.settingDescription, (isDownloading || artistImageDownloadMode === 'disabled') && { opacity: 0.4 }]}>
                                    {t('settings.artist_images_bg_download_desc') || 'Descarga imágenes automáticamente al escanear la biblioteca. Si se desactiva, solo se descargarán de forma manual.'}
                                </Text>
                            </View>
                            <Switch
                                value={artistImageBackgroundDownload}
                                onValueChange={setArtistImageBackgroundDownload}
                                trackColor={{ false: '#282828', true: colors.accent }}
                                thumbColor={artistImageBackgroundDownload && artistImageDownloadMode !== 'disabled' ? '#FFFFFF' : '#888888'}
                                ios_backgroundColor="#282828"
                                disabled={isDownloading || artistImageDownloadMode === 'disabled'}
                            />
                        </View>
                    </View>

                    {/* ADVERTENCIA E INFORMACIÓN */}
                    <View style={styles.infoCard}>
                        <Ionicons name="information-circle-outline" size={24} color={colors.accent} style={styles.infoIcon} />
                        <Text style={styles.infoText}>
                            {t('settings.artist_images_download_desc') ||
                                'Busca y descarga automáticamente imágenes locales para los artistas que no las tienen. Este proceso consume datos de internet y almacenamiento.'}
                        </Text>
                    </View>

                    {/* ACCIÓN DE DESCARGA MANUAL */}
                    <TouchableOpacity
                        style={[
                            styles.downloadButton,
                            { backgroundColor: colors.accent },
                            (artistImageDownloadMode === 'disabled' || isDownloading) && styles.downloadButtonDisabled
                        ]}
                        onPress={handleStartDownload}
                        activeOpacity={0.8}
                        disabled={artistImageDownloadMode === 'disabled' || isDownloading}
                    >
                        {isDownloading ? (
                            <View style={styles.buttonInner}>
                                <ActivityIndicator size="small" color="#FFFFFF" />
                                <Text style={styles.downloadButtonText}>
                                    {t('settings.artist_images_download_btn_running') || 'Descargando...'}
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.buttonInner}>
                                <Ionicons name="cloud-download-outline" size={20} color="#FFFFFF" />
                                <Text style={styles.downloadButtonText}>
                                    {t('settings.artist_images_download_btn') || 'Descargar imágenes ahora'}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            )}
        </ScreenHeaderLayout>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        paddingHorizontal: 20,
    },
    sectionTitle: {
        color: '#A0A0A0',
        fontSize: 12,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        textTransform: 'uppercase',
        marginBottom: 8,
        marginLeft: 4,
    },
    sectionCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    optionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
    },
    optionLabel: {
        color: '#888888',
        fontSize: 15,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    optionLabelActive: {
        color: '#FFFFFF',
    },
    separator: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
    },
    infoCard: {
        flexDirection: 'row',
        backgroundColor: 'rgba(139, 92, 246, 0.05)',
        borderColor: 'rgba(139, 92, 246, 0.15)',
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        gap: 12,
    },
    infoIcon: {
        marginTop: 2,
    },
    infoText: {
        color: '#A0A0A0',
        fontSize: 13,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        lineHeight: 18,
        flex: 1,
    },
    downloadButton: {
        backgroundColor: '#8B5CF6',
        borderRadius: 24,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    downloadButtonDisabled: {
        backgroundColor: '#4B3F72',
        opacity: 0.5,
    },
    buttonInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    downloadButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
    },
    settingLabel: {
        color: '#FFFFFF',
        fontSize: 15,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    settingDescription: {
        color: '#888888',
        fontSize: 12,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        marginTop: 4,
        lineHeight: 16,
    },
});
