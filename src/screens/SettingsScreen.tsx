import { Ionicons } from '@expo/vector-icons';
import withObservables from '@nozbe/with-observables';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { database } from '../database';
import { useSettingsStore } from '../store/useSettingsStore';
import { ScannerService } from '../services/ScannerService';
import { Layout } from '../theme/theme';

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
    const { showTagColors, setShowTagColors, excludedFolders, includeFolder } = useSettingsStore();
    const [isScanning, setIsScanning] = useState(false);


    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#000000', '#22222221', '#000000']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />

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
                <Text style={styles.headerTitle}>Configuración</Text>
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
                    <Text style={styles.sectionTitle}>Estado de tu Biblioteca</Text>
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{tracksCount}</Text>
                            <Text style={styles.statLabel}>Canciones</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{albumsCount}</Text>
                            <Text style={styles.statLabel}>Álbumes</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{artistsCount}</Text>
                            <Text style={styles.statLabel}>Artistas</Text>
                        </View>
                    </View>
                </View>

                {/* --- SECCIÓN DE AJUSTES --- */}
                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Visualización</Text>
                    <View style={styles.settingRow}>
                        <View style={{ flex: 1, paddingRight: 15 }}>
                            <Text style={styles.settingLabel}>Colores de etiquetas</Text>
                            <Text style={styles.settingDescription}>
                                Mostrar las etiquetas con su color asignado en el reproductor y detalle de álbum. Si se desactiva, se mostrarán en gris con baja opacidad.
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
                </View>

                {/* --- SECCIÓN DE CARPETAS EXCLUIDAS --- */}
                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Carpetas excluidas</Text>
                    {excludedFolders.length === 0 ? (
                        <Text style={styles.noExcludedText}>No hay carpetas excluidas.</Text>
                    ) : (
                        excludedFolders.map((folderPath) => {
                            const folderName = decodeURIComponent(folderPath.substring(folderPath.lastIndexOf('/') + 1));
                            return (
                                <View key={folderPath} style={styles.excludedFolderRow}>
                                    <View style={{ flex: 1, paddingRight: 10 }}>
                                        <Text style={styles.folderNameText} numberOfLines={1}>{folderName}</Text>
                                        <Text style={styles.folderPathText} numberOfLines={1}>{folderPath}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.restoreButton}
                                        disabled={isScanning}
                                        onPress={async () => {
                                            includeFolder(folderPath);
                                            setIsScanning(true);
                                            try {
                                                await ScannerService.autoScanAndroid();
                                            } catch (err) {
                                                console.error("Error scanning after restore:", err);
                                            } finally {
                                                setIsScanning(false);
                                            }
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="refresh-outline" size={16} color="#8B5CF6" />
                                        <Text style={styles.restoreButtonText}>
                                            {isScanning ? 'Sincronizando...' : 'Restaurar'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            );
                        })
                    )}
                </View>

                {/* --- SECCIÓN DE DEBUG --- */}
                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Depuración</Text>
                    <TouchableOpacity
                        style={styles.buttonRow}
                        onPress={() => navigation.navigate('DebugHistory')}
                    >
                        <View style={{ flex: 1, paddingRight: 15 }}>
                            <Text style={styles.settingLabel}>Debug Historial</Text>
                            <Text style={styles.settingDescription}>
                                Ver el historial completo de reproducción almacenado en la base de datos local.
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#8B5CF6" />
                    </TouchableOpacity>
                </View>


                {/* --- SECCIÓN DE APP INFO --- */}
                <View style={styles.infoTextContainer}>
                    <Text style={styles.infoText}>MMPlayer v0.3.0-beta</Text>
                    <Text style={styles.infoTextSub}>Desarrollado por pescalerag. Betatesteado por Killerdroid</Text>
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
        paddingVertical: 8,
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
});

const SettingsScreen = withObservables([], () => ({
    tracksCount: database.get('tracks').query().observeCount(),
    albumsCount: database.get('albums').query().observeCount(),
    artistsCount: database.get('artists').query().observeCount(),
}))(SettingsContent);

SettingsScreen.displayName = 'SettingsScreen';

export default SettingsScreen;
