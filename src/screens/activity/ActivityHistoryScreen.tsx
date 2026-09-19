import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { useNavigation } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { State } from 'react-native-track-player';
import { PlayingIndicator } from '@/components/common/PlayingIndicator';
import { ScreenHeaderLayout } from '@/components/layouts/ScreenHeaderLayout';
import { database } from '../../database';
import Album from '../../database/models/Album';
import Artist from '../../database/models/Artist';
import PlaybackHistory from '../../database/models/PlaybackHistory';
import Track from '../../database/models/Track';
import { useAppTheme } from '../../hooks/useAppTheme';
import { usePlaybackState } from '../../hooks/usePlaybackState';
import { usePlayerStore } from '../../store/usePlayerStore';
import { openTrackMenu } from '../../store/useUIStore';

const PAGE_SIZE = 50;

export interface HistoryItem {
    id: string;
    trackId: string;
    title: string;
    artistName: string;
    coverUrl: string | null;
    playedAt: Date;
    durationPlayed: number;
    trackDoc?: Track;
}

export type HistoryListItem =
    | {
          type: 'header';
          id: string;
          dayKey: string;
          dayLabel: string;
          count: number;
          totalDuration: number;
          isCollapsed: boolean;
      }
    | {
          type: 'item';
          id: string;
          item: HistoryItem;
      };

function formatDurationPlayed(seconds: number): string {
    if (!seconds || seconds <= 0) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins === 0) return `${secs}s`;
    if (secs === 0) return `${mins}m`;
    return `${mins}m ${secs}s`;
}

function formatTimeOnly(date: Date): string {
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getDayKey(date: Date): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDayHeader(date: Date, t: any): string {
    const now = new Date();
    const d = new Date(date);

    const isToday =
        now.getDate() === d.getDate() &&
        now.getMonth() === d.getMonth() &&
        now.getFullYear() === d.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
        yesterday.getDate() === d.getDate() &&
        yesterday.getMonth() === d.getMonth() &&
        yesterday.getFullYear() === d.getFullYear();

    const dateOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
    if (d.getFullYear() !== now.getFullYear()) {
        dateOptions.year = 'numeric';
    }
    const formattedDate = d.toLocaleDateString(t('activity.locale_code') || 'es-ES', dateOptions);

    if (isToday) {
        return `${t('activity.history_today') || 'Hoy'} · ${formattedDate}`;
    }
    if (isYesterday) {
        return `${t('activity.history_yesterday') || 'Ayer'} · ${formattedDate}`;
    }

    return formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
}

const DayHeader = React.memo(({
    dayKey,
    dayLabel,
    count,
    totalDuration,
    isCollapsed,
    onToggle,
}: {
    dayKey: string;
    dayLabel: string;
    count: number;
    totalDuration: number;
    isCollapsed: boolean;
    onToggle: (dayKey: string) => void;
}) => {
    const { colors, fonts } = useAppTheme();
    const { t } = useTranslation();

    return (
        <TouchableOpacity
            style={[styles.dayHeaderContainer, { borderBottomColor: colors.overlayAlpha10 }]}
            onPress={() => onToggle(dayKey)}
            activeOpacity={0.7}
        >
            <View style={styles.dayHeaderLeft}>
                <View style={styles.dayHeaderTextGroup}>
                    <Text style={[styles.dayHeaderTitle, { fontFamily: fonts.regular, color: colors.text }]}>
                        {dayLabel}
                    </Text>
                    <Text style={[styles.dayHeaderSubtitle, { fontFamily: fonts.regular, color: colors.textSecondary }]}>
                        {count} {count === 1 ? (t('library.song_singular') || 'canción') : (t('library.songs') || 'canciones')} · {formatDurationPlayed(totalDuration)}
                    </Text>
                </View>
            </View>
            <View style={styles.chevronContainer}>
                <Ionicons
                    name={isCollapsed ? 'chevron-forward' : 'chevron-down'}
                    size={16}
                    color={colors.textSecondary}
                />
            </View>
        </TouchableOpacity>
    );
});

DayHeader.displayName = 'DayHeader';

const HistoryRowItem = React.memo(({
    item,
    isPlaying,
    isActuallyPlaying,
    onPress,
    onLongPress,
}: {
    item: HistoryItem;
    isPlaying: boolean;
    isActuallyPlaying: boolean;
    onPress: (item: HistoryItem) => void;
    onLongPress: (item: HistoryItem) => void;
}) => {
    const { colors, fonts } = useAppTheme();
    const [imageError, setImageError] = useState(false);

    const hasCover = Boolean(item.coverUrl && !imageError);

    return (
        <TouchableOpacity
            style={styles.rowContainer}
            onPress={() => onPress(item)}
            onLongPress={() => onLongPress(item)}
            activeOpacity={0.7}
            delayLongPress={300}
        >
            {/* CARÁTULA */}
            <View style={styles.coverWrapper}>
                {hasCover ? (
                    <Image
                        source={{ uri: item.coverUrl! }}
                        style={styles.coverImage}
                        contentFit="cover"
                        onError={() => setImageError(true)}
                    />
                ) : (
                    <View style={[styles.coverPlaceholder, { backgroundColor: colors.cardBackground }]}>
                        <Ionicons name="musical-note" size={24} color={colors.textSecondary} />
                    </View>
                )}
            </View>

            {/* INFO */}
            <View style={styles.infoContainer}>
                <View style={styles.titleRow}>
                    <Text
                        style={[
                            styles.songTitle,
                            { fontFamily: fonts.regular, color: isPlaying ? colors.accentLight : colors.text }
                        ]}
                        numberOfLines={1}
                    >
                        {item.title}
                    </Text>
                    {isPlaying && (
                        <View style={styles.indicatorContainer}>
                            <PlayingIndicator isPaused={!isActuallyPlaying} color={colors.accentLight} />
                        </View>
                    )}
                </View>
                <Text
                    style={[styles.artistName, { fontFamily: fonts.regular, color: colors.textSecondary }]}
                    numberOfLines={1}
                >
                    {item.artistName}
                </Text>
                <Text
                    style={[styles.timeText, { fontFamily: fonts.regular, color: colors.textSecondary }]}
                    numberOfLines={1}
                >
                    {formatTimeOnly(item.playedAt)}
                </Text>
            </View>

            {/* TIEMPO ESCUCHADO */}
            <View style={styles.durationContainer}>
                <Ionicons name="time-outline" size={12} color={colors.textSecondary} style={{ marginRight: 3 }} />
                <Text style={[styles.durationText, { fontFamily: fonts.regular, color: colors.textSecondary }]}>
                    {formatDurationPlayed(item.durationPlayed)}
                </Text>
            </View>
        </TouchableOpacity>
    );
});

HistoryRowItem.displayName = 'HistoryRowItem';

export default function ActivityHistoryScreen() {
    const { colors, fonts } = useAppTheme();
    const { t } = useTranslation();
    const navigation = useNavigation<any>();

    const activeTrack = usePlayerStore(state => state.activeTrack);
    const playbackStateRN = usePlaybackState();
    const isActuallyPlaying = playbackStateRN.state === State.Playing || playbackStateRN.state === State.Buffering;

    const [items, setItems] = useState<HistoryItem[]>([]);
    const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(0);

    const fetchHistoryBatch = useCallback(async (pageIndex: number): Promise<HistoryItem[]> => {
        try {
            const records = await database.collections
                .get<PlaybackHistory>('playback_history')
                .query(
                    Q.sortBy('played_at', Q.desc),
                    Q.skip(pageIndex * PAGE_SIZE),
                    Q.take(PAGE_SIZE)
                )
                .fetch();

            if (records.length === 0) return [];

            const uniqueTrackIds = Array.from(new Set(records.map(r => r.itemId)));
            const tracks = await database.collections
                .get<Track>('tracks')
                .query(Q.where('id', Q.oneOf(uniqueTrackIds)))
                .fetch();

            const trackMap = new Map<string, Track>();
            tracks.forEach(t => trackMap.set(t.id, t));

            // Prefetch albums and artists
            const albumIds = Array.from(new Set(tracks.map(t => (t as any).albumId || (t._raw as any).album_id).filter(Boolean)));
            const artistIds = Array.from(new Set(tracks.map(t => (t as any).artistId || (t._raw as any).artist_id).filter(Boolean)));

            const [albums, artists] = await Promise.all([
                albumIds.length > 0
                    ? database.collections.get<Album>('albums').query(Q.where('id', Q.oneOf(albumIds))).fetch()
                    : Promise.resolve([]),
                artistIds.length > 0
                    ? database.collections.get<Artist>('artists').query(Q.where('id', Q.oneOf(artistIds))).fetch()
                    : Promise.resolve([]),
            ]);

            const albumMap = new Map<string, Album>();
            albums.forEach(a => albumMap.set(a.id, a));

            const artistMap = new Map<string, Artist>();
            artists.forEach(a => artistMap.set(a.id, a));

            return records.map(rec => {
                const track = trackMap.get(rec.itemId);
                const albumId = track ? ((track as any).albumId || (track._raw as any).album_id) : null;
                const artistId = track ? ((track as any).artistId || (track._raw as any).artist_id) : null;

                const album = albumId ? albumMap.get(albumId) : null;
                const artist = artistId ? artistMap.get(artistId) : null;

                return {
                    id: rec.id,
                    trackId: rec.itemId,
                    title: track?.title || 'Canción desconocida',
                    artistName: artist?.name || 'Artista desconocido',
                    coverUrl: album?.coverUrl || null,
                    playedAt: rec.playedAt,
                    durationPlayed: rec.durationPlayed || 0,
                    trackDoc: track,
                };
            });
        } catch (e) {
            console.error('[ActivityHistoryScreen] Error fetching history batch:', e);
            return [];
        }
    }, []);

    const loadInitial = useCallback(async () => {
        setLoading(true);
        const firstBatch = await fetchHistoryBatch(0);
        setItems(firstBatch);
        setPage(0);
        setHasMore(firstBatch.length === PAGE_SIZE);
        setLoading(false);
    }, [fetchHistoryBatch]);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        const firstBatch = await fetchHistoryBatch(0);
        setItems(firstBatch);
        setPage(0);
        setHasMore(firstBatch.length === PAGE_SIZE);
        setRefreshing(false);
    }, [fetchHistoryBatch]);

    const handleLoadMore = useCallback(async () => {
        if (loadingMore || !hasMore || loading) return;
        setLoadingMore(true);
        const nextPage = page + 1;
        const nextBatch = await fetchHistoryBatch(nextPage);
        if (nextBatch.length > 0) {
            setItems(prev => [...prev, ...nextBatch]);
            setPage(nextPage);
            setHasMore(nextBatch.length === PAGE_SIZE);
        } else {
            setHasMore(false);
        }
        setLoadingMore(false);
    }, [loadingMore, hasMore, loading, page, fetchHistoryBatch]);

    useEffect(() => {
        loadInitial();
    }, [loadInitial]);

    const handleToggleDay = useCallback((dayKey: string) => {
        setExpandedDays(prev => ({
            ...prev,
            [dayKey]: !prev[dayKey],
        }));
    }, []);

    // Transform items into sectioned list with dropdown headers
    const listData = useMemo<HistoryListItem[]>(() => {
        if (items.length === 0) return [];

        const dayGroups: {
            dayKey: string;
            dayLabel: string;
            items: HistoryItem[];
            totalDuration: number;
        }[] = [];

        const dayGroupMap = new Map<string, typeof dayGroups[0]>();

        for (const it of items) {
            const dKey = getDayKey(it.playedAt);
            let group = dayGroupMap.get(dKey);
            if (!group) {
                group = {
                    dayKey: dKey,
                    dayLabel: formatDayHeader(it.playedAt, t),
                    items: [],
                    totalDuration: 0,
                };
                dayGroupMap.set(dKey, group);
                dayGroups.push(group);
            }
            group.items.push(it);
            group.totalDuration += it.durationPlayed || 0;
        }

        const result: HistoryListItem[] = [];
        for (const group of dayGroups) {
            const isCollapsed = !expandedDays[group.dayKey];
            result.push({
                type: 'header',
                id: `header-${group.dayKey}`,
                dayKey: group.dayKey,
                dayLabel: group.dayLabel,
                count: group.items.length,
                totalDuration: group.totalDuration,
                isCollapsed,
            });

            if (!isCollapsed) {
                for (const it of group.items) {
                    result.push({
                        type: 'item',
                        id: it.id,
                        item: it,
                    });
                }
            }
        }

        return result;
    }, [items, expandedDays, t]);

    const handlePlayItem = useCallback(async (item: HistoryItem) => {
        try {
            let track = item.trackDoc;
            if (!track) {
                track = await database.get<Track>('tracks').find(item.trackId);
            }
            if (track) {
                usePlayerStore.getState().playSingleTrack(track, 'history');
            }
        } catch (err) {
            console.warn('[ActivityHistoryScreen] Failed to play track:', err);
        }
    }, []);

    const handleOpenMenu = useCallback((item: HistoryItem) => {
        if (item.trackDoc) {
            openTrackMenu(item.trackDoc, {
                album: (albumId: string) => navigation.navigate('AlbumDetail', { albumId }),
                artist: (artistId: string) => navigation.navigate('ArtistDetail', { artistId }),
            });
        }
    }, [navigation]);

    const handleClearHistory = useCallback(() => {
        Alert.alert(
            t('activity.history_clear') || 'Borrar historial',
            t('activity.history_clear_confirm') || '¿Estás seguro de que quieres borrar todo el historial de reproducción?',
            [
                { text: t('common.cancel') || 'Cancelar', style: 'cancel' },
                {
                    text: t('common.delete') || 'Borrar',
                    style: 'destructive',
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
                            setItems([]);
                            setHasMore(false);
                        } catch (error) {
                            console.error('[ActivityHistoryScreen] Error clearing history:', error);
                        }
                    },
                },
            ]
        );
    }, [t]);

    const clearButton = useMemo(() => {
        if (items.length === 0) return null;
        return (
            <TouchableOpacity
                onPress={handleClearHistory}
                style={styles.clearButton}
                activeOpacity={0.7}
                accessibilityLabel={t('activity.history_clear') || 'Borrar historial'}
            >
                <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
        );
    }, [items.length, handleClearHistory, colors.textSecondary, t]);

    const renderItem = useCallback(({ item }: { item: HistoryListItem }) => {
        if (item.type === 'header') {
            return (
                <DayHeader
                    dayKey={item.dayKey}
                    dayLabel={item.dayLabel}
                    count={item.count}
                    totalDuration={item.totalDuration}
                    isCollapsed={item.isCollapsed}
                    onToggle={handleToggleDay}
                />
            );
        }

        const isPlaying = activeTrack?.id === item.item.trackId;
        return (
            <HistoryRowItem
                item={item.item}
                isPlaying={isPlaying}
                isActuallyPlaying={isActuallyPlaying}
                onPress={handlePlayItem}
                onLongPress={handleOpenMenu}
            />
        );
    }, [activeTrack?.id, isActuallyPlaying, handleToggleDay, handlePlayItem, handleOpenMenu]);

    const keyExtractor = useCallback((item: HistoryListItem) => item.id, []);

    const getItemType = useCallback((item: HistoryListItem) => item.type, []);

    return (
        <ScreenHeaderLayout
            title={t('activity.history_title') || 'Historial de reproducción'}
            showBackButton={true}
            rightComponent={clearButton}
        >
            {({ headerHeight, bottomPadding }) => (
                <View style={[styles.container, { paddingTop: headerHeight + 10 }]}>
                    {loading ? (
                        <View style={styles.centerLoading}>
                            <ActivityIndicator size="large" color={colors.accentLight} />
                        </View>
                    ) : (
                        <FlashList
                            data={listData}
                            keyExtractor={keyExtractor}
                            getItemType={getItemType}
                            renderItem={renderItem}
                            contentContainerStyle={{
                                paddingHorizontal: 16,
                                paddingBottom: bottomPadding + 20,
                            }}
                            showsVerticalScrollIndicator={false}
                            refreshControl={
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={handleRefresh}
                                    tintColor={colors.accentLight}
                                    colors={[colors.accentLight]}
                                />
                            }
                            onEndReached={handleLoadMore}
                            onEndReachedThreshold={0.5}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <View style={[styles.emptyIconCircle, { backgroundColor: colors.accentAlpha10 }]}>
                                        <Ionicons name="time-outline" size={48} color={colors.accentLight} />
                                    </View>
                                    <Text style={[styles.emptyTitle, { fontFamily: fonts.regular, color: colors.text }]}>
                                        {t('activity.history_empty') || 'El historial de reproducción está vacío'}
                                    </Text>
                                    <Text style={[styles.emptyDesc, { fontFamily: fonts.regular, color: colors.textSecondary }]}>
                                        {t('activity.history_empty_desc') || 'Las canciones que escuches aparecerán aquí'}
                                    </Text>
                                </View>
                            }
                            ListFooterComponent={
                                loadingMore ? (
                                    <View style={{ paddingVertical: 16 }}>
                                        <ActivityIndicator size="small" color={colors.accentLight} />
                                    </View>
                                ) : null
                            }
                        />
                    )}
                </View>
            )}
        </ScreenHeaderLayout>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centerLoading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    clearButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayHeaderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 4,
        marginTop: 14,
        marginBottom: 6,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    },
    dayHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10,
    },
    dayHeaderTextGroup: {
        flex: 1,
    },
    dayHeaderTitle: {
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    dayHeaderSubtitle: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 3,
    },
    chevronContainer: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rowContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderRadius: 8,
        marginBottom: 2,
    },
    coverWrapper: {
        width: 50,
        height: 50,
        borderRadius: 8,
        overflow: 'hidden',
    },
    coverImage: {
        width: 50,
        height: 50,
        borderRadius: 8,
    },
    coverPlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoContainer: {
        flex: 1,
        marginLeft: 12,
        marginRight: 8,
        justifyContent: 'center',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        maxWidth: '100%',
    },
    songTitle: {
        fontSize: 14,
        fontWeight: '700',
        lineHeight: 18,
        flexShrink: 1,
    },
    indicatorContainer: {
        flexShrink: 0,
    },
    artistName: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
    timeText: {
        fontSize: 11,
        fontWeight: '400',
        marginTop: 2,
        opacity: 0.75,
    },
    durationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        paddingHorizontal: 2,
    },
    durationText: {
        fontSize: 12,
        fontWeight: '500',
        letterSpacing: 0.2,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
        paddingHorizontal: 32,
    },
    emptyIconCircle: {
        width: 88,
        height: 88,
        borderRadius: 44,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 17,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 8,
    },
    emptyDesc: {
        fontSize: 13,
        fontWeight: '400',
        textAlign: 'center',
        lineHeight: 18,
    },
});
