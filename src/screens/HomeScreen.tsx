import { openAlbumMenu, openArtistMenu, openPlaylistMenu, openTrackMenu } from '@/store/useUIStore';
import { useAppTheme } from '@/hooks/useAppTheme';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { State } from 'react-native-track-player';
import { usePlaybackState } from '../hooks/usePlaybackState';
import { PlayingIndicator } from '../components/PlayingIndicator';
import { database } from '../database';
import { Q } from '@nozbe/watermelondb';
import Album from '../database/models/Album';
import Track from '../database/models/Track';
import Artist from '../database/models/Artist';
import { HistoryService } from '../services/HistoryService';


import { usePlayerStore } from '../store/usePlayerStore';

import { useSettingsStore } from '../store/useSettingsStore';

import { StatsWidget } from '../components/StatsWidget';
import { HorizontalCarousel } from '../components/HorizontalCarousel';
import { GlobalShuffleButton } from '../components/GlobalShuffleButton';
import { MediaCard } from '../components/MediaCard';
import { useStatsStore } from '../store/useStatsStore';

const { width } = Dimensions.get('window');

const RecentMediaCard = React.memo(({ item, isActuallyPlaying, activeTrack, onPress, onLongPress }: any) => {
    const { colors, fonts, layout, spacing, radii, fontWeights } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout, spacing, radii, fontWeights), [colors, fonts, layout, spacing, radii, fontWeights]);
    const [imageError, setImageError] = React.useState(false);

    React.useEffect(() => {
        setImageError(false);
    }, [item.id, item.imageUrl]);

    const isCurrentTrack = item.type === 'track' && activeTrack?.id === item.id;
    const isActive = isCurrentTrack;

    const showImage = Boolean(item.imageUrl && item.imageUrl !== 'null' && item.imageUrl.trim() !== '') && !imageError;

    const handlePress = React.useCallback(() => onPress(item), [item, onPress]);
    const handleLongPress = React.useCallback(() => onLongPress?.(item), [item, onLongPress]);

    return (
        <TouchableOpacity
            style={[styles.gridCard, isActive && styles.gridCardActive]}
            onPress={handlePress}
            onLongPress={handleLongPress}
            delayLongPress={300}
            activeOpacity={0.7}
        >
            {showImage ? (
                <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.gridImage}
                    contentFit="cover"
                    onError={() => setImageError(true)}
                />
            ) : (
                <View style={[styles.gridImage, styles.placeholderGrid]}>
                    <Ionicons name={item.type === 'album' ? 'albums' : 'musical-note'} size={24} color={colors.textSecondary} />
                </View>
            )}
            <View style={styles.gridInfo}>
                <Text style={[styles.gridTitle, isActive && styles.gridTitleActive]} numberOfLines={2}>
                    {item.title}
                </Text>
                {isCurrentTrack && (
                    <PlayingIndicator isPaused={!isActuallyPlaying} color={colors.accentLight} />
                )}
            </View>
        </TouchableOpacity>
    );
});
RecentMediaCard.displayName = 'RecentMediaCard';

export default function HomeScreen() {
    const { colors, fonts, layout, spacing, radii, fontWeights } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout, spacing, radii, fontWeights), [colors, fonts, layout, spacing, radii, fontWeights]);
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<any>();
    const { t } = useTranslation();
    const [headerHeight, setHeaderHeight] = React.useState(100);

    const getGreetingKey = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'home.welcome_morning';
        if (hour < 20) return 'home.welcome_afternoon';
        return 'home.welcome_evening';
    };

    const recentMediaRaw = usePlayerStore(state => state.recentMedia);
    const recentMedia = React.useMemo(() => recentMediaRaw || [], [recentMediaRaw]);
    const recentPlaylistsRaw = usePlayerStore(state => state.recentPlaylists);
    const recentPlaylists = React.useMemo(() => recentPlaylistsRaw || [], [recentPlaylistsRaw]);
    const userAlias = useSettingsStore(state => state.userAlias);

    const homeSectionsOrder = useSettingsStore(state => state.homeSectionsOrder);
    const homeSectionsVisibility = useSettingsStore(state => state.homeSectionsVisibility);
    const showGlobalShuffle = useSettingsStore(state => state.showGlobalShuffle);

    const activeTrack = usePlayerStore(state => state.activeTrack);
    const playbackStateRN = usePlaybackState();
    const isActuallyPlaying = playbackStateRN.state === State.Playing || playbackStateRN.state === State.Buffering;

    const [recentlyAdded, setRecentlyAdded] = React.useState<any[]>([]);
    const [mostPlayed, setMostPlayed] = React.useState<any[]>([]);
    const [explore, setExplore] = React.useState<any[]>([]);

    const fetchHomeData = async () => {
        try {
            // Fetch recently added albums
            const addedAlbums = await database.collections
                .get<Album>('albums')
                .query(Q.sortBy('id', Q.desc), Q.take(10))
                .fetch();
            
            const mappedAdded = await Promise.all(addedAlbums.map(async (album) => {
                const artist = await album.artist.fetch();
                return {
                    id: album.id,
                    type: 'album' as const,
                    title: album.title,
                    subtitle: artist?.name || 'Artista desconocido',
                    imageUrl: album.coverUrl || '',
                };
            }));
            setRecentlyAdded(mappedAdded);

            // Fetch most played tracks
            const popularTracks = await HistoryService.getMostPlayedTracks(10);
            const mappedPopular = await Promise.all(popularTracks.map(async (track) => {
                const artist = await track.artist.fetch();
                const album = await track.album.fetch();
                return {
                    id: track.id,
                    type: 'track' as const,
                    title: track.title,
                    subtitle: artist?.name || 'Artista desconocido',
                    imageUrl: album?.coverUrl || '',
                };
            }));
            setMostPlayed(mappedPopular);

            // Fetch explore albums (Random)
            const allAlbumIds = await database.collections.get<Album>('albums').query().fetchIds();
            if (allAlbumIds.length > 0) {
                const shuffled = [...allAlbumIds].sort(() => Math.random() - 0.5);
                const randomIds = shuffled.slice(0, 6);
                const randomAlbums = await database.collections
                    .get<Album>('albums')
                    .query(Q.where('id', Q.oneOf(randomIds)))
                    .fetch();
                
                const mappedExplore = await Promise.all(randomAlbums.map(async (album) => {
                    const artist = await album.artist.fetch();
                    return {
                        id: album.id,
                        type: 'album' as const,
                        title: album.title,
                        subtitle: artist?.name || 'Artista desconocido',
                        imageUrl: album.coverUrl || '',
                    };
                }));
                setExplore(mappedExplore);
            }
        } catch (e) {
            console.error("Error loading modular home data:", e);
        }
    };

    useEffect(() => {
        HistoryService.initializeDefaultsIfNeeded();
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            fetchHomeData();
            useStatsStore.getState().fetchStats();
        }, [])
    );

    const handleMediaPress = React.useCallback(async (item: any) => {
        if (item.type === 'album') {
            navigation.navigate('AlbumDetail', { albumId: item.id });
        } else if (item.type === 'artist') {
            navigation.navigate('ArtistDetail', { artistId: item.id });
        } else if (item.type === 'track') {
            try {
                const track = await database.get<Track>('tracks').find(item.id);
                usePlayerStore.getState().playSingleTrack(track, 'home-recents');
            } catch (error) {
                console.error('Error al reproducir track reciente:', error);
            }
        }
    }, [navigation]);

    const handleMediaLongPress = React.useCallback(async (item: any) => {
        try {
            if (item.type === 'album') {
                const album = await database.get<Album>('albums').find(item.id);
                openAlbumMenu(album);
            } else if (item.type === 'artist') {
                const artist = await database.get<Artist>('artists').find(item.id);
                openArtistMenu(artist);
            } else if (item.type === 'track') {
                const track = await database.get<Track>('tracks').find(item.id);
                openTrackMenu(track, {
                    album: (albumId: string) => navigation.navigate('AlbumDetail', { albumId }),
                    artist: (artistId: string) => navigation.navigate('ArtistDetail', { artistId })
                });
            }
        } catch (error) {
            console.error('Error al abrir menu contextual de reciente:', error);
        }
    }, [navigation]);

    const handlePlaylistPress = React.useCallback((id: string) => {
        if (id === 'favorites') {
            navigation.navigate('FavoritesDetail');
        } else {
            navigation.navigate('PlaylistDetail', { playlistId: id });
        }
    }, [navigation]);

    const handlePlaylistLongPress = React.useCallback((id: string) => {
        const playlist = recentPlaylists.find(p => p.id === id);
        if (playlist) {
            openPlaylistMenu(playlist as any);
        }
    }, [recentPlaylists]);

    const handleCardPress = React.useCallback((id: string, type: 'track' | 'album' | 'playlist' | 'artist') => {
        if (type === 'playlist') {
            handlePlaylistPress(id);
        } else {
            handleMediaPress({ id, type });
        }
    }, [handlePlaylistPress, handleMediaPress]);

    const handleCardLongPress = React.useCallback((id: string, type: 'track' | 'album' | 'playlist' | 'artist') => {
        if (type === 'playlist') {
            handlePlaylistLongPress(id);
        } else {
            handleMediaLongPress({ id, type });
        }
    }, [handlePlaylistLongPress, handleMediaLongPress]);

    return (
        <View style={styles.container}>
            {/* CAPA DEL HUMO */}
            <LinearGradient
                colors={[
                    '#000000',
                    'rgba(0, 0, 0, 0.95)',
                    'rgba(0, 0, 0, 0.8)',
                    'transparent'
                ]}
                locations={[0, 0.45, 0.8, 1]}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: headerHeight + 30,
                    zIndex: 1,
                }}
                pointerEvents="none"
            />

            {/* CAPA DE ILUMINACIÓN MORADA */}
            <LinearGradient
                colors={[colors.accentAlpha20, "transparent"]}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200, zIndex: 2 }}
                pointerEvents="none"
            />

            {/* CAPA DE LA INTERFAZ (GREETING HEADER) */}
            <View
                onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    paddingTop: insets.top + 10,
                    paddingBottom: 10,
                    zIndex: 10,
                }}
            >
                <Text style={[styles.welcomeText, { marginBottom: 0 }]}>
                    {t(getGreetingKey())}{userAlias ? `, ${userAlias}` : ''}
                </Text>
            </View>

            {/* CAPA DE CONTENIDO */}
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingTop: headerHeight + 20, paddingBottom: 200 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Modular Sections Render */}
                {homeSectionsOrder.map((section) => {
                    if (!homeSectionsVisibility[section]) return null;

                    switch (section) {
                        case 'stats':
                            return <StatsWidget key="stats" />;

                        case 'recent_media':
                            return (
                                <View key="recent_media" style={{ marginVertical: 12 }}>
                                    <Text style={styles.sectionTitle}>
                                        {t('home.recently_played') || "Escuchado recientemente"}
                                    </Text>
                                    {recentMedia.length > 0 ? (
                                        <View style={styles.gridContainer}>
                                            {recentMedia.map((item) => (
                                                <RecentMediaCard
                                                    key={`${item.id}-${item.type}`}
                                                    item={item}
                                                    isActuallyPlaying={isActuallyPlaying}
                                                    activeTrack={activeTrack}
                                                    onPress={handleMediaPress}
                                                    onLongPress={handleMediaLongPress}
                                                />
                                            ))}
                                        </View>
                                    ) : (
                                        <View style={styles.emptyState}>
                                            <Text style={styles.emptyText}>{t('home.empty_recents')}</Text>
                                        </View>
                                    )}
                                </View>
                            );

                        case 'recent_playlists':
                            return (
                                <HorizontalCarousel
                                    key="recent_playlists"
                                    title={t('home.my_playlists') || "Mis listas de reproducción"}
                                    data={recentPlaylists}
                                    emptyText={t('home.empty_playlists')}
                                    renderItem={({ item }) => (
                                        <MediaCard
                                            id={item.id}
                                            type="playlist"
                                            title={item.id === 'favorites' ? t('home.your_favourites') : item.name}
                                            subtitle={item.id === 'favorites' ? t('home.most_liked_songs') : (item.description || '')}
                                            customCoverUrl={item.imageUrl}
                                            onPress={handleCardPress}
                                            onLongPress={handleCardLongPress}
                                        />
                                    )}
                                    keyExtractor={(item) => `recent-playlist-${item.id}`}
                                />
                            );

                        case 'recently_added':
                            return (
                                <HorizontalCarousel
                                    key="recently_added"
                                    title={t('home.recently_added_albums') || "Álbumes añadidos recientemente"}
                                    data={recentlyAdded}
                                    emptyText={t('home.empty_added') || "No hay álbumes añadidos"}
                                    renderItem={({ item }) => (
                                        <MediaCard
                                            id={item.id}
                                            type="album"
                                            title={item.title}
                                            subtitle={item.subtitle}
                                            imageUrl={item.imageUrl}
                                            onPress={handleCardPress}
                                            onLongPress={handleCardLongPress}
                                        />
                                    )}
                                    keyExtractor={(item) => `added-album-${item.id}`}
                                />
                            );

                        case 'most_played':
                            return (
                                <HorizontalCarousel
                                    key="most_played"
                                    title={t('home.most_played_songs') || "Tus más escuchadas"}
                                    data={mostPlayed}
                                    emptyText={t('home.empty_most_played') || "Escucha música para ver tus canciones más escuchadas"}
                                    renderItem={({ item }) => (
                                        <MediaCard
                                            id={item.id}
                                            type="track"
                                            title={item.title}
                                            subtitle={item.subtitle}
                                            imageUrl={item.imageUrl}
                                            onPress={handleCardPress}
                                            onLongPress={handleCardLongPress}
                                        />
                                    )}
                                    keyExtractor={(item) => `most-played-${item.id}`}
                                />
                            );

                        case 'explore':
                            return (
                                <HorizontalCarousel
                                    key="explore"
                                    title={t('home.explore_albums') || "Explorar álbumes aleatorios"}
                                    data={explore}
                                    emptyText={t('home.empty_explore') || "No hay álbumes para explorar"}
                                    renderItem={({ item }) => (
                                        <MediaCard
                                            id={item.id}
                                            type="album"
                                            title={item.title}
                                            subtitle={item.subtitle}
                                            imageUrl={item.imageUrl}
                                            onPress={handleCardPress}
                                            onLongPress={handleCardLongPress}
                                        />
                                    )}
                                    keyExtractor={(item) => `explore-album-${item.id}`}
                                />
                            );

                        default:
                            return null;
                    }
                })}

                {/* Global Shuffle Button at the bottom */}
                {showGlobalShuffle && <GlobalShuffleButton />}
            </ScrollView>
        </View>
    );
}

const DEFAULT_SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
const DEFAULT_RADII = { sm: 4, md: 8, lg: 12, full: 9999 };
const DEFAULT_FONT_WEIGHTS = { regular: '400', semiBold: '600', bold: '700' };

const getStyles = (colors: any, fonts: any, layout: any, spacing: any = DEFAULT_SPACING, radii: any = DEFAULT_RADII, fontWeights: any = DEFAULT_FONT_WEIGHTS) => {
    const horizPadding = spacing.lg || 20;
    const gapSize = spacing.sm || 8;
    const computedItemWidth = (width - (horizPadding * 2) - gapSize) / 2;

    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        welcomeText: {
            color: colors.text,
            fontSize: 26,
            fontFamily: fonts.regular,
            fontWeight: '800',
            paddingHorizontal: horizPadding,
            marginBottom: horizPadding,
            letterSpacing: -0.5,
        },
        sectionTitle: {
            color: colors.text,
            fontSize: 20,
            fontFamily: fonts.regular,
            fontWeight: fontWeights.bold,
            paddingHorizontal: horizPadding,
            marginTop: 0,
            marginBottom: 12,
        },
        gridContainer: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            paddingHorizontal: horizPadding,
            gap: gapSize,
            justifyContent: 'space-between'
        },
        gridCard: {
            width: computedItemWidth,
            height: 56,
            backgroundColor: colors.cardBackground,
            borderRadius: radii.md || 8,
            flexDirection: 'row',
            alignItems: 'center',
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: 'transparent',
        },
        gridCardActive: {
            backgroundColor: colors.accentAlpha18,
            borderWidth: 1,
            borderColor: colors.accentLightAlpha35,
        },
        gridImage: {
            width: 56,
            height: 56,
            backgroundColor: colors.cardBackground
        },
        placeholderGrid: {
            justifyContent: 'center',
            alignItems: 'center',
        },
        gridInfo: {
            flex: 1,
            paddingHorizontal: 10,
            justifyContent: 'center',
        },
        gridTitle: {
            color: colors.text,
            fontSize: 12,
            fontFamily: fonts.regular,
            fontWeight: fontWeights.bold,
            lineHeight: 16,
        },
        gridTitleActive: {
            color: colors.accentLight,
        },
        emptyState: {
            paddingHorizontal: horizPadding,
            paddingVertical: spacing.sm || 10,
        },
        emptyText: {
            color: colors.textSecondary,
            fontSize: 14,
            fontFamily: fonts.regular,
            fontWeight: fontWeights.bold,
        },
    });
};