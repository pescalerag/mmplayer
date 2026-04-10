import { Ionicons } from '@expo/vector-icons';
import withObservables from '@nozbe/with-observables';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Album from '../database/models/Album';
import Artist from '../database/models/Artist';
import Track from '../database/models/Track';
import { TopMatch } from '../hooks/useMusicSearch';
import BlurredBackground from './BlurredBackground';

interface TopMatchCardProps {
    match: TopMatch;
    onPress: () => void;
}

interface LayoutProps {
    title: string;
    subtitle: string;
    imageUrl: string | null;
    type: 'artist' | 'album' | 'track';
    onPress: () => void;
}

// --- SHARED LAYOUT ---
const TopMatchCardLayout = ({ title, subtitle, imageUrl, type, onPress }: LayoutProps) => {
    return (
        <TouchableOpacity style={styles.container} activeOpacity={0.8} onPress={onPress}>
            {/* Fondo con la imagen usando BlurredBackground */}
            <BlurredBackground 
                imageUrl={imageUrl} 
                blurIntensity={60} 
                gradientColors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)']}
            />

            <View style={styles.content}>
                <View style={styles.mainInfo}>
                    {/* Miniatura cuadrada o redonda según el tipo */}
                    {imageUrl ? (
                        <Image 
                            source={{ uri: imageUrl }} 
                            style={[
                                styles.thumbnail, 
                                type === 'artist' ? { borderRadius: 40 } : { borderRadius: 8 }
                            ]} 
                        />
                    ) : (
                        <View style={[styles.thumbnail, styles.placeholder]}>
                            <Ionicons name="musical-notes" size={24} color="#666" />
                        </View>
                    )}

                    <View style={styles.textContainer}>
                        <Text style={styles.title} numberOfLines={2}>{title}</Text>
                        <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
};

// --- SPECIALIZED COMPONENTS ---

const TopMatchArtistCard = withObservables(['artist'], ({ artist }: { artist: Artist }) => ({
    artist: artist.observe(),
}))(({ artist, onPress }: { artist: Artist; onPress: () => void }) => (
    <TopMatchCardLayout
        title={artist.name}
        subtitle="Artista"
        imageUrl={artist.imageUrl}
        type="artist"
        onPress={onPress}
    />
));

const TopMatchAlbumCard = withObservables(['album'], ({ album }: { album: Album }) => ({
    album: album.observe(),
    artist: album.artist.observe(),
}))(({ album, artist, onPress }: { album: Album; artist: Artist; onPress: () => void }) => (
    <TopMatchCardLayout
        title={album.title}
        subtitle={`Álbum • ${artist?.name || 'Desconocido'}`}
        imageUrl={album.coverUrl}
        type="album"
        onPress={onPress}
    />
));

const TopMatchTrackCard = withObservables(['track'], ({ track }: { track: Track }) => ({
    track: track.observe(),
    album: track.album.observe(),
    collaborators: track.queryCollaborators.observe() as any,
}))(({ track, album, collaborators, onPress }: { track: Track; album: Album; collaborators: Artist[]; onPress: () => void }) => {
    const artistNames = collaborators.length > 0 
        ? collaborators.map(a => a.name).join(', ') 
        : 'Desconocido';
    
    return (
        <TopMatchCardLayout
            title={track.title}
            subtitle={`Canción • ${artistNames}`}
            imageUrl={album?.coverUrl || null}
            type="track"
            onPress={onPress}
        />
    );
});

// --- MAIN ENTRY POINT ---
export default function TopMatchCard({ match, onPress }: TopMatchCardProps) {
    if (!match) return null;

    switch (match.type) {
        case 'artist':
            return <TopMatchArtistCard artist={match.item as Artist} onPress={onPress} />;
        case 'album':
            return <TopMatchAlbumCard album={match.item as Album} onPress={onPress} />;
        case 'track':
            return <TopMatchTrackCard track={match.item as Track} onPress={onPress} />;
        default:
            return null;
    }
}

const styles = StyleSheet.create({
    container: {
        height: 140,
        marginHorizontal: 20,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 20,
        backgroundColor: '#1A1A1A',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    content: {
        flex: 1,
        padding: 16,
        justifyContent: 'center',
    },
    mainInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    thumbnail: {
        width: 64,
        height: 64,
        marginRight: 16,
    },
    placeholder: {
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 8,
    },
    textContainer: {
        flex: 1,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 22,
        fontFamily: 'Montserrat',
        fontWeight: '800',
        marginBottom: 4,
    },
    subtitle: {
        color: '#B3B3B3',
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '600',
    },
});
