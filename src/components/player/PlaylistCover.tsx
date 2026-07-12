import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { LinearGradient } from 'expo-linear-gradient';
import { database } from '../../database';
import PlaylistTrack from '../../database/models/PlaylistTrack';
import Playlist from '../../database/models/Playlist';
import { useAppTheme } from "@/hooks/useAppTheme";
import { SmartListService } from '../../services/SmartListService';

interface PlaylistCoverProps {
    readonly playlistId: string;
    readonly isFavorites?: boolean;
    readonly size?: number;
    readonly customCoverUrl?: string | null;
    readonly width?: number;
    readonly height?: number;
    readonly borderRadius?: number;
}

export default function PlaylistCover({
    playlistId,
    isFavorites = false,
    size = 120,
    customCoverUrl = null,
    width: propWidth,
    height: propHeight,
    borderRadius = 12,
}: Readonly<PlaylistCoverProps>) {
    const { colors, fonts, layout } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
    const [firstCover, setFirstCover] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const w = propWidth ?? size;
    const h = propHeight ?? size;

    useEffect(() => {
        if (isFavorites || customCoverUrl) {
            setLoading(false);
            return;
        }

        if (playlistId.startsWith('smart-list-')) {
            const loadSmartListCover = async () => {
                try {
                    const id = playlistId.replace('smart-list-', '');
                    const smartList = SmartListService.getSmartLists().find(l => l.id === id);
                    if (smartList) {
                        const tracks = await smartList.getTracks();
                        for (const track of tracks) {
                            const album = await track.album.fetch();
                            const url = album?.coverUrl;
                            if (url && url !== 'null' && url.trim() !== '') {
                                setFirstCover(url);
                                break;
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error al cargar portada de smart list en PlaylistCover:', e);
                } finally {
                    setLoading(false);
                }
            };
            loadSmartListCover();
            return;
        }

        const loadCover = async () => {
            try {
                try {
                    const playlist = await database.get<Playlist>('playlists').find(playlistId);
                    if (playlist?.coverCustomUrl && playlist.coverCustomUrl !== 'null') {
                        setFirstCover(playlist.coverCustomUrl);
                        setLoading(false);
                        return;
                    }
                } catch {
                    // Ignoramos si no se encuentra (ej: id 'favorites')
                }

                const pts = await database.collections.get<PlaylistTrack>('playlist_tracks')
                    .query(Q.where('playlist_id', playlistId), Q.sortBy('order', Q.asc))
                    .fetch();

                for (const pt of pts) {
                    const track = await pt.track.fetch();
                    if (track) {
                        const album = await track.album.fetch();
                        const url = album?.coverUrl;
                        if (url && url !== 'null' && url.trim() !== '') {
                            setFirstCover(url);
                            break; // Paramos con la primera cover real
                        }
                    }
                }
            } catch (e) {
                console.error('Error al cargar carátula para PlaylistCover:', e);
            } finally {
                setLoading(false);
            }
        };

        loadCover();
    }, [playlistId, isFavorites, customCoverUrl]);

    if (isFavorites) {
        return (
            <LinearGradient
                colors={['#7C3AED', '#4C1D95']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.container, { width: w, height: h, borderRadius }]}
            >
                <Ionicons name="heart" size={Math.min(w, h) * 0.45} color={colors.text} />
            </LinearGradient>
        );
    }

    if (customCoverUrl) {
        return (
            <Image
                source={{ uri: customCoverUrl }}
                style={[styles.container, { width: w, height: h, borderRadius }]}
                contentFit="cover"
                transition={200}
            />
        );
    }

    if (loading) {
        return (
            <View style={[styles.placeholder, { width: w, height: h, borderRadius }]}>
                <Ionicons name="musical-note" size={Math.min(w, h) * 0.35} color="#444" />
            </View>
        );
    }

    if (firstCover) {
        return (
            <Image
                source={{ uri: firstCover }}
                style={[styles.container, { width: w, height: h, borderRadius }]}
                contentFit="cover"
                transition={200}
            />
        );
    }

    // Sin canciones con portada → placeholder
    return (
        <LinearGradient
            colors={['#1A1A1A', '#0D0D0D']}
            style={[styles.placeholder, { width: w, height: h, borderRadius }]}
        >
            <Ionicons name="musical-note" size={Math.min(w, h) * 0.4} color="#555" />
        </LinearGradient>
    );
}

const getStyles = (colors: any, fonts: any, layout: any) => StyleSheet.create({
    container: {
        borderRadius: 12,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholder: {
        borderRadius: 12,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.cardBackground,
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
});
