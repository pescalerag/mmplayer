import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { State, usePlaybackState } from 'react-native-track-player';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayingIndicator } from '../components/PlayingIndicator';
import RecentPlaylistCard from '../components/RecentPlaylistCard';
import { database } from '../database';
import Track from '../database/models/Track';
import Album from '../database/models/Album';
import Artist from '../database/models/Artist';
import { usePlayerStore } from '../store/usePlayerStore';
import { HistoryService } from '../services/HistoryService';
import { useTrackMenuStore } from '../store/useTrackMenuStore';
import { useAlbumMenuStore } from '../store/useAlbumMenuStore';
import { useArtistMenuStore } from '../store/useArtistMenuStore';
import { usePlaylistMenuStore } from '../store/usePlaylistMenuStore';
import Constants from 'expo-constants';
import { useSettingsStore } from '../store/useSettingsStore';

const { width } = Dimensions.get('window');
const gridItemWidth = (width - 48) / 2;

const RecentMediaCard = ({ item, isActuallyPlaying, activeTrack, onPress, onLongPress }: any) => {
    const [imageError, setImageError] = React.useState(false);
    
    React.useEffect(() => {
        setImageError(false);
    }, [item.id, item.imageUrl]);

    const isCurrentTrack = item.type === 'track' && activeTrack?.id === item.id;
    const isActive = isCurrentTrack;
    
    const showImage = Boolean(item.imageUrl && item.imageUrl !== 'null' && item.imageUrl.trim() !== '') && !imageError;

    return (
        <TouchableOpacity
            style={[styles.gridCard, isActive && styles.gridCardActive]}
            onPress={() => onPress(item)}
            onLongPress={() => onLongPress?.(item)}
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
                    <Ionicons name={item.type === 'album' ? 'albums' : 'musical-note'} size={24} color="#B3B3B3" />
                </View>
            )}
            <View style={styles.gridInfo}>
                <Text style={[styles.gridTitle, isActive && styles.gridTitleActive]} numberOfLines={2}>
                    {item.title}
                </Text>
                {isCurrentTrack && (
                    <PlayingIndicator isPaused={!isActuallyPlaying} color="#A78BFA" />
                )}
            </View>
        </TouchableOpacity>
    );
};

export default function HomeScreen() {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<any>();

    const recentMedia = usePlayerStore(state => state.recentMedia) || [];
    const recentPlaylists = usePlayerStore(state => state.recentPlaylists) || [];
    const activeTrack = usePlayerStore(state => state.activeTrack);

    // Modal logic moved to App.tsx
    useEffect(() => {
        HistoryService.initializeDefaultsIfNeeded();
    }, []);

    const playbackStateRN = usePlaybackState();
    const isActuallyPlaying = playbackStateRN.state === State.Playing || playbackStateRN.state === State.Buffering;

    const handleMediaPress = async (item: any) => {
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
    };

    const handleMediaLongPress = async (item: any) => {
        try {
            if (item.type === 'album') {
                const album = await database.get<Album>('albums').find(item.id);
                useAlbumMenuStore.getState().openMenu(album);
            } else if (item.type === 'artist') {
                const artist = await database.get<Artist>('artists').find(item.id);
                useArtistMenuStore.getState().openMenu(artist);
            } else if (item.type === 'track') {
                const track = await database.get<Track>('tracks').find(item.id);
                useTrackMenuStore.getState().openMenu(track, {
                    album: (albumId) => navigation.navigate('AlbumDetail', { albumId }),
                    artist: (artistId) => navigation.navigate('ArtistDetail', { artistId })
                });
            }
        } catch (error) {
            console.error('Error al abrir menu contextual de reciente:', error);
        }
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={["#8B5CF633", "transparent"]}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200 }}
            />
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
            >
            {/* Saludo Principal */}
            <Text style={styles.welcomeText}>Buenas tardes</Text>

            {/* SECCIÓN 1: Grid 2x3 de Recientes (Canciones y Álbumes) */}
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
                    <Text style={styles.emptyText}>Aquí aparecerá la música que reproduzcas.</Text>
                </View>
            )}

            {/* SECCIÓN 2: Playlists Recientes */}
            <Text style={styles.sectionTitle}>Tus Playlists</Text>

            {recentPlaylists.length > 0 ? (
                <View style={styles.playlistsContainer}>
                    {recentPlaylists.map((playlist, idx) => (
                        <RecentPlaylistCard
                            key={`${playlist.id}-${idx}`}
                            id={playlist.id}
                            name={playlist.name}
                            description={playlist.description}
                            customCoverUrl={(playlist as any).imageUrl}
                            onPress={() => {
                                if (playlist.id === 'favorites') {
                                    navigation.navigate('FavoritesDetail');
                                } else {
                                    navigation.navigate('PlaylistDetail', { playlistId: playlist.id });
                                }
                            }}
                            onLongPress={() => {
                                usePlaylistMenuStore.getState().openMenu(playlist as any);
                            }}
                        />
                    ))}
                </View>
            ) : (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>Aún no has escuchado ninguna playlist.</Text>
                </View>
            )}
        </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000', // Fondo negro puro
    },
    welcomeText: {
        color: '#FFFFFF',
        fontSize: 26,
        fontFamily: 'Montserrat',
        fontWeight: '800',
        paddingHorizontal: 20,
        marginBottom: 20,
        letterSpacing: -0.5,
    },
    sectionTitle: {
        color: '#FFFFFF',
        fontSize: 20,
        fontFamily: 'Montserrat',
        fontWeight: '800',
        paddingHorizontal: 20,
        marginTop: 32,
        marginBottom: 16,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 16,
        gap: 12,
        justifyContent: 'space-between'
    },
    gridCard: {
        width: gridItemWidth,
        height: 56,
        backgroundColor: '#282828',
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    gridCardActive: {
        backgroundColor: 'rgba(139, 92, 246, 0.18)',
        borderWidth: 1,
        borderColor: 'rgba(167, 139, 250, 0.35)',
    },
    gridImage: {
        width: 56,
        height: 56,
        backgroundColor: '#1E1E1E'
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
        color: '#FFFFFF',
        fontSize: 12,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        lineHeight: 16,
    },
    gridTitleActive: {
        color: '#A78BFA',
    },
    playlistsContainer: {
        paddingBottom: 20,
    },
    emptyState: {
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    emptyText: {
        color: '#A0A0A0',
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
});