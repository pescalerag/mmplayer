import { PlayingIndicator } from '@/components/common/PlayingIndicator';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Animated,
    ActivityIndicator,
    BackHandler,
    Dimensions,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureDetector, Gesture, TouchableOpacity as GHTouchableOpacity, GestureHandlerRootView } from 'react-native-gesture-handler';
import AnimatedReanimated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    State,
    Track as TPTrack,
} from 'react-native-track-player';
import { usePlaybackState } from '../../hooks/usePlaybackState';
import { database } from '../../database';
import Track from '../../database/models/Track';
import { useToastStore } from '../../store/useToastStore';
import { useAppTheme } from '../../hooks/useAppTheme';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { openPlaylistSelector, useUIStore } from '../../store/useUIStore';
import { Colors, Layout } from '../../theme/theme';
import { refreshQueueSnapshot, useQueueSnapshotStore } from '../../store/useQueueSnapshotStore';
import { QueueActionsService, QueueRemoval } from '../../services/QueueActionsService';
import { useCastStore } from '../../store/useCastStore';
import { LocalCastService } from '../../services/LocalCastService';

const { height, width } = Dimensions.get('window');
const TAB_WIDTH = (width - 48 - 110) / 2;
const ITEM_ROW_HEIGHT = 72; // Altura fija para optimizar getItemLayout

type ActiveTab = 'queue' | 'recent';

let deletedQueueStack: QueueRemoval[] = [];
let undoDeletionTimeout: ReturnType<typeof setTimeout> | null = null;

export default function QueueSheet() {
    const { colors } = useAppTheme();
    const { t } = useTranslation();
    const activeSheet = useUIStore(state => state.activeSheet);
    const closeQueue = useUIStore(state => state.closeSheet);
    const isVisible = activeSheet === 'queue';
    const insets = useSafeAreaInsets();
    const userQueueSize = usePlayerStore(state => state.userQueueSize);
    const queueVersion = usePlayerStore(state => state.queueVersion);
    const shuffleOnQueueEnd = useSettingsStore(state => state.shuffleOnQueueEnd);
    const setShuffleOnQueueEnd = useSettingsStore(state => state.setShuffleOnQueueEnd);

    const playbackState = usePlaybackState();
    const isPlayingGlobal = playbackState.state === State.Playing || playbackState.state === State.Buffering;

    const queue = useQueueSnapshotStore(state => state.queue);
    const activeIndex = useQueueSnapshotStore(state => state.activeIndex);
    const queueReady = useQueueSnapshotStore(state => state.ready);
    const [activeTab, setActiveTab] = useState<ActiveTab>('queue');
    const [showTrashMenu, setShowTrashMenu] = useState(false);
    const [showAddPlaylistMenu, setShowAddPlaylistMenu] = useState(false);
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

    const recentTracks = React.useMemo(() => {
        return queue.slice(0, Math.max(0, activeIndex)).reverse();
    }, [queue, activeIndex]);

    // Muestra TODA la cola restante sin capas ni límites de 50
    const upcomingTracks = React.useMemo(() => {
        return queue.slice(activeIndex + 1);
    }, [queue, activeIndex]);

    const currentTrack = queue[activeIndex] ?? null;

    const totalUpcomingCount = Math.max(0, queue.length - (activeIndex + 1));

    useEffect(() => {
        if (isVisible) {
            void refreshQueueSnapshot().catch(error => console.error('QueueSheet: error cargando cola', error));
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

    const handleDragEnd = React.useCallback(async ({ data, from, to }: { data: TPTrack[], from: number, to: number }) => {
        if (from === to || !data[to]) return;
        try {
            await QueueActionsService.move(data[to], data[to + 1]);
            usePlayerStore.setState(state => ({ windowVersion: state.windowVersion + 1 }));
            if (useCastStore.getState().isLocalCastActive) {
                void LocalCastService.triggerPreloadNext(useQueueSnapshotStore.getState().activeIndex).catch(() => {});
            }
        } catch (error) {
            console.error('Error reordering track:', error);
        }
    }, []);

    const handleSkipTo = React.useCallback((track: TPTrack) => {
        void QueueActionsService.play(track).catch(error => console.error('Error skipping to track:', error));
    }, []);

    const handleRemove = React.useCallback((track: TPTrack, isUserQueued: boolean) => {
        const removal = QueueActionsService.remove(track, isUserQueued);
        if (!removal) return;
        deletedQueueStack = deletedQueueStack.filter(item => !item.failed);
        deletedQueueStack.push(removal);
        if (undoDeletionTimeout) clearTimeout(undoDeletionTimeout);
        const TOAST_DURATION = 3000;
        undoDeletionTimeout = setTimeout(() => {
            deletedQueueStack = [];
            undoDeletionTimeout = null;
        }, TOAST_DURATION);
        const count = deletedQueueStack.length;
        const message = count === 1
            ? t('queue.track_removed', 'Has eliminado una canción de la cola')
            : t('queue.tracks_removed', { count, defaultValue: `Has eliminado ${count} canciones de la cola` });
        useToastStore.getState().showToast(message, 'close-circle', '#EF4444', {
            text: t('queue.undo', 'Deshacer'),
            color: colors.accentLight || colors.accent || '#8B5CF6',
            onPress: () => {
                if (undoDeletionTimeout) clearTimeout(undoDeletionTimeout);
                undoDeletionTimeout = null;
                const removals = deletedQueueStack;
                deletedQueueStack = [];
                void QueueActionsService.undo(removals).catch(error => console.error('Error restoring queue:', error));
            },
        }, TOAST_DURATION);
    }, [colors.accent, colors.accentLight, t]);

    const clearUndoState = React.useCallback(() => {
        if (undoDeletionTimeout) {
            clearTimeout(undoDeletionTimeout);
            undoDeletionTimeout = null;
        }
        deletedQueueStack = [];
        useToastStore.getState().hideToast();
    }, []);

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
        return (
            <CurrentTrackHeader
                currentTrack={currentTrack}
                isPlayingGlobal={isPlayingGlobal}
                colors={colors}
            />
        );
    }, [currentTrack, isPlayingGlobal, colors]);

    const renderQueueItem = React.useCallback(({ item, getIndex, drag, isActive }: RenderItemParams<TPTrack>) => {
        const index = getIndex() || 0;
        return (
            <ScaleDecorator>
                <QueueTrackRow
                    item={item}
                    index={index}
                    userQueueSize={userQueueSize}
                    onSkip={handleSkipTo}
                    onRemove={handleRemove}
                    drag={drag}
                    isActive={isActive}
                    colors={colors}
                />
            </ScaleDecorator>
        );
    }, [userQueueSize, handleSkipTo, handleRemove, colors]);

    const renderRecentItem = React.useCallback(({ item }: { item: TPTrack }) => {
        return (
            <RecentTrackRow
                item={item}
                onSkip={handleSkipTo}
            />
        );
    }, [handleSkipTo]);

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
                    <View style={{ flex: 1 }}>
                        <View style={{ backgroundColor: colors.background || Colors.background, zIndex: 5, elevation: 5 }}>
                            {listHeader}
                            {Boolean(currentTrack) && <View style={[styles.separator, { marginBottom: 0 }]} />}
                        </View>
                        <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background || Colors.background }}>
                            <DraggableFlatList
                                data={upcomingTracks}
                                keyExtractor={(item, index) => item?.id ? String(item.id) : `queue-item-${index}`}
                                renderItem={renderQueueItem}
                                onDragEnd={handleDragEnd}
                                activationDistance={5}
                                autoscrollThreshold={50}
                                autoscrollSpeed={120}
                                dragItemOverflow={false}
                                bounces={false}
                                overScrollMode="never"
                                containerStyle={{ flex: 1 }}
                                style={{ flex: 1 }}
                                getItemLayout={(_data, index) => ({
                                    length: ITEM_ROW_HEIGHT,
                                    offset: ITEM_ROW_HEIGHT * index,
                                    index,
                                })}
                                initialNumToRender={8}
                                maxToRenderPerBatch={8}
                                windowSize={7}
                                extraData={queue}
                                ListEmptyComponent={queueReady ? (
                                    <View style={styles.emptyState}>
                                        <Ionicons name="musical-notes-outline" size={40} color={Colors.disabled} />
                                        <Text style={styles.emptyText}>{t('queue.empty')}</Text>
                                    </View>
                                ) : <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />}
                                contentContainerStyle={styles.queueListContent}
                                showsVerticalScrollIndicator={false}
                            />
                        </GestureHandlerRootView>
                        <View style={[styles.bottomFooterContainer, { paddingBottom: Math.max(insets.bottom, 10), backgroundColor: colors.background || Colors.background, zIndex: 5, elevation: 5 }]}>
                            <View style={[styles.separator, { marginTop: 6, marginBottom: 6 }]} />
                            <View style={styles.shuffleOnEndRow}>
                                <View style={styles.shuffleOnEndLeft}>
                                    <Ionicons
                                        name="shuffle"
                                        size={20}
                                        color={shuffleOnQueueEnd ? (colors.accentLight || colors.accent) : colors.textSecondary}
                                    />
                                    <Text style={[styles.shuffleOnEndText, { color: colors.text }]}>
                                        {t('queue.shuffle_on_end', 'Reproducción aleatoria al finalizar la cola')}
                                    </Text>
                                </View>
                                <Switch
                                    value={shuffleOnQueueEnd}
                                    onValueChange={setShuffleOnQueueEnd}
                                    trackColor={{ false: '#282828', true: colors.accent }}
                                    thumbColor={shuffleOnQueueEnd ? '#FFFFFF' : '#888888'}
                                    ios_backgroundColor="#282828"
                                />
                            </View>
                        </View>
                    </View>
                ) : (
                    <View style={{ flex: 1, overflow: 'hidden' }}>
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
                            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 10) + 24 }}
                            showsVerticalScrollIndicator={false}
                        />
                    </View>
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
                                                clearUndoState();
                                                await QueueActionsService.clear('manual').catch(error => console.error('Error clearing manual queue:', error));
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
                                                clearUndoState();
                                                await QueueActionsService.clear('context').catch(error => console.error('Error clearing context queue:', error));
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
                                            clearUndoState();
                                            void QueueActionsService.stop().catch(error => console.error('Error clearing player:', error));
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
    isPlayingGlobal: boolean;
    colors: ReturnType<typeof useAppTheme>['colors'];
}

const CurrentTrackHeader = React.memo(({ currentTrack, isPlayingGlobal, colors }: CurrentTrackHeaderProps) => {
    const artworkUrl = currentTrack?.artwork;
    const imageSource = React.useMemo(() =>
        artworkUrl ? { uri: artworkUrl } : null
        , [artworkUrl]);

    if (!currentTrack) return null;

    const title = currentTrack.title;
    const artist = currentTrack.artist;

    return (
        <View style={[styles.currentTrackRow, { backgroundColor: colors.accentAlpha15 }]}>
            {imageSource ? (
                <Image
                    source={imageSource}
                    style={styles.thumbnail}
                    contentFit="cover"
                    transition={200}
                />
            ) : (
                <View style={[styles.thumbnail, styles.placeholder]}>
                    <Ionicons name="musical-notes" size={20} color={colors.disabled} />
                </View>
            )}
            <View style={styles.trackInfo}>
                <View style={styles.titleContainer}>
                    <Text style={[styles.title, { color: colors.accentLight || colors.accent }]} numberOfLines={1}>
                        {title}
                    </Text>
                    <PlayingIndicator isPaused={!isPlayingGlobal} color={colors.accentLight || colors.accent} />
                </View>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                    {artist || 'Desconocido'}
                </Text>
            </View>
        </View>
    );
});
CurrentTrackHeader.displayName = 'CurrentTrackHeader';

interface QueueTrackRowProps {
    item: TPTrack;
    index: number;
    userQueueSize: number;
    onSkip: (track: TPTrack) => void;
    onRemove: (track: TPTrack, isUserQueued: boolean) => void;
    drag?: () => void;
    isActive?: boolean;
    colors: ReturnType<typeof useAppTheme>['colors'];
}

const QueueTrackRow = React.memo(({ item, index, userQueueSize, onSkip, onRemove, drag, isActive, colors }: QueueTrackRowProps) => {
    const isUserQueued = index < userQueueSize;
    const isManual = item.isManual === true || isUserQueued;
    const artworkUrl = item.artwork;
    const imageSource = React.useMemo(() =>
        artworkUrl ? { uri: artworkUrl } : null
        , [artworkUrl]);

    const title = item.title;
    const artist = item.artist;

    return (
        <View style={[styles.trackRow, isActive && [styles.trackRowActive, { backgroundColor: colors.accentAlpha10 || Colors.accentAlpha10 }]]}>
            <GHTouchableOpacity
                onLongPress={drag}
                delayLongPress={60}
                style={styles.dragHandle}
                hitSlop={{ top: 15, bottom: 15, left: 10, right: 10 }}
                activeOpacity={0.6}
            >
                <Ionicons name="reorder-two" size={24} color={isActive ? (colors.accent || Colors.accent) : colors.disabled} />
            </GHTouchableOpacity>

            <TouchableOpacity
                style={styles.trackMainContent}
                onPress={() => onSkip(item)}
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
                        <Ionicons name="musical-notes" size={20} color={colors.disabled} />
                    </View>
                )}
                <View style={styles.trackInfo}>
                    <View style={styles.titleRow}>
                        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>
                        {isManual && (
                            <View style={[styles.userQueueBadge, { backgroundColor: colors.accentLightAlpha12, borderColor: colors.accentLightAlpha30 }]}>
                                <Ionicons name="menu" size={12} color={colors.accentLight || colors.accent} />
                            </View>
                        )}
                    </View>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>{artist || 'Desconocido'}</Text>
                </View>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.removeButton}
                onPress={() => onRemove(item, isManual)}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                disabled={isActive}
            >
                <Ionicons name="close-outline" size={24} color={colors.disabled} />
            </TouchableOpacity>
        </View>
    );
});
QueueTrackRow.displayName = 'QueueTrackRow';

interface RecentTrackRowProps {
    item: TPTrack;
    onSkip: (track: TPTrack) => void;
}

const RecentTrackRow = React.memo(({ item, onSkip }: RecentTrackRowProps) => {
    const artworkUrl = item.artwork;
    const imageSource = React.useMemo(() =>
        artworkUrl ? { uri: artworkUrl } : null
        , [artworkUrl]);

    const title = item.title;
    const artist = item.artist;

    return (
        <GHTouchableOpacity
            style={styles.trackRow}
            onPress={() => onSkip(item)}
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
    shuffleOnEndRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 6,
    },
    shuffleOnEndLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginRight: 12,
    },
    shuffleOnEndText: {
        fontSize: 13,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    trackRow: {
        height: ITEM_ROW_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
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
        maxWidth: '100%',
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
        paddingBottom: Layout.MINI_PLAYER_HEIGHT + Layout.TAB_BAR_HEIGHT + Layout.PLAYER_MARGIN,
    },
    queueListContent: {
        paddingTop: 6,
        paddingBottom: 24,
    },
    bottomFooterContainer: {
        width: '100%',
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
