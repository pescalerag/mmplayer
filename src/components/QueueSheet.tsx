import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    BackHandler,
    Dimensions,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TrackPlayer, {
    Event,
    State,
    Track as TPTrack,
    useActiveTrack,
    usePlaybackState,
    useTrackPlayerEvents,
} from 'react-native-track-player';
import { useQueueSheetStore } from '../store/useQueueSheetStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { PlayingIndicator } from './PlayingIndicator';

const { height, width } = Dimensions.get('window');
const TAB_WIDTH = (width - 48) / 2; // dos tabs con padding de 24 a cada lado

type ActiveTab = 'queue' | 'recent';

export default function QueueSheet() {
    const { isVisible, closeQueue } = useQueueSheetStore();
    const insets = useSafeAreaInsets();
    const userQueueSize = usePlayerStore(state => state.userQueueSize);
    const decrementUserQueue = usePlayerStore(state => state.decrementUserQueue);

    // ── Hooks reactivos de RNTP ──
    const currentTrackRNTP = useActiveTrack();
    const playbackState = usePlaybackState();
    const isPlayingGlobal = playbackState.state === State.Playing || playbackState.state === State.Buffering;

    const [queue, setQueue] = useState<TPTrack[]>([]);
    const [activeIndex, setActiveIndex] = useState<number>(0);
    const [activeTab, setActiveTab] = useState<ActiveTab>('queue');

    const slideAnim = useRef(new Animated.Value(height)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const tabIndicatorAnim = useRef(new Animated.Value(0)).current;

    // Secciones derivadas del índice activo
    const recentTracks = queue.slice(0, activeIndex).reverse();
    const upcomingTracks = queue.slice(activeIndex + 1);
    const currentTrack = queue[activeIndex] ?? null;

    // ── Recarga la cola cuando cambia el track activo ──
    useTrackPlayerEvents([Event.PlaybackActiveTrackChanged], async (event) => {
        const idx = event.index;
        const fullQueue = await TrackPlayer.getQueue();
        setQueue(fullQueue);
        if (idx !== undefined && idx !== null) setActiveIndex(idx);
    });

    // ── Carga inicial al abrir el sheet ──
    useEffect(() => {
        if (isVisible) {
            (async () => {
                try {
                    const [fullQueue, idx] = await Promise.all([
                        TrackPlayer.getQueue(),
                        TrackPlayer.getActiveTrackIndex(),
                    ]);
                    setQueue(fullQueue);
                    if (idx !== undefined && idx !== null) setActiveIndex(idx);
                } catch (e) {
                    console.error('QueueSheet: error cargando cola', e);
                }
            })();
        }
    }, [isVisible]);

    // --- ANIMACIONES DE SHEET ---
    useEffect(() => {
        if (isVisible) {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
                Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true })
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: height, duration: 250, useNativeDriver: true })
            ]).start();
        }
    }, [isVisible]);

    // --- BACKHANDLER ---
    useEffect(() => {
        if (!isVisible) return;
        const onBackPress = () => { closeQueue(); return true; };
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [isVisible, closeQueue]);

    // --- ANIMACIÓN DEL INDICADOR DE TAB ---
    const switchTab = (tab: ActiveTab) => {
        setActiveTab(tab);
        Animated.spring(tabIndicatorAnim, {
            toValue: tab === 'queue' ? 0 : TAB_WIDTH,
            tension: 60,
            friction: 10,
            useNativeDriver: true,
        }).start();
    };

    const handleSkipTo = async (globalIndex: number) => {
        try {
            await TrackPlayer.skip(globalIndex);
            await TrackPlayer.play();
            setActiveIndex(globalIndex);
        } catch (error) {
            console.error('Error skipping to track:', error);
        }
    };

    const handleRemove = async (globalIndex: number, isUserQueued: boolean) => {
        try {
            await TrackPlayer.remove(globalIndex);
            // Si era un track de la user queue, decrementamos el contador
            if (isUserQueued) decrementUserQueue();
            const [fullQueue, idx] = await Promise.all([
                TrackPlayer.getQueue(),
                TrackPlayer.getActiveTrackIndex(),
            ]);
            setQueue(fullQueue);
            if (idx !== undefined && idx !== null) setActiveIndex(idx);
        } catch (error) {
            console.error('Error removing track:', error);
        }
    };

    // --- RENDER: CANCIÓN ACTUAL (siempre visible en la tab Queue) ---
    const renderCurrentTrack = () => {
        if (!currentTrack) return null;
        return (
            <View style={styles.currentTrackRow}>
                {currentTrack.artwork ? (
                    <Image
                        source={{ uri: currentTrack.artwork }}
                        style={styles.thumbnail}
                        contentFit="cover"
                        transition={200}
                    />
                ) : (
                    <View style={[styles.thumbnail, styles.placeholder]}>
                        <Ionicons name="musical-notes" size={20} color="#666" />
                    </View>
                )}
                <View style={styles.trackInfo}>
                    <View style={styles.titleContainer}>
                        <Text style={[styles.title, styles.textActive]} numberOfLines={1}>
                            {currentTrack.title}
                        </Text>
                        <PlayingIndicator isPaused={!isPlayingGlobal} />
                    </View>
                    <Text style={styles.subtitle} numberOfLines={1}>
                        {currentTrack.artist || 'Desconocido'}
                    </Text>
                </View>
            </View>
        );
    };

    // --- RENDER: FILA DE COLA (próximas) ---
    const renderQueueItem = ({ item, index }: { item: TPTrack; index: number }) => {
        const globalIndex = activeIndex + 1 + index;
        const isUserQueued = index < userQueueSize;
        return (
            <TouchableOpacity
                style={styles.trackRow}
                onPress={() => handleSkipTo(globalIndex)}
            >
                {item.artwork ? (
                    <Image
                        source={{ uri: item.artwork }}
                        style={styles.thumbnail}
                        contentFit="cover"
                        transition={200}
                    />
                ) : (
                    <View style={[styles.thumbnail, styles.placeholder]}>
                        <Ionicons name="musical-notes" size={20} color="#666" />
                    </View>
                )}
                <View style={styles.trackInfo}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                        {isUserQueued && (
                            <View style={styles.userQueueBadge}>
                                <Ionicons name="menu" size={12} color="#A78BFA" />
                            </View>
                        )}
                    </View>
                    <Text style={styles.subtitle} numberOfLines={1}>{item.artist || 'Desconocido'}</Text>
                </View>
                <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemove(globalIndex, isUserQueued)}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                >
                    <Ionicons name="close-outline" size={24} color="#555" />
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    // --- RENDER: FILA DE HISTORIAL ---
    const renderRecentItem = ({ item, index }: { item: TPTrack; index: number }) => {
        const globalIndex = activeIndex - 1 - index;
        return (
            <TouchableOpacity
                style={styles.trackRow}
                onPress={() => handleSkipTo(globalIndex)}
                activeOpacity={0.7}
            >
                {item.artwork ? (
                    <Image
                        source={{ uri: item.artwork }}
                        style={[styles.thumbnail, { opacity: 0.55 }]}
                        contentFit="cover"
                        transition={200}
                    />
                ) : (
                    <View style={[styles.thumbnail, styles.placeholder, { opacity: 0.55 }]}>
                        <Ionicons name="musical-notes" size={20} color="#555" />
                    </View>
                )}
                <View style={styles.trackInfo}>
                    <Text style={[styles.title, styles.textDimmed]} numberOfLines={1}>{item.title}</Text>
                    <Text style={[styles.subtitle, styles.subtitleDimmed]} numberOfLines={1}>
                        {item.artist || 'Desconocido'}
                    </Text>
                </View>
                <Ionicons name="play-back-outline" size={18} color="#3A3A3A" />
            </TouchableOpacity>
        );
    };

    // Render/unmount controlado
    const [shouldRender, setShouldRender] = useState(isVisible);
    useEffect(() => {
        if (isVisible) {
            setShouldRender(true);
        } else {
            const timer = setTimeout(() => setShouldRender(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isVisible]);

    if (!shouldRender && !isVisible) return null;

    return (
        <View
            style={[StyleSheet.absoluteFill, { zIndex: 9998 }]}
            pointerEvents={isVisible ? 'auto' : 'none'}
        >
            <TouchableWithoutFeedback onPress={closeQueue}>
                <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} />
            </TouchableWithoutFeedback>

            <Animated.View style={[
                styles.sheetContainer,
                {
                    height: height * 0.82,
                    paddingBottom: insets.bottom,
                    transform: [{ translateY: slideAnim }]
                }
            ]}>
                <View style={styles.dragIndicator} />

                {/* ── TAB BAR ── */}
                <View style={styles.tabBar}>
                    {/* Indicador deslizante */}
                    <Animated.View
                        style={[
                            styles.tabIndicator,
                            { transform: [{ translateX: tabIndicatorAnim }], width: TAB_WIDTH }
                        ]}
                    />

                    <TouchableOpacity
                        style={[styles.tabButton, { width: TAB_WIDTH }]}
                        onPress={() => switchTab('queue')}
                        activeOpacity={0.8}
                    >
                        <Ionicons
                            name="list"
                            size={15}
                            color={activeTab === 'queue' ? '#FFFFFF' : '#555'}
                            style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.tabLabel, activeTab === 'queue' && styles.tabLabelActive]}>
                            Cola
                        </Text>
                        {upcomingTracks.length > 0 && (
                            <View style={[styles.badge, activeTab === 'queue' && styles.badgeActive]}>
                                <Text style={styles.badgeText}>{upcomingTracks.length}</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tabButton, { width: TAB_WIDTH }]}
                        onPress={() => switchTab('recent')}
                        activeOpacity={0.8}
                    >
                        <Ionicons
                            name="time-outline"
                            size={15}
                            color={activeTab === 'recent' ? '#FFFFFF' : '#555'}
                            style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.tabLabel, activeTab === 'recent' && styles.tabLabelActive]}>
                            Anterior
                        </Text>
                        {recentTracks.length > 0 && (
                            <View style={[styles.badge, activeTab === 'recent' && styles.badgeActive]}>
                                <Text style={styles.badgeText}>{recentTracks.length}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* ── CONTENIDO DE TABS ── */}
                {activeTab === 'queue' ? (
                    <FlatList
                        data={upcomingTracks}
                        keyExtractor={(item, index) => `q-${item.id}-${index}`}
                        renderItem={renderQueueItem}
                        ListHeaderComponent={renderCurrentTrack}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Ionicons name="musical-notes-outline" size={40} color="#252525" />
                                <Text style={styles.emptyText}>No hay canciones en la cola</Text>
                            </View>
                        }
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        initialNumToRender={10}
                        maxToRenderPerBatch={10}
                        windowSize={5}
                    />
                ) : (
                    <FlatList
                        data={recentTracks}
                        keyExtractor={(item, index) => `r-${item.id}-${index}`}
                        renderItem={renderRecentItem}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Ionicons name="time-outline" size={40} color="#252525" />
                                <Text style={styles.emptyText}>Aún no hay historial</Text>
                            </View>
                        }
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        initialNumToRender={10}
                        maxToRenderPerBatch={10}
                        windowSize={5}
                    />
                )}
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    sheetContainer: {
        backgroundColor: '#0E0E0E',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        position: 'absolute',
        bottom: 0,
        width: '100%',
        borderTopWidth: 1,
        borderColor: '#1E1E1E',
        overflow: 'hidden',
    },
    dragIndicator: {
        width: 40,
        height: 4,
        backgroundColor: '#2E2E2E',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 14,
        marginBottom: 16,
    },

    // ── Tab bar ──
    tabBar: {
        flexDirection: 'row',
        marginHorizontal: 24,
        backgroundColor: '#181818',
        borderRadius: 14,
        padding: 4,
        marginBottom: 16,
        position: 'relative',
        overflow: 'hidden',
    },
    tabIndicator: {
        position: 'absolute',
        top: 4,
        left: 4,
        bottom: 4,
        backgroundColor: '#2A2A2A',
        borderRadius: 10,
    },
    tabButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        zIndex: 1,
    },
    tabLabel: {
        color: '#555',
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    tabLabelActive: {
        color: '#FFFFFF',
    },
    badge: {
        backgroundColor: '#2E2E2E',
        borderRadius: 8,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginLeft: 6,
    },
    badgeActive: {
        backgroundColor: '#3E3E3E',
    },
    badgeText: {
        color: '#888',
        fontSize: 11,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },

    // ── Fila canción actual ──
    currentTrackRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        backgroundColor: 'rgba(139, 92, 246, 0.08)',
        borderBottomWidth: 1,
        borderBottomColor: '#1A1A1A',
        marginBottom: 4,
    },
    nowPlayingBadge: {
        backgroundColor: 'rgba(139, 92, 246, 0.25)',
        borderRadius: 6,
        paddingHorizontal: 7,
        paddingVertical: 3,
    },
    nowPlayingText: {
        color: '#A78BFA',
        fontSize: 10,
        fontFamily: 'Montserrat',
        fontWeight: '800',
        letterSpacing: 0.8,
    },

    // ── Filas de track ──
    trackRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
    },
    thumbnail: {
        width: 48,
        height: 48,
        borderRadius: 8,
        marginRight: 16,
    },
    placeholder: {
        backgroundColor: '#1E1E1E',
        justifyContent: 'center',
        alignItems: 'center',
    },
    trackInfo: {
        flex: 1,
        marginRight: 10,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    userQueueBadge: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(167, 139, 250, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(167, 139, 250, 0.3)',
        borderRadius: 5,
        padding: 3,
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 15,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        flexShrink: 1,
    },
    textActive: {
        color: '#A78BFA',
    },
    textDimmed: {
        color: '#444',
    },
    subtitle: {
        color: '#6B7280',
        fontSize: 13,
        fontFamily: 'Montserrat',
        fontWeight: '500',
        marginTop: 3,
    },
    subtitleDimmed: {
        color: '#2E2E2E',
    },
    removeButton: {
        padding: 8,
    },
    listContent: {
        paddingBottom: 40,
    },

    // ── Estado vacío ──
    emptyState: {
        alignItems: 'center',
        paddingTop: 60,
        gap: 12,
    },
    emptyText: {
        color: '#333',
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '600',
    },
});
