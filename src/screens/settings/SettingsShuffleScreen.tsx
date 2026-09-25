import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import withObservables from '@nozbe/with-observables';
import { Q } from '@nozbe/watermelondb';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { FlashList } from '@shopify/flash-list';

import { ScreenHeaderLayout } from '@/components/layouts/ScreenHeaderLayout';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useToastStore } from '../../store/useToastStore';
import { database } from '../../database';
import Track from '../../database/models/Track';
import Album from '../../database/models/Album';
import Artist from '../../database/models/Artist';
import { ShuffleService } from '../../services/ShuffleService';

const PAGE_SIZE = 30;

interface ExcludedAlbumItemProps {
    readonly album: Album;
    readonly artist?: Artist | null;
    readonly onRestore: (album: Album) => void;
    readonly colors: any;
}

const ExcludedAlbumItem = withObservables(['album'], ({ album }: { album: Album }) => ({
    album: album.observe(),
    artist: album.artist.observe().pipe(catchError(() => of(null))),
}))(function ExcludedAlbumItemBase({ album, artist, onRestore, colors }: ExcludedAlbumItemProps) {
    const { t } = useTranslation();

    return (
        <View style={styles.itemRow}>
            <View style={styles.imageContainer}>
                {album.coverUrl ? (
                    <Image source={{ uri: album.coverUrl }} style={styles.coverImage} contentFit="cover" />
                ) : (
                    <View style={[styles.placeholderCover, { backgroundColor: colors.overlayAlpha05 }]}>
                        <Ionicons name="disc-outline" size={24} color={colors.textSecondary} />
                    </View>
                )}
            </View>
            <View style={styles.itemInfo}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                    {album.title}
                </Text>
                <Text style={styles.itemSubtitle} numberOfLines={1}>
                    {artist?.name || t('actions.unknown', 'Desconocido')}
                </Text>
            </View>
            <TouchableOpacity
                style={[styles.restoreButton, { backgroundColor: colors.accentAlpha10 }]}
                onPress={() => onRestore(album)}
                activeOpacity={0.7}
            >
                <Ionicons name="refresh-outline" size={16} color={colors.accent} />
                <Text style={[styles.restoreButtonText, { color: colors.accent }]}>
                    {t('settings.restore', 'Reincluir')}
                </Text>
            </TouchableOpacity>
        </View>
    );
});

interface ExcludedTrackItemProps {
    readonly track: Track;
    readonly album?: Album | null;
    readonly artists?: Artist[];
    readonly onRestore: (track: Track) => void;
    readonly colors: any;
}

const ExcludedTrackItem = withObservables(['track'], ({ track }: { track: Track }) => ({
    track: track.observe(),
    album: track.album.observe().pipe(catchError(() => of(null))),
    artists: track.queryCollaborators.observe().pipe(catchError(() => of([]))) as any,
}))(function ExcludedTrackItemBase({ track, album, artists, onRestore, colors }: ExcludedTrackItemProps) {
    const { t } = useTranslation();
    const artistName = artists && artists.length > 0 ? artists.map(a => a.name).join(', ') : t('actions.unknown', 'Desconocido');

    return (
        <View style={styles.itemRow}>
            <View style={styles.imageContainer}>
                {album?.coverUrl ? (
                    <Image source={{ uri: album.coverUrl }} style={styles.coverImage} contentFit="cover" />
                ) : (
                    <View style={[styles.placeholderCover, { backgroundColor: colors.overlayAlpha05 }]}>
                        <Ionicons name="musical-notes-outline" size={24} color={colors.textSecondary} />
                    </View>
                )}
            </View>
            <View style={styles.itemInfo}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                    {track.title}
                </Text>
                <Text style={styles.itemSubtitle} numberOfLines={1}>
                    {artistName}
                </Text>
            </View>
            <TouchableOpacity
                style={[styles.restoreButton, { backgroundColor: colors.accentAlpha10 }]}
                onPress={() => onRestore(track)}
                activeOpacity={0.7}
            >
                <Ionicons name="refresh-outline" size={16} color={colors.accent} />
                <Text style={[styles.restoreButtonText, { color: colors.accent }]}>
                    {t('settings.restore', 'Reincluir')}
                </Text>
            </TouchableOpacity>
        </View>
    );
});

interface SettingsShuffleProps {
    readonly excludedTracks: Track[];
    readonly excludedAlbums: Album[];
}

function SettingsShuffleContent({ excludedTracks, excludedAlbums }: SettingsShuffleProps) {
    const { t } = useTranslation();
    const { colors } = useAppTheme();
    const [activeTab, setActiveTab] = useState<'albums' | 'songs'>('albums');
    const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE);

    const shuffleOnQueueEnd = useSettingsStore(state => state.shuffleOnQueueEnd);
    const setShuffleOnQueueEnd = useSettingsStore(state => state.setShuffleOnQueueEnd);
    const showGlobalShuffle = useSettingsStore(state => state.showGlobalShuffle);
    const setShowGlobalShuffle = useSettingsStore(state => state.setShowGlobalShuffle);

    const handleTabChange = useCallback((tab: 'albums' | 'songs') => {
        setActiveTab(tab);
        setDisplayLimit(PAGE_SIZE);
    }, []);

    const handleRestoreAlbum = useCallback(async (album: Album) => {
        try {
            await ShuffleService.includeAlbum(album);
            useToastStore.getState().showToast(t('toasts.album_included_in_shuffle'), 'shuffle');
        } catch (e) {
            console.error('Error reincluyendo álbum en aleatorio:', e);
        }
    }, [t]);

    const handleRestoreTrack = useCallback(async (track: Track) => {
        try {
            await ShuffleService.includeTrack(track);
            useToastStore.getState().showToast(t('toasts.included_in_shuffle'), 'shuffle');
        } catch (e) {
            console.error('Error reincluyendo track en aleatorio:', e);
        }
    }, [t]);

    const handleRestoreAllAlbums = useCallback(() => {
        Alert.alert(
            t('settings.restore_all_albums_title', 'Reincluir álbumes'),
            t('settings.restore_all_albums_confirm', '¿Deseas reincluir todos los álbumes excluidos en la reproducción aleatoria?'),
            [
                { text: t('actions.cancel', 'Cancelar'), style: 'cancel' },
                {
                    text: t('settings.restore', 'Reincluir'),
                    onPress: async () => {
                        for (const album of excludedAlbums) {
                            await ShuffleService.includeAlbum(album);
                        }
                        useToastStore.getState().showToast(t('toasts.album_included_in_shuffle'), 'shuffle');
                    },
                },
            ]
        );
    }, [t, excludedAlbums]);

    const handleRestoreAllTracks = useCallback(() => {
        Alert.alert(
            t('settings.restore_all_songs_title', 'Reincluir canciones'),
            t('settings.restore_all_songs_confirm', '¿Deseas reincluir todas las canciones excluidas en la reproducción aleatoria?'),
            [
                { text: t('actions.cancel', 'Cancelar'), style: 'cancel' },
                {
                    text: t('settings.restore', 'Reincluir'),
                    onPress: async () => {
                        await ShuffleService.batchSetTracksExclusion(excludedTracks, false);
                        useToastStore.getState().showToast(t('toasts.batch_included_in_shuffle'), 'shuffle');
                    },
                },
            ]
        );
    }, [t, excludedTracks]);

    const currentCount = activeTab === 'albums' ? excludedAlbums.length : excludedTracks.length;
    const currentData = activeTab === 'albums' ? excludedAlbums : excludedTracks;

    const visibleData = useMemo(() => {
        return currentData.slice(0, displayLimit);
    }, [currentData, displayLimit]);

    const hasMore = displayLimit < currentData.length;

    const handleLoadMore = useCallback(() => {
        if (displayLimit < currentData.length) {
            setDisplayLimit(prev => Math.min(prev + PAGE_SIZE, currentData.length));
        }
    }, [displayLimit, currentData.length]);

    const renderItem = useCallback(({ item }: { item: Album | Track }) => {
        if (activeTab === 'albums') {
            return (
                <ExcludedAlbumItem
                    album={item as Album}
                    onRestore={handleRestoreAlbum}
                    colors={colors}
                />
            );
        }
        return (
            <ExcludedTrackItem
                track={item as Track}
                onRestore={handleRestoreTrack}
                colors={colors}
            />
        );
    }, [activeTab, handleRestoreAlbum, handleRestoreTrack, colors]);

    const renderHeader = useMemo(() => (
        <View>
            {/* General Options Card */}
            <View style={styles.sectionCard}>
                <Text style={styles.cardHeaderTitle}>
                    {t('settings.shuffle_general_title', 'Opciones de aleatorio')}
                </Text>

                {/* Toggle Shuffle on Queue End */}
                <View style={styles.settingRow}>
                    <View style={{ flex: 1, paddingRight: 15 }}>
                        <Text style={styles.settingLabel}>
                            {t('settings.shuffle_on_queue_end', 'Reproducción aleatoria al acabar')}
                        </Text>
                        <Text style={styles.settingDescription}>
                            {t('settings.shuffle_on_queue_end_desc', 'Inicia canciones aleatorias al finalizar la cola actual')}
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

                <View style={styles.separator} />

                {/* Toggle Show Global Shuffle */}
                <View style={styles.settingRow}>
                    <View style={{ flex: 1, paddingRight: 15 }}>
                        <Text style={styles.settingLabel}>
                            {t('settings.show_global_shuffle', 'Botón aleatorio en Inicio')}
                        </Text>
                        <Text style={styles.settingDescription}>
                            {t('settings.show_global_shuffle_desc', 'Muestra el botón destacado de reproducción aleatoria en la pantalla de Inicio')}
                        </Text>
                    </View>
                    <Switch
                        value={showGlobalShuffle}
                        onValueChange={setShowGlobalShuffle}
                        trackColor={{ false: '#282828', true: colors.accent }}
                        thumbColor={showGlobalShuffle ? '#FFFFFF' : '#888888'}
                        ios_backgroundColor="#282828"
                    />
                </View>
            </View>

            {/* Exclusions Section Header & Tabs */}
            <View style={styles.exclusionsHeaderCard}>
                <Text style={styles.cardHeaderTitle}>
                    {t('settings.excluded_from_shuffle_title', 'Excluidos de la reproducción aleatoria')}
                </Text>
                <Text style={styles.sectionDescription}>
                    {t('settings.excluded_from_shuffle_desc', 'Los siguientes elementos no se reproducirán en el aleatorio global ni al finalizar la cola.')}
                </Text>

                {/* Pill Tab Selectors - matching LibraryScreen and Activity tabs */}
                <View style={styles.tabsContainer}>
                    <TouchableOpacity
                        style={[
                            styles.tabButton,
                            activeTab === 'albums' && { backgroundColor: colors.accent },
                        ]}
                        onPress={() => handleTabChange('albums')}
                        activeOpacity={0.75}
                    >
                        <Text
                            style={[
                                styles.tabText,
                                activeTab === 'albums' && { color: colors.onAccent || '#FFFFFF' },
                            ]}
                        >
                            {t('library.albums', 'Álbumes')} ({excludedAlbums.length})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.tabButton,
                            activeTab === 'songs' && { backgroundColor: colors.accent },
                        ]}
                        onPress={() => handleTabChange('songs')}
                        activeOpacity={0.75}
                    >
                        <Text
                            style={[
                                styles.tabText,
                                activeTab === 'songs' && { color: colors.onAccent || '#FFFFFF' },
                            ]}
                        >
                            {t('library.songs', 'Canciones')} ({excludedTracks.length})
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Bulk restore button if multiple items */}
                {currentCount > 1 && (
                    <View style={styles.bulkActionRow}>
                        <TouchableOpacity
                            style={[styles.restoreAllButton, { backgroundColor: colors.accentAlpha10 }]}
                            onPress={activeTab === 'albums' ? handleRestoreAllAlbums : handleRestoreAllTracks}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="refresh-outline" size={16} color={colors.accent} />
                            <Text style={[styles.restoreAllButtonText, { color: colors.accent }]}>
                                {activeTab === 'albums'
                                    ? t('settings.restore_all_albums', 'Reincluir todos los álbumes')
                                    : t('settings.restore_all_songs', 'Reincluir todas las canciones')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    ), [
        t,
        colors,
        shuffleOnQueueEnd,
        setShuffleOnQueueEnd,
        showGlobalShuffle,
        setShowGlobalShuffle,
        activeTab,
        excludedAlbums.length,
        excludedTracks.length,
        currentCount,
        handleTabChange,
        handleRestoreAllAlbums,
        handleRestoreAllTracks,
    ]);

    const renderEmpty = useMemo(() => (
        <View style={styles.emptyState}>
            <Ionicons
                name={activeTab === 'albums' ? 'disc-outline' : 'musical-notes-outline'}
                size={44}
                color="#555555"
            />
            <Text style={styles.emptyText}>
                {activeTab === 'albums'
                    ? t('settings.no_excluded_albums', 'No hay álbumes excluidos de la reproducción aleatoria')
                    : t('settings.no_excluded_songs_shuffle', 'No hay canciones excluidas de la reproducción aleatoria')}
            </Text>
            <Text style={styles.emptySubtext}>
                {activeTab === 'albums'
                    ? t('settings.no_excluded_albums_hint', 'Puedes excluir un álbum desde su menú de opciones.')
                    : t('settings.no_excluded_songs_hint', 'Puedes excluir canciones desde el menú de la canción o selección por lote.')}
            </Text>
        </View>
    ), [activeTab, t]);

    const renderFooter = useMemo(() => {
        if (!hasMore) return <View style={{ height: 20 }} />;
        return (
            <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.accent} />
            </View>
        );
    }, [hasMore, colors.accent]);

    return (
        <ScreenHeaderLayout title={t('settings.shuffle_title', 'Reproducción aleatoria')}>
            {({ headerHeight, bottomPadding }) => (
                <FlashList
                    data={visibleData}
                    keyExtractor={(item) => (item ? item.id : '')}
                    renderItem={renderItem}
                    ListHeaderComponent={renderHeader}
                    ListEmptyComponent={renderEmpty}
                    ListFooterComponent={renderFooter}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    extraData={activeTab}
                    contentContainerStyle={[
                        styles.scrollContent,
                        {
                            paddingTop: headerHeight + 20,
                            paddingBottom: bottomPadding + 20,
                        },
                    ]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                />
            )}
        </ScreenHeaderLayout>
    );
}

const ObservableSettingsShuffleScreen = withObservables([], () => ({
    excludedTracks: database.collections
        .get<Track>('tracks')
        .query(Q.where('is_excluded_from_shuffle', true))
        .observe(),
    excludedAlbums: database.collections
        .get<Album>('albums')
        .query(Q.where('is_excluded_from_shuffle', true))
        .observe(),
}))(SettingsShuffleContent);

export default function SettingsShuffleScreen() {
    return <ObservableSettingsShuffleScreen />;
}

const styles = StyleSheet.create({
    scrollContent: {
        paddingHorizontal: 20,
    },
    sectionCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
    },
    exclusionsHeaderCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 12,
    },
    cardHeaderTitle: {
        fontSize: 18,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    sectionDescription: {
        fontSize: 12,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        color: '#888888',
        marginBottom: 16,
        lineHeight: 16,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    settingLabel: {
        fontSize: 16,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        color: '#FFFFFF',
    },
    settingDescription: {
        fontSize: 12,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        color: '#888888',
        marginTop: 4,
        lineHeight: 16,
    },
    separator: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        marginVertical: 4,
    },
    tabsContainer: {
        flexDirection: 'row',
        gap: 10,
    },
    tabButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#282828',
    },
    tabText: {
        fontSize: 13,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        color: '#B3B3B3',
    },
    bulkActionRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 14,
    },
    restoreAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 15,
    },
    restoreAllButtonText: {
        fontSize: 12,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.03)',
    },
    imageContainer: {
        width: 44,
        height: 44,
        borderRadius: 8,
        overflow: 'hidden',
        marginRight: 12,
    },
    coverImage: {
        width: '100%',
        height: '100%',
    },
    placeholderCover: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemInfo: {
        flex: 1,
        marginRight: 10,
    },
    itemTitle: {
        fontSize: 15,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        color: '#FFFFFF',
    },
    itemSubtitle: {
        fontSize: 12,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        color: '#888888',
        marginTop: 2,
    },
    restoreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 15,
        gap: 4,
    },
    restoreButtonText: {
        fontSize: 12,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    footerLoader: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 32,
        gap: 8,
    },
    emptyText: {
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        color: '#888888',
        textAlign: 'center',
    },
    emptySubtext: {
        fontSize: 12,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        color: '#666666',
        textAlign: 'center',
        paddingHorizontal: 20,
        lineHeight: 16,
    },
});
