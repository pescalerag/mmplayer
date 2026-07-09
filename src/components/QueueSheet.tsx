import { useSheetProps } from '@/hooks/useSheetProps';
import { openPlaylistSelector } from '@/store/useUIStore';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import TrackPlayer, {
  Event,
  State,
  Track as TPTrack,
  useTrackPlayerEvents,
} from 'react-native-track-player';
import { usePlaybackState } from '../hooks/usePlaybackState';
import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import Track from '../database/models/Track';
import { usePlayerStore } from '../store/usePlayerStore';


import { Colors } from '../theme/theme';
import { PlayingIndicator } from './PlayingIndicator';

const { width } = Dimensions.get('window');
const TAB_WIDTH = (width - 48 - 110) / 2;

type ActiveTab = 'queue' | 'recent';

export default function QueueSheet() {
  const { close: closeQueue } = useSheetProps('queue');
  const userQueueSize = usePlayerStore(state => state.userQueueSize);
  const decrementUserQueue = usePlayerStore(state => state.decrementUserQueue);
  const clearPlayer = usePlayerStore(state => state.clearPlayer);
  const clearUserQueue = usePlayerStore(state => state.clearUserQueue);

  const playbackState = usePlaybackState();
  const isPlayingGlobal = playbackState.state === State.Playing || playbackState.state === State.Buffering;

  const [queue, setQueue] = useState<TPTrack[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<ActiveTab>('queue');

  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;
  const isReordering = useRef(false);

  const recentTracks = queue.slice(0, activeIndex).reverse();
  const upcomingTracks = queue.slice(activeIndex + 1, activeIndex + 1 + 50);
  const currentTrack = queue[activeIndex] ?? null;

  const totalUpcomingCount = Math.max(0, queue.length - (activeIndex + 1));
  const hiddenUpcomingCount = Math.max(0, totalUpcomingCount - 50);

  // Sync initially
  useEffect(() => {
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
  }, []);

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
      // Wait for index sync
      setActiveIndex(globalIndex);
      if (!isPlayingGlobal) {
        await TrackPlayer.play();
      }
    } catch (e) {
      console.error('Error al saltar de canción en la cola:', e);
    }
  }, [isPlayingGlobal]);

  const handleRemove = React.useCallback(async (indexInDraggable: number) => {
    const globalIdx = activeIndex + 1 + indexInDraggable;
    const isUserQueue = indexInDraggable < userQueueSize;

    try {
      await TrackPlayer.remove(globalIdx);
      if (isUserQueue) {
        decrementUserQueue();
      }
      
      const [fullQueue, currentIdx] = await Promise.all([
        TrackPlayer.getQueue(),
        TrackPlayer.getActiveTrackIndex(),
      ]);
      setQueue(fullQueue);
      if (currentIdx !== undefined && currentIdx !== null) setActiveIndex(currentIdx);
      
      await usePlayerStore.getState().savePlaybackState();
    } catch (e) {
      console.error('Error removing song from queue:', e);
    }
  }, [activeIndex, userQueueSize, decrementUserQueue]);

  const handleTrashPress = () => {
    Alert.alert(
      "Vaciar cola",
      "¿Qué deseas hacer con la cola de reproducción?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Limpiar Cola",
          style: "destructive",
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
          text: "Limpiar todo (Detener)",
          style: "destructive",
          onPress: async () => {
            closeQueue();
            await clearPlayer();
          }
        }
      ]
    );
  };

  const handleSaveQueueAsPlaylist = async () => {
    try {
      const trackIds = Array.from(new Set(queue.map(t => t.id.toString().split('-')[0])));
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
          if (track) {
            orderedTracks.push(track);
          }
        });

        openPlaylistSelector(orderedTracks);
        closeQueue();
      }
    } catch (error) {
      console.error('Error saving queue as playlist:', error);
    }
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

  return (
    <View style={styles.container}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
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
        {queue.length > 0 && (
          <TouchableOpacity
            style={{ padding: 10, marginLeft: 4 }}
            onPress={handleSaveQueueAsPlaylist}
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
    </View>
  );
}

interface CurrentTrackHeaderProps {
  currentTrack: TPTrack | null;
  isPlayingGlobal: boolean;
}

const CurrentTrackHeader = React.memo(({ currentTrack, isPlayingGlobal }: CurrentTrackHeaderProps) => {
  if (!currentTrack) return null;

  return (
    <View style={styles.currentTrackRow}>
      <Image
        source={{ uri: currentTrack.artwork }}
        style={styles.thumbnail}
        contentFit="cover"
        transition={200}
      />
      <View style={styles.trackInfo}>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, styles.textActive]} numberOfLines={1}>
            {currentTrack.title}
          </Text>
        </View>
        <Text style={styles.subtitle} numberOfLines={1}>
          {currentTrack.artist}
        </Text>
      </View>
      <View style={{ gap: 8, flexDirection: 'row', alignItems: 'center' }}>
        {isPlayingGlobal ? (
          <PlayingIndicator color={Colors.accentLight} />
        ) : (
          <View style={styles.nowPlayingBadge}>
            <Text style={styles.nowPlayingText}>PAUSADO</Text>
          </View>
        )}
      </View>
    </View>
  );
});
CurrentTrackHeader.displayName = 'CurrentTrackHeader';

interface QueueTrackRowProps {
  item: TPTrack;
  index: number;
  activeIndex: number;
  userQueueSize: number;
  onSkip: (globalIdx: number) => void;
  onRemove: (idxInDraggable: number) => void;
  drag: () => void;
  isActive: boolean;
}

const QueueTrackRow = React.memo(({
  item,
  index,
  activeIndex,
  userQueueSize,
  onSkip,
  onRemove,
  drag,
  isActive
}: QueueTrackRowProps) => {
  const globalIdx = activeIndex + 1 + index;
  const isUserQueue = index < userQueueSize;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onSkip(globalIdx)}
      onLongPress={drag}
      style={[
        styles.trackRow,
        isActive && { backgroundColor: 'rgba(255,255,255,0.05)' }
      ]}
    >
      <Image
        source={{ uri: item.artwork }}
        style={styles.thumbnail}
        contentFit="cover"
        transition={150}
      />
      <View style={styles.trackInfo}>
        <View style={styles.titleRow}>
          {isUserQueue && (
            <View style={styles.userQueueBadge}>
              <Ionicons name="person" size={10} color={Colors.accentLight} />
            </View>
          )}
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
        </View>
        <Text style={styles.subtitle} numberOfLines={1}>
          {item.artist}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => onRemove(index)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close-outline" size={20} color={Colors.disabled} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});
QueueTrackRow.displayName = 'QueueTrackRow';

interface RecentTrackRowProps {
  item: TPTrack;
  index: number;
  activeIndex: number;
  onSkip: (globalIdx: number) => void;
}

const RecentTrackRow = React.memo(({ item, index, activeIndex, onSkip }: RecentTrackRowProps) => {
  const globalIdx = activeIndex - 1 - index;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onSkip(globalIdx)}
      style={styles.trackRow}
    >
      <Image
        source={{ uri: item.artwork }}
        style={[styles.thumbnail, styles.placeholder]}
        contentFit="cover"
        transition={150}
      />
      <View style={styles.trackInfo}>
        <Text style={[styles.title, styles.textDimmed]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.subtitle, styles.subtitleDimmed]} numberOfLines={1}>
          {item.artist}
        </Text>
      </View>
    </TouchableOpacity>
  );
});
RecentTrackRow.displayName = 'RecentTrackRow';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    padding: 4,
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
