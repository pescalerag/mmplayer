import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    BackHandler,
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TrackPlayer, {
    Event,
    State,
    Track as TPTrack,
    usePlaybackState,
    useTrackPlayerEvents,
} from 'react-native-track-player';
import { usePlayerStore } from '../store/usePlayerStore';
import { useQueueSheetStore } from '../store/useQueueSheetStore';
import { Colors } from '../theme/theme';
import { PlayingIndicator } from './PlayingIndicator';

const { height, width } = Dimensions.get('window');
const TAB_WIDTH = (width - 48 - 44) / 2;

type ActiveTab = 'queue' | 'recent';

export default function QueueSheet() {
    const { isVisible, closeQueue } = useQueueSheetStore();
    const insets = useSafeAreaInsets();
    const userQueueSize = usePlayerStore(state => state.userQueueSize);
    const decrementUserQueue = usePlayerStore(state => state.decrementUserQueue);
    const clearPlayer = usePlayerStore(state => state.clearPlayer);
    const clearUserQueue = usePlayerStore(state => state.clearUserQueue);

    const playbackState = usePlaybackState();
    const isPlayingGlobal = playbackState.state === State.Playing || playbackState.state === State.Buffering;

    const [queue, setQueue] = useState<TPTrack[]>([]);
    const [activeIndex, setActiveIndex] = useState<number>(0);
    const [activeTab, setActiveTab] = useState<ActiveTab>('queue');

    const slideAnim = useRef(new Animated.Value(height)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const tabIndicatorAnim = useRef(new Animated.Value(0)).current;

    const isReordering = useRef(false);

    const recentTracks = queue.slice(0, activeIndex).reverse();
    const upcomingTracks = queue.slice(activeIndex + 1, activeIndex + 1 + 50);
    const currentTrack = queue[activeIndex] ?? null;

    const totalUpcomingCount = Math.max(0, queue.length - (activeIndex + 1));
    const hiddenUpcomingCount = Math.max(0, totalUpcomingCount - 50);

    useTrackPlayerEvents([Event.PlaybackActiveTrackChanged], async () => {
        if (isReordering.current) return;

        try {
            const [fullQueue, realIdx] = await Promise.all([
                TrackPlayer.getQueue(),
                TrackPlayer.getActiveTrackIndex(),
            ]);

            setQueue(fullQueue);
            if (realIdx !== undefined && realIdx !== null) {
                setActiveIndex(realIdx);
            }
        } catch (e) {
            console.error('QueueSheet: error sincronizando cola post-evento', e);
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
    }, [isVisible]);

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
    }, [isVisible, fadeAnim, slideAnim]);

    useEffect(() => {
        if (!isVisible) return;
        const onBackPress = () => { closeQueue(); return true; };
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [isVisible, closeQueue]);

    const switchTab = (tab: ActiveTab) => {
        setActiveTab(tab);
        Animated.spring(tabIndicatorAnim, {
            toValue: tab === 'queue' ? 0 : TAB_WIDTH,
            tension: 60,
            friction: 10,
            useNativeDriver: true,
        }).start();
    };

    const handleDragEnd = React.useCallback(async ({ data, from, to }: { data: TPTrack[], from: number, to: number }) => {
        if (from === to) return;

        isReordering.current = true;

        const globalFrom = activeIndex + 1 + from;
        const globalTo = activeIndex + 1 + to;

        const trackToMove = queue[globalFrom];
        if (!trackToMove) {
            isReordering.current = false;
            return;
        }

        const newQueue = [
            ...queue.slice(0, activeIndex + 1),
            ...data,
            ...queue.slice(activeIndex + 1 + data.length)
        ];
        setQueue(newQueue);

        try {
            await TrackPlayer.remove(globalFrom);
            await TrackPlayer.add([trackToMove], globalTo);

            await new Promise(resolve => setTimeout(resolve, 300));

            const [fullQueue, currentIdx] = await Promise.all([
                TrackPlayer.getQueue(),
                TrackPlayer.getActiveTrackIndex(),
            ]);

            setQueue(fullQueue);
            if (currentIdx !== undefined && currentIdx !== null) setActiveIndex(currentIdx);

            await usePlayerStore.getState().savePlaybackState();
        } catch (error) {
            console.error('Error reordering track:', error);
            const fullQueue = await TrackPlayer.getQueue();
            setQueue(fullQueue);
        } finally {
            isReordering.current = false;
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
        Alert.alert(
            "Gestionar cola",
            "¿Qué deseas hacer?",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Borrar la cola añadida",
                    onPress: async () => {
                        await clearUserQueue();
                        const [fullQueue, idx] = await Promise.all([
                            TrackPlayer.getQueue(),
                            TrackPlayer.getActiveTrackIndex(),
                        ]);
                        setQueue(fullQueue);
                        if (idx !== undefined && idx !== null) setActiveIndex(idx);
                    }
                },
                {
                    text: "Parar reproducción",
                    style: "destructive",
                    onPress: async () => {
                        await clearPlayer();
                        closeQueue();
                    }
                }
            ]
        );
    };

    const listHeader = React.useMemo(() => (
        <CurrentTrackHeader currentTrack={currentTrack} isPlayingGlobal={isPlayingGlobal} />
    ), [currentTrack, isPlayingGlobal]);

    const renderQueueItem = React.useCallback(({ item, getIndex, drag, isActive }: RenderItemParams<TPTrack>) => {
        const index = getIndex() || 0;
        return (
            <ScaleDecorator>
                <QueueTrackRow
                    item={item}
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
    }, [activeIndex, userQueueSize, handleSkipTo, handleRemove]);

    const renderRecentItem = React.useCallback(({ item, index }: { item: TPTrack; index: number }) => {
        return (
            <RecentTrackRow
                item={item}
                index={index}
                activeIndex={activeIndex}
                onSkip={handleSkipTo}
            />
        );
    }, [activeIndex, handleSkipTo]);

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
                                Cola
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
                                Anterior
                            </Text>
                            {recentTracks.length > 0 && (
                                <View style={[styles.badge, activeTab === 'recent' && styles.badgeActive]}>
                                    <Text style={styles.badgeText}>{recentTracks.length}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
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
                            keyExtractor={(item) => `q-${item.id}`}
                            renderItem={renderQueueItem}
                            onDragEnd={handleDragEnd}
                            ListEmptyComponent={
                                <View style={styles.emptyState}>
                                    <Ionicons name="musical-notes-outline" size={40} color={Colors.disabled} />
                                    <Text style={styles.emptyText}>No hay canciones en la cola</Text>
                                </View>
                            }
                            ListFooterComponent={
                                hiddenUpcomingCount > 0 ? (
                                    <View style={styles.footerContainer}>
                                        <Text style={styles.footerText}>
                                            y {hiddenUpcomingCount} {hiddenUpcomingCount === 1 ? 'canción más' : 'canciones más'} en la cola
                                        </Text>
                                    </View>
                                ) : null
                            }
                            contentContainerStyle={styles.listContent}
                            showsVerticalScrollIndicator={false}
                        />
                    </GestureHandlerRootView>
                ) : (
                    <FlashList
                        data={recentTracks}
                        keyExtractor={(item) => `r-${item.id}`}
                        renderItem={renderRecentItem}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Ionicons name="time-outline" size={40} color={Colors.disabled} />
                                <Text style={styles.emptyText}>Aún no hay historial</Text>
                            </View>
                        }
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </Animated.View>
        </View>
    );
}

interface CurrentTrackHeaderProps {
    currentTrack: TPTrack | null;
    isPlayingGlobal: boolean;
}

const CurrentTrackHeader = React.memo(({ currentTrack, isPlayingGlobal }: CurrentTrackHeaderProps) => {
    const imageSource = React.useMemo(() =>
        currentTrack?.artwork ? { uri: currentTrack.artwork } : null
        , [currentTrack?.artwork]);

    if (!currentTrack) return null;

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
});
CurrentTrackHeader.displayName = 'CurrentTrackHeader';

interface QueueTrackRowProps {
    item: any;
    index: number;
    activeIndex: number;
    userQueueSize: number;
    onSkip: (globalIndex: number) => void;
    onRemove: (globalIndex: number, isUserQueued: boolean) => void;
    drag?: () => void;
    isActive?: boolean;
}

const QueueTrackRow = React.memo(({ item, index, activeIndex, userQueueSize, onSkip, onRemove, drag, isActive }: QueueTrackRowProps) => {
    const globalIndex = activeIndex + 1 + index;
    const isUserQueued = index < userQueueSize;
    const isManual = item.isManual === true || isUserQueued;
    const imageSource = React.useMemo(() =>
        item.artwork ? { uri: item.artwork } : null
        , [item.artwork]);

    return (
        <TouchableOpacity
            style={[styles.trackRow, isActive && { backgroundColor: Colors.accentAlpha10 }]}
            onPress={() => onSkip(globalIndex)}
            onLongPress={drag}
            delayLongPress={200}
        >
            <TouchableOpacity
                onPressIn={drag}
                style={{ paddingVertical: 8, paddingRight: 12 }}
                hitSlop={{ top: 15, bottom: 15, left: 10, right: 10 }}
            >
                <Ionicons name="reorder-two" size={24} color={Colors.disabled} />
            </TouchableOpacity>
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
                    <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                    {isManual && (
                        <View style={styles.userQueueBadge}>
                            <Ionicons name="menu" size={12} color={Colors.accentLight} />
                        </View>
                    )}
                </View>
                <Text style={styles.subtitle} numberOfLines={1}>{item.artist || 'Desconocido'}</Text>
            </View>
            <TouchableOpacity
                style={styles.removeButton}
                onPress={() => onRemove(globalIndex, isUserQueued)}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
                <Ionicons name="close-outline" size={24} color={Colors.disabled} />
            </TouchableOpacity>
        </TouchableOpacity>
    );
});
QueueTrackRow.displayName = 'QueueTrackRow';

interface RecentTrackRowProps {
    item: TPTrack;
    index: number;
    activeIndex: number;
    onSkip: (globalIndex: number) => void;
}

const RecentTrackRow = React.memo(({ item, index, activeIndex, onSkip }: RecentTrackRowProps) => {
    const globalIndex = activeIndex - 1 - index;
    const imageSource = React.useMemo(() =>
        item.artwork ? { uri: item.artwork } : null
        , [item.artwork]);

    return (
        <TouchableOpacity
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
                <Text style={[styles.title, styles.textDimmed]} numberOfLines={1}>{item.title}</Text>
                <Text style={[styles.subtitle, styles.subtitleDimmed]} numberOfLines={1}>
                    {item.artist || 'Desconocido'}
                </Text>
            </View>
            <Ionicons name="play-back-outline" size={18} color={Colors.disabled} />
        </TouchableOpacity>
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
    dragIndicator: {
        width: 40,
        height: 4,
        backgroundColor: Colors.disabled,
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 14,
        marginBottom: 16,
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
    nowPlayingBadge: {
        backgroundColor: Colors.accentAlpha20,
        borderRadius: 6,
        paddingHorizontal: 7,
        paddingVertical: 3,
    },
    nowPlayingText: {
        color: Colors.accentLight,
        fontSize: 10,
        fontFamily: 'Montserrat',
        fontWeight: '800',
        letterSpacing: 0.8,
    },
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
    footerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 24,
        borderTopWidth: 1,
        borderColor: Colors.cardBackground,
        marginTop: 12,
    },
    footerText: {
        color: Colors.accentLight,
        fontSize: 13,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        letterSpacing: 0.5,
    },
});
