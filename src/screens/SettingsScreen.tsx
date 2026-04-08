import { Ionicons } from '@expo/vector-icons';
import withObservables from '@nozbe/with-observables';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { database } from '../database';
import { usePlayerStore } from '../store/usePlayerStore';
import { Layout } from '../theme/theme';

// Tipos para los observables
interface SettingsProps {
    readonly tracksCount: number;
    readonly albumsCount: number;
    readonly artistsCount: number;
}

function SettingsContent({ tracksCount, albumsCount, artistsCount }: SettingsProps) {
    const insets = useSafeAreaInsets();
    const [deleteImages, setDeleteImages] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    const [headerHeight, setHeaderHeight] = useState(100);

    const handleClearLibrary = async () => {
        Alert.alert(
            'Vaciar Biblioteca',
            '¿Estás seguro de que quieres eliminar todas las canciones, álbumes y artistas de la base de datos?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Sí, borrar todo',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setIsClearing(true);

                            // 1. Resetear base de datos
                            await database.write(async () => {
                                await database.unsafeResetDatabase();
                            });

                            // 2. Detener y limpiar el reproductor para evitar errores de punteros nulos
                            await usePlayerStore.getState().clearPlayer();

                            // 3. Opcional: Borrar imágenes de artistas
                            if (deleteImages) {
                                const baseDir = FileSystem.documentDirectory;
                                if (baseDir) {
                                    const files = await FileSystem.readDirectoryAsync(baseDir);
                                    for (const file of files) {
                                        if (file.endsWith('.jpg') || file.endsWith('.png')) {
                                            await FileSystem.deleteAsync(baseDir + file, { idempotent: true });
                                        }
                                    }
                                }
                            }

                            Alert.alert('¡Éxito!', 'La biblioteca ha sido vaciada correctamente.');
                        } catch (error) {
                            Alert.alert('Error', 'Hubo un fallo al vaciar la biblioteca.');
                            console.error(error);
                        } finally {
                            setIsClearing(false);
                        }
                    }
                }
            ]
        );
    };

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

                {/* --- SECCIÓN DE ACCIONES --- */}
                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Acciones de Datos</Text>

                    <View style={styles.actionRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.actionLabel}>Borrar imágenes de artistas</Text>
                            <Text style={styles.actionSublabel}>Al vaciar la biblioteca, también se eliminarán las fotos descargadas.</Text>
                        </View>
                        <Switch
                            value={deleteImages}
                            onValueChange={setDeleteImages}
                            trackColor={{ false: '#282828', true: '#8B5CF6' }}
                            thumbColor={'#FFFFFF'}
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.clearButton, isClearing && { opacity: 0.5 }]}
                        onPress={handleClearLibrary}
                        disabled={isClearing}
                    >
                        <Ionicons name="trash-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                        <Text style={styles.clearButtonText}>Vaciar Biblioteca</Text>
                    </TouchableOpacity>

                    <View style={styles.disclaimerContainer}>
                        <Ionicons name="information-circle-outline" size={18} color="#9A9A9A" style={{ marginRight: 8, marginTop: 2 }} />
                        <Text style={styles.disclaimerText}>
                            Esta acción solo borra la base de datos interna. No se eliminará ningún archivo de música físico. Los datos se regenerarán automáticamente al actualizar la biblioteca o reiniciar la aplicación.
                        </Text>
                    </View>
                </View>

                {/* --- SECCIÓN DE APP INFO --- */}
                <View style={styles.infoTextContainer}>
                    <Text style={styles.infoText}>MMPlayer v1.0.0</Text>
                    <Text style={styles.infoTextSub}>Potenciado por WatermelonDB & Expo</Text>
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
        fontFamily: 'Montserrat',
        color: '#9A9A9A',
        marginTop: 4,
    },
    divider: {
        width: 1,
        height: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
        marginBottom: 20,
    },
    actionLabel: {
        fontSize: 16,
        fontFamily: 'Montserrat',
        fontWeight: '600',
        color: '#FFFFFF',
    },
    actionSublabel: {
        fontSize: 12,
        fontFamily: 'Montserrat',
        color: '#9A9A9A',
        marginTop: 4,
        paddingRight: 20,
    },
    clearButton: {
        backgroundColor: '#ef4444',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        elevation: 4,
    },
    clearButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    infoTextContainer: {
        marginTop: 40,
        alignItems: 'center',
    },
    infoText: {
        color: '#535353',
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '600',
    },
    infoTextSub: {
        color: '#3a3a3a',
        fontSize: 12,
        fontFamily: 'Montserrat',
        marginTop: 4,
    },
    disclaimerContainer: {
        flexDirection: 'row',
        marginTop: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    disclaimerText: {
        flex: 1,
        color: '#9A9A9A',
        fontSize: 11,
        fontFamily: 'Montserrat',
        lineHeight: 16,
    },
    smokeEffect: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 160,
        zIndex: 1,
    }
});

const SettingsScreen = withObservables([], () => ({
    tracksCount: database.get('tracks').query().observeCount(),
    albumsCount: database.get('albums').query().observeCount(),
    artistsCount: database.get('artists').query().observeCount(),
}))(SettingsContent);

export default SettingsScreen;
