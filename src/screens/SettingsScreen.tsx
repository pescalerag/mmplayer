import withObservables from '@nozbe/with-observables';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { database } from '../database';
import { Layout } from '../theme/theme';

// Tipos para los observables
interface SettingsProps {
    readonly tracksCount: number;
    readonly albumsCount: number;
    readonly artistsCount: number;
}

function SettingsContent({ tracksCount, albumsCount, artistsCount }: SettingsProps) {
    const insets = useSafeAreaInsets();
    const [headerHeight, setHeaderHeight] = useState(100);


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

SettingsScreen.displayName = 'SettingsScreen';

export default SettingsScreen;
