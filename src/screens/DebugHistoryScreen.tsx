import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import withObservables from '@nozbe/with-observables';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { FlashList } from '@shopify/flash-list';
import {
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { database } from '../database';
import Album from '../database/models/Album';
import Artist from '../database/models/Artist';
import PlaybackHistory from '../database/models/PlaybackHistory';
import Track from '../database/models/Track';
import { Colors, Layout } from '../theme/theme';
import { useAppTheme } from "@/hooks/useAppTheme";

interface HistoryRowProps {
    historyItem: PlaybackHistory;
}

function HistoryRow({ historyItem }: HistoryRowProps) {
    const { colors, fonts, layout } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
    const [track, setTrack] = useState<Track | null>(null);
    const [album, setAlbum] = useState<Album | null>(null);
    const [artist, setArtist] = useState<Artist | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const loadMetadata = async () => {
            try {
                const trackDoc = await database.get<Track>('tracks').find(historyItem.itemId);
                const albumDoc = await trackDoc.album.fetch();
                const artistDoc = await trackDoc.artist.fetch();
                if (isMounted) {
                    setTrack(trackDoc);
                    setAlbum(albumDoc);
                    setArtist(artistDoc);
                }
            } catch {
                // El track podría haber sido eliminado de la base de datos
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        loadMetadata();
        return () => {
            isMounted = false;
        };
    }, [historyItem.itemId]);

    const formattedTime = new Date(historyItem.playedAt).toLocaleString();

    if (loading) {
        return (
            <View style={styles.row}>
                <View style={styles.rowInfo}>
                    <Text style={styles.title}>Cargando...</Text>
                    <Text style={styles.subtitle}>ID: {historyItem.itemId}</Text>
                </View>
            </View>
        );
    }

    if (!track) {
        return (
            <View style={styles.row}>
                <View style={styles.rowInfo}>
                    <Text style={[styles.title, { color: '#E53E3E' }]}>Track no encontrado (Borrado)</Text>
                    <Text style={styles.subtitle}>ID: {historyItem.itemId}</Text>
                    <Text style={styles.metadataText}>
                        Contexto: {historyItem.playContext} · Escuchado: {historyItem.durationPlayed}s
                    </Text>
                    <Text style={styles.dateText}>{formattedTime}</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.row}>
            <View style={styles.rowInfo}>
                <Text style={styles.title} numberOfLines={1}>{track.title}</Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                    {artist?.name || 'Artista desconocido'} · {album?.title || 'Álbum desconocido'}
                </Text>
                <Text style={styles.metadataText}>
                    Contexto: {historyItem.playContext === 'manual' ? 'Manual (Clic)' : 'Automático (Cola)'} · Escuchado: {historyItem.durationPlayed}s
                </Text>
                <Text style={styles.dateText}>{formattedTime}</Text>
            </View>
            <View style={styles.badgeContainer}>
                <View style={[styles.badge, historyItem.playContext === 'manual' ? styles.badgeManual : styles.badgeQueue]}>
                    <Text style={styles.badgeText}>
                        {historyItem.playContext === 'manual' ? 'CLICK' : 'COLA'}
                    </Text>
                </View>
            </View>
        </View>
    );
}

interface DebugHistoryContentProps {
    history: PlaybackHistory[];
}

function DebugHistoryContent({ history }: DebugHistoryContentProps) {
    const { colors, fonts, layout } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();

    const handleClearHistory = () => {
        Alert.alert(
            "Limpiar Historial",
            "¿Estás seguro de que quieres borrar el historial de reproducción de la base de datos?",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Borrar todo",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await database.write(async () => {
                                const records = await database.collections
                                    .get<PlaybackHistory>('playback_history')
                                    .query()
                                    .fetch();
                                const batchOps = records.map(r => r.prepareDestroyPermanently());
                                await database.batch(batchOps);
                            });
                        } catch (error) {
                            console.error("Error al borrar historial:", error);
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>

            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Debug Historial</Text>
                {history.length > 0 && (
                    <TouchableOpacity onPress={handleClearHistory} style={styles.clearButton}>
                        <Ionicons name="trash-outline" size={22} color={colors.heartIcon} />
                    </TouchableOpacity>
                )}
            </View>

            {/* List */}
            <FlashList
                data={history}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <HistoryRow historyItem={item} />}
                contentContainerStyle={[
                    styles.listContent,
                    {
                        paddingBottom: Layout.MINI_PLAYER_HEIGHT + Layout.TAB_BAR_HEIGHT + Layout.PLAYER_MARGIN + insets.bottom
                    }
                ]}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="time-outline" size={60} color="#555555" />
                        <Text style={styles.emptyText}>El historial de reproducción está vacío.</Text>
                        <Text style={styles.emptySubtitle}>Las canciones escuchadas por más de 10 segundos aparecerán aquí.</Text>
                    </View>
                }
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}

const ObservableDebugHistoryScreen = withObservables([], () => ({
    history: database.collections.get<PlaybackHistory>('playback_history')
        .query(Q.sortBy('played_at', Q.desc))
        .observe()
}))(DebugHistoryContent);

export default function DebugHistoryScreen() {
    return <ObservableDebugHistoryScreen />;
}

const getStyles = (colors: any, fonts: any, layout: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 15,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderBottomWidth: 1,
        borderBottomColor: colors.overlayAlpha05,
        zIndex: 10,
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        fontSize: 20,
        fontFamily: fonts.regular,
        fontWeight: '900',
        color: colors.text,
        flex: 1,
        marginLeft: 15,
    },
    clearButton: {
        padding: 5,
    },
    listContent: {
        padding: 16,
    },
    row: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.02)',
    },
    rowInfo: {
        flex: 1,
        paddingRight: 10,
    },
    title: {
        fontSize: 16,
        fontFamily: fonts.regular,
        fontWeight: '700',
        color: colors.text,
    },
    subtitle: {
        fontSize: 13,
        fontFamily: fonts.regular,
        fontWeight: '700',
        color: colors.textSecondary,
        marginTop: 2,
    },
    metadataText: {
        fontSize: 11,
        fontFamily: fonts.regular, fontWeight: '600',
        color: '#8A8A8A',
        marginTop: 6,
    },
    dateText: {
        fontSize: 11,
        fontFamily: fonts.regular, fontWeight: '600',
        color: colors.textSecondary,
        marginTop: 4,
    },
    badgeContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    badgeManual: {
        backgroundColor: colors.accentAlpha15,
    },
    badgeQueue: {
        backgroundColor: colors.overlayAlpha08,
    },
    badgeText: {
        fontSize: 10,
        fontFamily: fonts.regular,
        fontWeight: '800',
        color: colors.accent,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 80,
        paddingHorizontal: 40,
    },
    emptyText: {
        color: colors.text,
        fontSize: 16,
        fontFamily: fonts.regular,
        fontWeight: '700',
        textAlign: 'center',
        marginTop: 16,
    },
    emptySubtitle: {
        color: '#888888',
        fontSize: 13,
        fontFamily: fonts.regular,
        fontWeight: '700',
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 18,
    },
});
