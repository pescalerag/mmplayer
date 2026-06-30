import { Ionicons } from '@expo/vector-icons';
import withObservables from '@nozbe/with-observables';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { database } from '../database';
import { Colors, Layout } from '../theme/theme';
import { BackupService } from '../services/BackupService';

interface SettingsProps {
    readonly tracksCount: number;
    readonly albumsCount: number;
    readonly artistsCount: number;
}

function SettingsContent({ tracksCount, albumsCount, artistsCount }: SettingsProps) {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<any>();
    const [headerHeight, setHeaderHeight] = useState(100);
    const { t } = useTranslation();

    return (
        <View style={[styles.container, { backgroundColor: Colors.background }]}>

            {/* CAPA DEL HUMO (INTERMEDIO) */}
            <LinearGradient
                colors={['#000000', 'rgba(0, 0, 0, 0.9)', 'rgba(0, 0, 0, 0.7)', 'transparent']}
                locations={[0, 0.4, 0.7, 1]}
                style={[styles.smokeEffect, { height: headerHeight + 30 }]}
                pointerEvents="none"
            />

            {/* CAPA DE ILUMINACIÓN MORADA (SOBRE EL HUMO) */}
            <LinearGradient
                colors={["#8B5CF633", "transparent"]}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200, zIndex: 2 }}
                pointerEvents="none"
            />

            {/* CAPA DE LA INTERFAZ (FRENTE) */}
            <View
                onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + 10, paddingHorizontal: 20, zIndex: 10 }}
            >
                <Text style={styles.headerTitle}>{t('settings.title')}</Text>
            </View>

            {/* CAPA DE CONTENIDO (AL FONDO) */}
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
                keyboardShouldPersistTaps="handled"
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

                {/* --- MENÚ DE OPCIONES DE CONFIGURACIÓN --- */}
                <View style={styles.sectionCard}>
                    {/* APARIENCIA */}
                    <TouchableOpacity
                        style={styles.menuRow}
                        onPress={() => navigation.navigate('SettingsAppearance')}
                        activeOpacity={0.7}
                    >
                        <View style={styles.menuRowLeft}>
                            <View style={styles.iconContainer}>
                                <Ionicons name="eye-outline" size={22} color="#8B5CF6" />
                            </View>
                            <View style={styles.menuTextContainer}>
                                <Text style={styles.settingLabel}>{t('settings.visualization')}</Text>
                                <Text style={styles.settingDescription}>
                                    {t('settings.visualization_desc')}
                                </Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#8B5CF6" />
                    </TouchableOpacity>

                    <View style={styles.separator} />

                    {/* AUDIO */}
                    <TouchableOpacity
                        style={styles.menuRow}
                        onPress={() => navigation.navigate('SettingsAudio')}
                        activeOpacity={0.7}
                    >
                        <View style={styles.menuRowLeft}>
                            <View style={styles.iconContainer}>
                                <Ionicons name="volume-high-outline" size={22} color="#8B5CF6" />
                            </View>
                            <View style={styles.menuTextContainer}>
                                <Text style={styles.settingLabel}>{t('settings.audio_section')}</Text>
                                <Text style={styles.settingDescription}>
                                    {t('settings.audio_section_desc')}
                                </Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#8B5CF6" />
                    </TouchableOpacity>

                    <View style={styles.separator} />

                    {/* GESTOS */}
                    <TouchableOpacity
                        style={styles.menuRow}
                        onPress={() => navigation.navigate('SettingsGestures')}
                        activeOpacity={0.7}
                    >
                        <View style={styles.menuRowLeft}>
                            <View style={styles.iconContainer}>
                                <Ionicons name="hand-left-outline" size={22} color="#8B5CF6" />
                            </View>
                            <View style={styles.menuTextContainer}>
                                <Text style={styles.settingLabel}>{t('settings.swipe_actions')}</Text>
                                <Text style={styles.settingDescription}>
                                    {t('settings.swipe_actions_desc')}
                                </Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#8B5CF6" />
                    </TouchableOpacity>

                    <View style={styles.separator} />

                    {/* IDIOMA */}
                    <TouchableOpacity
                        style={styles.menuRow}
                        onPress={() => navigation.navigate('SettingsLanguage')}
                        activeOpacity={0.7}
                    >
                        <View style={styles.menuRowLeft}>
                            <View style={styles.iconContainer}>
                                <Ionicons name="language-outline" size={22} color="#8B5CF6" />
                            </View>
                            <View style={styles.menuTextContainer}>
                                <Text style={styles.settingLabel}>{t('settings.language')}</Text>
                                <Text style={styles.settingDescription}>
                                    {t('settings.language_desc')}
                                </Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#8B5CF6" />
                    </TouchableOpacity>

                    <View style={styles.separator} />

                    {/* IMÁGENES DE ARTISTAS */}
                    <TouchableOpacity
                        style={styles.menuRow}
                        onPress={() => navigation.navigate('SettingsArtistImages')}
                        activeOpacity={0.7}
                    >
                        <View style={styles.menuRowLeft}>
                            <View style={styles.iconContainer}>
                                <Ionicons name="image-outline" size={22} color="#8B5CF6" />
                            </View>
                            <View style={styles.menuTextContainer}>
                                <Text style={styles.settingLabel}>{t('settings.artist_images_title')}</Text>
                                <Text style={styles.settingDescription}>
                                    {t('settings.artist_images_desc')}
                                </Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#8B5CF6" />
                    </TouchableOpacity>

                    <View style={styles.separator} />

                    {/* EXCLUSIONES */}
                    <TouchableOpacity
                        style={styles.menuRow}
                        onPress={() => navigation.navigate('SettingsExclusions')}
                        activeOpacity={0.7}
                    >
                        <View style={styles.menuRowLeft}>
                            <View style={styles.iconContainer}>
                                <Ionicons name="close-circle-outline" size={22} color="#8B5CF6" />
                            </View>
                            <View style={styles.menuTextContainer}>
                                <Text style={styles.settingLabel}>{t('settings.exclusions')}</Text>
                                <Text style={styles.settingDescription}>
                                    {t('settings.exclusions_desc')}
                                </Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#8B5CF6" />
                    </TouchableOpacity>

                    <View style={styles.separator} />

                    {/* DEPURACIÓN */}
                    <TouchableOpacity
                        style={styles.menuRow}
                        onPress={() => navigation.navigate('SettingsDebug')}
                        activeOpacity={0.7}
                    >
                        <View style={styles.menuRowLeft}>
                            <View style={styles.iconContainer}>
                                <Ionicons name="bug-outline" size={22} color="#8B5CF6" />
                            </View>
                            <View style={styles.menuTextContainer}>
                                <Text style={styles.settingLabel}>{t('settings.debug')}</Text>
                                <Text style={styles.settingDescription}>
                                    {t('settings.debug_desc')}
                                </Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#8B5CF6" />
                    </TouchableOpacity>
                </View>

                {/* --- SECCIÓN DE COPIAS DE SEGURIDAD --- */}
                <View style={styles.sectionCard}>
                    {/* EXPORTAR COPIA */}
                    <TouchableOpacity
                        style={styles.menuRow}
                        onPress={() => BackupService.exportDatabase()}
                        activeOpacity={0.7}
                    >
                        <View style={styles.menuRowLeft}>
                            <View style={styles.iconContainer}>
                                <Ionicons name="cloud-upload-outline" size={22} color="#8B5CF6" />
                            </View>
                            <View style={styles.menuTextContainer}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={styles.settingLabel}>{t('settings.backup_export')}</Text>
                                    <View style={styles.betaBadge}>
                                        <Text style={styles.betaBadgeText}>BETA</Text>
                                    </View>
                                </View>
                                <Text style={styles.settingDescription}>
                                    {t('settings.backup_export_desc')}
                                </Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#8B5CF6" />
                    </TouchableOpacity>

                    <View style={styles.separator} />

                    {/* IMPORTAR COPIA */}
                    <TouchableOpacity
                        style={styles.menuRow}
                        onPress={() => BackupService.importDatabase()}
                        activeOpacity={0.7}
                    >
                        <View style={styles.menuRowLeft}>
                            <View style={styles.iconContainer}>
                                <Ionicons name="cloud-download-outline" size={22} color="#8B5CF6" />
                            </View>
                            <View style={styles.menuTextContainer}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={styles.settingLabel}>{t('settings.backup_import')}</Text>
                                    <View style={styles.betaBadge}>
                                        <Text style={styles.betaBadgeText}>BETA</Text>
                                    </View>
                                </View>
                                <Text style={styles.settingDescription}>
                                    {t('settings.backup_import_desc')}
                                </Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#8B5CF6" />
                    </TouchableOpacity>
                </View>

                {/* --- SECCIÓN SÍGUENOS --- */}
                <View style={styles.sectionCard}>
                    <TouchableOpacity
                        style={styles.menuRow}
                        onPress={() => Linking.openURL('https://github.com/pescalerag/mmplayer')}
                        activeOpacity={0.7}
                    >
                        <View style={styles.menuRowLeft}>
                            <View style={styles.iconContainer}>
                                <Ionicons name="logo-github" size={22} color="#8B5CF6" />
                            </View>
                            <View style={styles.menuTextContainer}>
                                <Text style={styles.settingLabel}>{t('settings.follow_us')}</Text>
                                <Text style={styles.settingDescription}>
                                    {t('settings.follow_us_desc')}
                                </Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#8B5CF6" />
                    </TouchableOpacity>
                </View>

                {/* --- SECCIÓN DE INFORMACIÓN --- */}
                <View style={styles.sectionCard}>
                    <TouchableOpacity
                        style={styles.menuRow}
                        onPress={() => navigation.navigate('ChangelogScreen')}
                        activeOpacity={0.7}
                    >
                        <View style={styles.menuRowLeft}>
                            <View style={styles.iconContainer}>
                                <Ionicons name="information-circle-outline" size={22} color="#8B5CF6" />
                            </View>
                            <View style={styles.menuTextContainer}>
                                <Text style={styles.settingLabel}>{t('settings.about_version')}</Text>
                                <Text style={styles.settingDescription}>
                                    {t('settings.release_notes')}
                                </Text>
                            </View>
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
        paddingHorizontal: 20,
        paddingVertical: 10,
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
        fontFamily: 'Montserrat',
        fontWeight: '600',
        color: '#9A9A9A',
        marginTop: 4,
    },
    divider: {
        width: 1,
        height: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    infoTextContainer: {
        marginTop: 20,
        marginBottom: 40,
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
        fontFamily: 'Montserrat',
        fontWeight: '700',
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
    menuRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
    },
    menuRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        paddingRight: 15,
        gap: 12,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    menuTextContainer: {
        flex: 1,
    },
    separator: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    betaBadge: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.25)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        alignSelf: 'center',
    },
    betaBadgeText: {
        color: '#F59E0B',
        fontSize: 9,
        fontWeight: '900',
        fontFamily: 'Montserrat',
        letterSpacing: 0.5,
    },
});

const SettingsScreen = withObservables([], () => ({
    tracksCount: database.get('tracks').query().observeCount(),
    albumsCount: database.get('albums').query().observeCount(),
    artistsCount: database.get('artists').query().observeCount(),
}))(SettingsContent);

SettingsScreen.displayName = 'SettingsScreen';

export default SettingsScreen;
