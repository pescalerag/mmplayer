import { PlayingIndicator } from '@/components/common/PlayingIndicator';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Animated,
    BackHandler,
    Dimensions,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView, GestureDetector, Gesture, TouchableOpacity as GHTouchableOpacity } from 'react-native-gesture-handler';
import AnimatedReanimated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TrackPlayer, {
    Event,
    State,
    Track as TPTrack,
    usePlaybackState,
    useTrackPlayerEvents,
} from 'react-native-track-player';
import { database } from '../../database';
import Artist from '../../database/models/Artist';
import Track from '../../database/models/Track';
import { useAppTheme } from '../../hooks/useAppTheme';
import { usePlayerStore } from '../../store/usePlayerStore';
import { openPlaylistSelector, useUIStore } from '../../store/useUIStore';
import { Colors } from '../../theme/theme';

const { height, width } = Dimensions.get('window');
const TAB_WIDTH = (width - 48 - 110) / 2;
const ITEM_ROW_HEIGHT = 72; // Altura fija para optimizar getItemLayout

type ActiveTab = 'queue' | 'recent';

export default function QueueSheet() {
    const { colors } = useAppTheme();
    const { t } = useTranslation();
    const activeSheet = useUIStore(state => state.activeSheet);
    const closeQueue = useUIStore(state => state.closeSheet);
    const isVisible = activeSheet === 'queue';
    const insets = useSafeAreaInsets();
    const userQueueSize = usePlayerStore(state => state.userQueueSize);
    const decrementUserQueue = usePlayerStore(state => state.decrementUserQueue);
    const clearPlayer = usePlayerStore(state => state.clearPlayer);
    const clearUserQueue = usePlayerStore(state => state.clearUserQueue);
    const clearContextQueue = usePlayerStore(state => state.clearContextQueue);
    const queueVersion = usePlayerStore(state => state.queueVersion);

    const playbackState = usePlaybackState();
    const isPlayingGlobal = playbackState.state === State.Playing || playbackState.state === State.Buffering;

    const [queue, setQueue] = useState<TPTrack[]>([]);
    const [activeIndex, setActiveIndex] = useState<number>(0);
    const [activeTab, setActiveTab] = useState<ActiveTab>('queue');
    const [showTrashMenu, setShowTrashMenu] = useState(false);
    const [showAddPlaylistMenu, setShowAddPlaylistMenu] = useState(false);
    const [dbTracksMap, setDbTracksMap] = useState<Map<string, { title: string; artist: string; artwork: string | null }>>(new Map());
    const dbTracksMapRef = useRef(dbTracksMap);

    useEffect(() => {
        dbTracksMapRef.current = dbTracksMap;
    }, [dbTracksMap]);

    // Carga metadatos desde WatermelonDB en lotes (Chunking) para evitar saturar la BD
    const fetchDbMetadataForQueue = React.useCallback(async (tpQueue: TPTrack[]) => {
        try {
            const trackIds = Array.from(new Set(tpQueue.map(t => t.id.toString().split('-')[0])));
            if (trackIds.length === 0) return;

            const currentMap = dbTracksMapRef.current;
            const missingTrackIds = trackIds.filter(id => !currentMap.has(id));
            if (missingTrackIds.length === 0) return;

            const CHUNK_SIZE = 50;
            const fetchedMetadata = new Map<string, { title: string; artist: string; artwork: string | null }>();

            for (let i = 0; i < missingTrackIds.length; i += CHUNK_SIZE) {
                const chunk = missingTrackIds.slice(i, i + CHUNK_SIZE);
                const dbTracks = await database.collections.get<Track>('tracks')
                    .query(Q.where('id', Q.oneOf(chunk)))
                    .fetch();

                await Promise.all(dbTracks.map(async (track) => {
                    const album = await track.album.fetch();
                    const collaborators = await track.queryCollaborators.fetch() as Artist[];
                    const artistNames = collaborators.length > 0
                        ? collaborators.map(a => a.name).join(', ')
                        : 'Artista desconocido';

                    fetchedMetadata.set(track.id, {
                        title: track.title,
                        artist: artistNames,
                        artwork: album?.coverUrl || null
                    });
                }));
            }

            if (fetchedMetadata.size > 0) {
                setDbTracksMap(prevMap => {
                    const newMap = new Map(prevMap);
                    fetchedMetadata.forEach((value, key) => {
                        newMap.set(key, value);
                    });
                    return newMap;
                });
            }
        } catch (err) {
            console.error('QueueSheet: error cargando metadatos de DB para cola', err);
        }
    }, []);

    useEffect(() => {
        if (queue.length > 0) {
            fetchDbMetadataForQueue(queue);
        }
    }, [queue, fetchDbMetadataForQueue]);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const tabIndicatorAnim = useRef(new Animated.Value(0)).current;

    const slideTranslateY = useSharedValue(height);
    const dragTranslateY = useSharedValue(0);

    const performCloseQueue = React.useCallback(() => {
        closeQueue();
    }, [closeQueue]);

    const handlePanGesture = Gesture.Pan()
        .activeOffsetY(5)
        .onUpdate((event) => {
            if (event.translationY > 0) {
                dragTranslateY.value = event.translationY;
            } else {
                dragTranslateY.value = 0;
            }
        })
        .onEnd((event) => {
            const DISMISS_THRESHOLD = 90;
            if (event.translationY > DISMISS_THRESHOLD || event.velocityY > 500) {
                slideTranslateY.value = withTiming(height, { duration: 180 }, (finished) => {
                    if (finished) {
                        runOnJS(performCloseQueue)();
                    }
                });
            } else {
                dragTranslateY.value = withSpring(0, { damping: 25, stiffness: 150 });
            }
        });

    const sheetAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: slideTranslateY.value + dragTranslateY.value }],
    }));

    const isReordering = useRef(false);

    const recentTracks = queue.slice(0, activeIndex).reverse();
    // Muestra TODA la cola restante sin capas ni límites de 50
    const upcomingTracks = queue.slice(activeIndex + 1);
    const currentTrack = queue[activeIndex] ?? null;

    const totalUpcomingCount = Math.max(0, queue.length - (activeIndex + 1));

    useTrackPlayerEvents([Event.PlaybackActiveTrackChanged], async () => {
        if (isReordering.current) return;
        try {
            const idx = await TrackPlayer.getActiveTrackIndex();
            if (idx !== undefined && idx !== null) setActiveIndex(idx);
        } catch (e) {
            console.error('QueueSheet: error leyendo active index', e);
        }
    });

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
    }, [isVisible, queueVersion]);

    const [shouldRender, setShouldRender] = useState(false);
    useEffect(() => {
        if (isVisible) {
            setShouldRender(true);
            dragTranslateY.value = 0;
            slideTranslateY.value = withSpring(0, { damping: 22, stiffness: 220, mass: 0.8 });
            Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
        } else {
            setShowTrashMenu(false);
            setShowAddPlaylistMenu(false);
            Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
            slideTranslateY.value = withTiming(height, { duration: 220 }, (finished) => {
                if (finished) runOnJS(setShouldRender)(false);
            });
        }
    }, [isVisible, fadeAnim, slideTranslateY, dragTranslateY]);

    useEffect(() => {
        if (!isVisible) return;
        const onBackPress = () => {
            if (showTrashMenu) {
                setShowTrashMenu(false);
                return true;
            }
            if (showAddPlaylistMenu) {
                setShowAddPlaylistMenu(false);
                return true;
            }
            closeQueue();
            return true;
        };
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [isVisible, showTrashMenu, showAddPlaylistMenu, closeQueue]);

    const switchTab = (tab: ActiveTab) => {
        setActiveTab(tab);
        Animated.spring(tabIndicatorAnim, {
            toValue: tab === 'queue' ? 0 : TAB_WIDTH,
            tension: 60,
            friction: 10,
            useNativeDriver: true,
        }).start();
    };

    // Reordenamiento fluido mediante TrackPlayer.move nativo
    const handleDragEnd = React.useCallback(async ({ data, from, to }: { data: TPTrack[], from: number, to: number }) => {
        if (from === to) return;

        isReordering.current = true;

        const globalFrom = activeIndex + 1 + from;
        const globalTo = activeIndex + 1 + to;

        // Actualización optimista inmediata en la UI
        const newQueue = [
            ...queue.slice(0, activeIndex + 1),
            ...data
        ];
        setQueue(newQueue);

        try {
            // Movimiento atómico nativo súper rápido
            await TrackPlayer.move(globalFrom, globalTo);
            await usePlayerStore.getState().savePlaybackState();
        } catch (error) {
            console.error('Error reordering track:', error);
            const fullQueue = await TrackPlayer.getQueue();
            setQueue(fullQueue);
        } finally {
            setTimeout(() => {
                isReordering.current = false;
            }, 300);
        }
    }, [activeIndex, queue, setQueue]);

    const handleSkipTo = React.useCallback(async (globalIndex: number) => {
        try {
            await TrackPlayer.skip(globalIndex);
            await TrackPlayer.play();
            setActiveIndex(globalIndex);
        } catch (error) {
            console.error('Error skipping to track:', error);
        }
    }, [setActiveIndex]);

    const handleRemove = React.useCallback(async (globalIndex: number, isUserQueued: boolean) => {
        try {
            await TrackPlayer.remove(globalIndex);
            if (isUserQueued) decrementUserQueue();
            const [fullQueue, idx] = await Promise.all([
                TrackPlayer.getQueue(),
                TrackPlayer.getActiveTrackIndex(),
            ]);
            setQueue(fullQueue);
            if (idx !== undefined && idx !== null) setActiveIndex(idx);

            await usePlayerStore.getState().updateQueueStatus(idx ?? undefined);
            await usePlayerStore.getState().savePlaybackState();
        } catch (error) {
            console.error('Error removing track:', error);
        }
    }, [decrementUserQueue]);

    const handleTrashPress = () => {
        setShowTrashMenu(true);
    };

    const handleSaveTracksToPlaylist = async (selectedTpTracks: TPTrack[]) => {
        setShowAddPlaylistMenu(false);
        if (selectedTpTracks.length === 0) return;
        try {
            const trackIds = Array.from(new Set(selectedTpTracks.map(t => t.id.toString().split('-')[0])));
            if (trackIds.length === 0) return;

            const dbTracks = await database.collections.get<Track>('tracks')
                .query(Q.where('id', Q.oneOf(trackIds)))
                .fetch();

            if (dbTracks.length > 0) {
                const trackMap = new Map<string, Track>();
                dbTracks.forEach(t => trackMap.set(t.id, t));

                const orderedTracks: Track[] = [];
                trackIds.forEach(id => {
                    const track = trackMap.get(id);
                    if (track) orderedTracks.push(track);
                });

                openPlaylistSelector(orderedTracks);
                closeQueue();
            }
        } catch (error) {
            console.error('Error saving queue as playlist:', error);
        }
    };

    const listHeader = React.useMemo(() => {
        const dbId = currentTrack?.id?.toString().split('-')[0];
        const dbMeta = dbId ? dbTracksMap.get(dbId) : null;
        return (
            <CurrentTrackHeader
                currentTrack={currentTrack}
                dbMeta={dbMeta}
                isPlayingGlobal={isPlayingGlobal}
            />
        );
    }, [currentTrack, isPlayingGlobal, dbTracksMap]);

    const renderQueueItem = React.useCallback(({ item, getIndex, drag, isActive }: RenderItemParams<TPTrack>) => {
        const index = getIndex() || 0;
        const dbId = item.id.toString().split('-')[0];
        const dbMeta = dbTracksMap.get(dbId);
        return (
            <ScaleDecorator>
                <QueueTrackRow
                    item={item}
                    dbMeta={dbMeta}
                    index={index}
                    activeIndex={activeIndex}
                    userQueueSize={userQueueSize}
                    onSkip={handleSkipTo}
                    onRemove={handleRemove}
                    drag={drag}
                    isActive={isActive}
                />
            </ScaleDecorator>
        );
    }, [activeIndex, userQueueSize, handleSkipTo, handleRemove, dbTracksMap]);

    const renderRecentItem = React.useCallback(({ item, index }: { item: TPTrack; index: number }) => {
        const dbId = item.id.toString().split('-')[0];
        const dbMeta = dbTracksMap.get(dbId);
        return (
            <RecentTrackRow
                item={item}
                dbMeta={dbMeta}
                index={index}
                activeIndex={activeIndex}
                onSkip={handleSkipTo}
            />
        );
    }, [activeIndex, handleSkipTo, dbTracksMap]);

    if (!shouldRender && !isVisible) return null;

    return (
        <View
            style={[StyleSheet.absoluteFill, { zIndex: 9998 }]}
            pointerEvents={isVisible ? 'auto' : 'none'}
        >
            <TouchableWithoutFeedback onPress={closeQueue}>
                <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} />
            </TouchableWithoutFeedback>

            <AnimatedReanimated.View style={[
                styles.sheetContainer,
                {
                    height: height * 0.82,
                    paddingBottom: insets.bottom,
                },
                sheetAnimatedStyle
            ]}>
                <GestureDetector gesture={handlePanGesture}>
                    <View style={styles.handleContainer}>
                        <View style={styles.dragIndicator} />
                    </View>
                </GestureDetector>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, marginBottom: 16 }}>
                    <View style={[styles.tabBar, { flex: 1, marginHorizontal: 0, marginBottom: 0 }]}>
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
                                color={activeTab === 'queue' ? Colors.tint : Colors.disabled}
                                style={{ marginRight: 6 }}
                            />
                            <Text style={[styles.tabLabel, activeTab === 'queue' && styles.tabLabelActive]}>
                                {t('queue.title')}
                            </Text>
                            {totalUpcomingCount > 0 && (
                                <View style={[styles.badge, activeTab === 'queue' && styles.badgeActive]}>
                                    <Text style={styles.badgeText}>{totalUpcomingCount}</Text>
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
                                color={activeTab === 'recent' ? Colors.tint : Colors.disabled}
                                style={{ marginRight: 6 }}
                            />
                            <Text style={[styles.tabLabel, activeTab === 'recent' && styles.tabLabelActive]}>
                                {t('queue.history_tab')}
                            </Text>
                            {recentTracks.length > 0 && (
                                <View style={[styles.badge, activeTab === 'recent' && styles.badgeActive]}>
                                    <Text style={styles.badgeText}>{recentTracks.length}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                    {queue.length > 0 && (
                        <TouchableOpacity
                            style={{ padding: 10, marginLeft: 4 }}
                            onPress={() => setShowAddPlaylistMenu(true)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="add-outline" size={26} color={Colors.tint} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={{ padding: 10, marginLeft: 4 }}
                        onPress={handleTrashPress}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="trash-outline" size={24} color={Colors.heartIcon} />
                    </TouchableOpacity>
                </View>

                {activeTab === 'queue' ? (
                    <GestureHandlerRootView style={{ flex: 1 }}>
                        {listHeader}
                        <View style={styles.separator} />
                        <DraggableFlatList
                            data={upcomingTracks}
                            keyExtractor={(item) => item.id}
                            renderItem={renderQueueItem}
                            onDragEnd={handleDragEnd}
                            activationDistance={10} // Previene inicio accidental de drag al hacer scroll
                            autoscrollThreshold={50}
                            autoscrollSpeed={100}
                            getItemLayout={(_data, index) => ({
                                length: ITEM_ROW_HEIGHT,
                                offset: ITEM_ROW_HEIGHT * index,
                                index,
                            })}
                            removeClippedSubviews={Platform.OS === 'android'}
                            initialNumToRender={15}
                            maxToRenderPerBatch={15}
                            windowSize={10}
                            ListEmptyComponent={
                                <View style={styles.emptyState}>
                                    <Ionicons name="musical-notes-outline" size={40} color={Colors.disabled} />
                                    <Text style={styles.emptyText}>{t('queue.empty')}</Text>
                                </View>
                            }
                            contentContainerStyle={styles.listContent}
                            showsVerticalScrollIndicator={false}
                        />
                    </GestureHandlerRootView>
                ) : (
                    <FlashList
                        data={recentTracks}
                        keyExtractor={(item) => item.id}
                        renderItem={renderRecentItem}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Ionicons name="time-outline" size={40} color={Colors.disabled} />
                                <Text style={styles.emptyText}>{t('queue.history_empty')}</Text>
                            </View>
                        }
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </AnimatedReanimated.View>

            {showTrashMenu && (() => {
                const upcomingList = queue.slice(activeIndex + 1);
                const hasManualUpcoming = upcomingList.some(t => (t as any).isManual === true);
                const hasContextUpcoming = upcomingList.some(t => !(t as any).isManual);

                return (
                    <TouchableWithoutFeedback onPress={() => setShowTrashMenu(false)}>
                        <View style={styles.trashMenuOverlay}>
                            <TouchableWithoutFeedback>
                                <View style={[styles.trashMenuPanel, { backgroundColor: '#121212', borderTopWidth: 1, borderColor: colors.cardBackground || '#282828', paddingBottom: insets.bottom + 12 }]}>
                                    <Text style={[styles.trashMenuTitle, { color: colors.textSecondary }]}>{t('queue.manage')}</Text>
                                    {hasManualUpcoming && (
                                        <TouchableOpacity
                                            style={styles.trashMenuButton}
                                            onPress={async () => {
                                                setShowTrashMenu(false);
                                                await clearUserQueue();
                                                const [fullQueue, idx] = await Promise.all([
                                                    TrackPlayer.getQueue(),
                                                    TrackPlayer.getActiveTrackIndex(),
                                                ]);
                                                setQueue(fullQueue);
                                                if (idx !== undefined && idx !== null) setActiveIndex(idx);
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.trashMenuIconContainer}>
                                                <Ionicons name="list-outline" size={24} color={colors.text} />
                                            </View>
                                            <Text style={[styles.trashMenuButtonText, { color: colors.text }]}>{t('queue.clear_manual')}</Text>
                                        </TouchableOpacity>
                                    )}
                                    {hasContextUpcoming && (
                                        <TouchableOpacity
                                            style={styles.trashMenuButton}
                                            onPress={async () => {
                                                setShowTrashMenu(false);
                                                await clearContextQueue();
                                                const [fullQueue, idx] = await Promise.all([
                                                    TrackPlayer.getQueue(),
                                                    TrackPlayer.getActiveTrackIndex(),
                                                ]);
                                                setQueue(fullQueue);
                                                if (idx !== undefined && idx !== null) setActiveIndex(idx);
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.trashMenuIconContainer}>
                                                <Ionicons name="albums-outline" size={24} color={colors.text} />
                                            </View>
                                            <Text style={[styles.trashMenuButtonText, { color: colors.text }]}>{t('queue.clear_context')}</Text>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity
                                        style={styles.trashMenuButton}
                                        onPress={async () => {
                                            setShowTrashMenu(false);
                                            await clearPlayer();
                                            closeQueue();
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.trashMenuIconContainer}>
                                            <Ionicons name="stop-circle-outline" size={24} color={colors.text} />
                                        </View>
                                        <Text style={[styles.trashMenuButtonText, { color: colors.text }]}>{t('queue.stop_playback')}</Text>
                                    </TouchableOpacity>
                                    <View style={[styles.trashMenuDivider, { backgroundColor: colors.cardBackground || '#282828' }]} />
                                    <TouchableOpacity
                                        style={[styles.trashMenuButton, { justifyContent: 'center' }]}
                                        onPress={() => setShowTrashMenu(false)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[styles.trashMenuButtonText, { color: colors.textSecondary }]}>{t('actions.cancel')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </TouchableWithoutFeedback>
                        </View>
                    </TouchableWithoutFeedback>
                );
            })()}

            {showAddPlaylistMenu && (() => {
                const allQueueTracks = queue;
                const upcomingAndCurrentTracks = queue.slice(Math.max(0, activeIndex));
                const manualQueueTracks = queue.filter((t, idx) => (t as any).isManual === true || (idx > activeIndex && idx <= activeIndex + userQueueSize));

                const hasManualTracks = manualQueueTracks.length > 0;
                const hasUpcomingTracks = upcomingAndCurrentTracks.length > 0;

                return (
                    <TouchableWithoutFeedback onPress={() => setShowAddPlaylistMenu(false)}>
                        <View style={styles.trashMenuOverlay}>
                            <TouchableWithoutFeedback>
                                <View style={[styles.trashMenuPanel, { backgroundColor: '#121212', borderTopWidth: 1, borderColor: colors.cardBackground || '#282828', paddingBottom: insets.bottom + 12 }]}>
                                    <Text style={[styles.trashMenuTitle, { color: colors.textSecondary }]}>{t('queue.save_to_playlist_title')}</Text>

                                    <TouchableOpacity
                                        style={styles.trashMenuButton}
                                        onPress={() => handleSaveTracksToPlaylist(allQueueTracks)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.trashMenuIconContainer}>
                                            <Ionicons name="library-outline" size={24} color={colors.text} />
                                        </View>
                                        <Text style={[styles.trashMenuButtonText, { color: colors.text }]}>{t('queue.save_all_to_playlist')}</Text>
                                    </TouchableOpacity>

                                    {hasUpcomingTracks && (
                                        <TouchableOpacity
                                            style={styles.trashMenuButton}
                                            onPress={() => handleSaveTracksToPlaylist(upcomingAndCurrentTracks)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.trashMenuIconContainer}>
                                                <Ionicons name="play-skip-forward-outline" size={24} color={colors.text} />
                                            </View>
                                            <Text style={[styles.trashMenuButtonText, { color: colors.text }]}>{t('queue.save_upcoming_to_playlist')}</Text>
                                        </TouchableOpacity>
                                    )}

                                    {hasManualTracks && (
                                        <TouchableOpacity
                                            style={styles.trashMenuButton}
                                            onPress={() => handleSaveTracksToPlaylist(manualQueueTracks)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.trashMenuIconContainer}>
                                                <Ionicons name="bookmark-outline" size={24} color={colors.text} />
                                            </View>
                                            <Text style={[styles.trashMenuButtonText, { color: colors.text }]}>{t('queue.save_manual_to_playlist')}</Text>
                                        </TouchableOpacity>
                                    )}

                                    <View style={[styles.trashMenuDivider, { backgroundColor: colors.cardBackground || '#282828' }]} />
                                    <TouchableOpacity
                                        style={[styles.trashMenuButton, { justifyContent: 'center' }]}
                                        onPress={() => setShowAddPlaylistMenu(false)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[styles.trashMenuButtonText, { color: colors.textSecondary }]}>{t('actions.cancel')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </TouchableWithoutFeedback>
                        </View>
                    </TouchableWithoutFeedback>
                );
            })()}
        </View>
    );
}

interface CurrentTrackHeaderProps {
    currentTrack: TPTrack | null;
    dbMeta?: { title: string; artist: string; artwork: string | null } | null;
    isPlayingGlobal: boolean;
}

const CurrentTrackHeader = React.memo(({ currentTrack, dbMeta, isPlayingGlobal }: CurrentTrackHeaderProps) => {
    const artworkUrl = dbMeta ? dbMeta.artwork : currentTrack?.artwork;
    const imageSource = React.useMemo(() =>
        artworkUrl ? { uri: artworkUrl } : null
        , [artworkUrl]);

    if (!currentTrack) return null;

    const title = dbMeta?.title ?? currentTrack.title;
    const artist = dbMeta?.artist ?? currentTrack.artist;

    return (
        <View style={styles.currentTrackRow}>
            {imageSource ? (
                <Image
                    source={imageSource}
                    style={styles.thumbnail}
                    contentFit="cover"
                    transition={200}
                />
            ) : (
                <View style={[styles.thumbnail, styles.placeholder]}>
                    <Ionicons name="musical-notes" size={20} color={Colors.disabled} />
                </View>
            )}
            <View style={styles.trackInfo}>
                <View style={styles.titleContainer}>
                    <Text style={[styles.title, styles.textActive]} numberOfLines={1}>
                        {title}
                    </Text>
                    <PlayingIndicator isPaused={!isPlayingGlobal} />
                </View>
                <Text style={styles.subtitle} numberOfLines={1}>
                    {artist || 'Desconocido'}
                </Text>
            </View>
        </View>
    );
});
CurrentTrackHeader.displayName = 'CurrentTrackHeader';

interface QueueTrackRowProps {
    item: any;
    dbMeta?: { title: string; artist: string; artwork: string | null } | null;
    index: number;
    activeIndex: number;
    userQueueSize: number;
    onSkip: (globalIndex: number) => void;
    onRemove: (globalIndex: number, isUserQueued: boolean) => void;
    drag?: () => void;
    isActive?: boolean;
}

const QueueTrackRow = React.memo(({ item, dbMeta, index, activeIndex, userQueueSize, onSkip, onRemove, drag, isActive }: QueueTrackRowProps) => {
    const globalIndex = activeIndex + 1 + index;
    const isUserQueued = index < userQueueSize;
    const isManual = item.isManual === true || isUserQueued;
    const artworkUrl = dbMeta ? dbMeta.artwork : item.artwork;
    const imageSource = React.useMemo(() =>
        artworkUrl ? { uri: artworkUrl } : null
        , [artworkUrl]);

    const title = dbMeta?.title ?? item.title;
    const artist = dbMeta?.artist ?? item.artist;

    return (
        <View style={[styles.trackRow, isActive && styles.trackRowActive]}>
            <GHTouchableOpacity
                onLongPress={drag}
                delayLongPress={100}
                style={styles.dragHandle}
                hitSlop={{ top: 15, bottom: 15, left: 10, right: 10 }}
                activeOpacity={0.6}
            >
                <Ionicons name="reorder-two" size={24} color={isActive ? Colors.accent : Colors.disabled} />
            </GHTouchableOpacity>

            <TouchableOpacity
                style={styles.trackMainContent}
                onPress={() => onSkip(globalIndex)}
                activeOpacity={0.7}
                disabled={isActive}
            >
                {imageSource ? (
                    <Image
                        source={imageSource}
                        style={styles.thumbnail}
                        contentFit="cover"
                        transition={200}
                    />
                ) : (
                    <View style={[styles.thumbnail, styles.placeholder]}>
                        <Ionicons name="musical-notes" size={20} color={Colors.disabled} />
                    </View>
                )}
                <View style={styles.trackInfo}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title} numberOfLines={1}>{title}</Text>
                        {isManual && (
                            <View style={styles.userQueueBadge}>
                                <Ionicons name="menu" size={12} color={Colors.accentLight} />
                            </View>
                        )}
                    </View>
                    <Text style={styles.subtitle} numberOfLines={1}>{artist || 'Desconocido'}</Text>
                </View>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.removeButton}
                onPress={() => onRemove(globalIndex, isUserQueued)}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                disabled={isActive}
            >
                <Ionicons name="close-outline" size={24} color={Colors.disabled} />
            </TouchableOpacity>
        </View>
    );
});
QueueTrackRow.displayName = 'QueueTrackRow';

interface RecentTrackRowProps {
    item: TPTrack;
    dbMeta?: { title: string; artist: string; artwork: string | null } | null;
    index: number;
    activeIndex: number;
    onSkip: (globalIndex: number) => void;
}

const RecentTrackRow = React.memo(({ item, dbMeta, index, activeIndex, onSkip }: RecentTrackRowProps) => {
    const globalIndex = activeIndex - 1 - index;
    const artworkUrl = dbMeta ? dbMeta.artwork : item.artwork;
    const imageSource = React.useMemo(() =>
        artworkUrl ? { uri: artworkUrl } : null
        , [artworkUrl]);

    const title = dbMeta?.title ?? item.title;
    const artist = dbMeta?.artist ?? item.artist;

    return (
        <GHTouchableOpacity
            style={styles.trackRow}
            onPress={() => onSkip(globalIndex)}
            activeOpacity={0.7}
        >
            {imageSource ? (
                <Image
                    source={imageSource}
                    style={[styles.thumbnail, { opacity: 0.55 }]}
                    contentFit="cover"
                    transition={200}
                />
            ) : (
                <View style={[styles.thumbnail, styles.placeholder, { opacity: 0.55 }]}>
                    <Ionicons name="musical-notes" size={20} color={Colors.disabled} />
                </View>
            )}
            <View style={styles.trackInfo}>
                <Text style={[styles.title, styles.textDimmed]} numberOfLines={1}>{title}</Text>
                <Text style={[styles.subtitle, styles.subtitleDimmed]} numberOfLines={1}>
                    {artist || 'Desconocido'}
                </Text>
            </View>
            <Ionicons name="play-back-outline" size={18} color={Colors.disabled} />
        </GHTouchableOpacity>
    );
});
RecentTrackRow.displayName = 'RecentTrackRow';

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    sheetContainer: {
        backgroundColor: Colors.background,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        position: 'absolute',
        bottom: 0,
        width: '100%',
        borderTopWidth: 1,
        borderColor: Colors.cardBackground,
        overflow: 'hidden',
    },
    handleContainer: {
        width: '100%',
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 0,
        marginBottom: 4,
    },
    dragIndicator: {
        width: 40,
        height: 4,
        backgroundColor: Colors.disabled,
        borderRadius: 2,
        alignSelf: 'center',
    },
    tabBar: {
        flexDirection: 'row',
        marginHorizontal: 24,
        backgroundColor: Colors.cardBackground,
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
        backgroundColor: Colors.disabled,
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
        color: Colors.disabled,
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    tabLabelActive: {
        color: Colors.tint,
    },
    badge: {
        backgroundColor: Colors.disabled,
        borderRadius: 8,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginLeft: 6,
    },
    badgeActive: {
        backgroundColor: Colors.disabled,
    },
    badgeText: {
        color: Colors.textSecondary,
        fontSize: 11,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    currentTrackRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        backgroundColor: Colors.accentAlpha8,
    },
    separator: {
        height: 1,
        backgroundColor: Colors.overlayAlpha10,
        marginHorizontal: 20,
        marginTop: 12,
        marginBottom: 8,
    },
    trackRow: {
        height: ITEM_ROW_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        overflow: 'hidden',
    },
    trackRowActive: {
        backgroundColor: Colors.accentAlpha10,
        borderRadius: 12,
    },
    dragHandle: {
        height: '100%',
        paddingRight: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    trackMainContent: {
        flex: 1,
        height: '100%',
        flexDirection: 'row',
        alignItems: 'center',
    },
    thumbnail: {
        width: 48,
        height: 48,
        borderRadius: 8,
        marginRight: 16,
    },
    placeholder: {
        backgroundColor: Colors.cardBackground,
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
        backgroundColor: Colors.accentLightAlpha12,
        borderWidth: 1,
        borderColor: Colors.accentLightAlpha30,
        borderRadius: 5,
        padding: 3,
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        color: Colors.text,
        fontSize: 15,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        flexShrink: 1,
    },
    textActive: {
        color: Colors.accentLight,
    },
    textDimmed: {
        color: Colors.disabled,
    },
    subtitle: {
        color: Colors.textSecondary,
        fontSize: 13,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        marginTop: 3,
    },
    subtitleDimmed: {
        color: Colors.disabled,
    },
    removeButton: {
        padding: 8,
    },
    listContent: {
        paddingBottom: 120,
    },
    emptyState: {
        alignItems: 'center',
        paddingTop: 60,
        gap: 12,
    },
    emptyText: {
        color: Colors.disabled,
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    trashMenuOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    trashMenuPanel: {
        backgroundColor: Colors.cardBackground,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingTop: 14,
        paddingHorizontal: 24,
    },
    trashMenuTitle: {
        color: Colors.textSecondary,
        fontSize: 12,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
        textAlign: 'center',
        paddingVertical: 12,
    },
    trashMenuButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
    },
    trashMenuIconContainer: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    trashMenuButtonText: {
        color: Colors.text,
        fontSize: 16,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    trashMenuDivider: {
        height: 1,
        backgroundColor: Colors.overlayAlpha10,
        marginVertical: 8,
    },
});