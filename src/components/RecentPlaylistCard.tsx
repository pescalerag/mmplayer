import withObservables from '@nozbe/with-observables';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { database } from '../database';
import Playlist from '../database/models/Playlist';
import PlaylistCover from './PlaylistCover';

interface RecentPlaylistCardProps {
    id: string;
    name: string;
    description: string | null;
    customCoverUrl?: string | null;
    playlist?: Playlist | null;
    onPress: (id: string) => void;
    onLongPress?: (id: string) => void;
}

const { width } = Dimensions.get('window');

export const RecentPlaylistCardBase = React.memo(function RecentPlaylistCard({ id, name, description, customCoverUrl, playlist, onPress, onLongPress }: RecentPlaylistCardProps) {
    const { t } = useTranslation();
    const handlePress = React.useCallback(() => onPress(id), [id, onPress]);
    const handleLongPress = React.useCallback(() => onLongPress?.(id), [id, onLongPress]);

    const displayName = id === 'favorites' ? t('home.your_favourites') : (playlist?.name || name);
    const displayDescription = id === 'favorites'
        ? t('home.most_liked_songs')
        : (playlist?.description || description || t('actions.playlist_empty_desc'));

    return (
        <TouchableOpacity style={styles.card} onPress={handlePress} onLongPress={handleLongPress} delayLongPress={300} activeOpacity={0.8}>
            {/* Fondo con degradado oscuro de izquierda a derecha */}
            <LinearGradient
                colors={['#181818', 'rgba(24, 24, 24, 0.85)', 'rgba(24, 24, 24, 0.3)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientContainer}
            >
                <View style={styles.textSection}>
                    <Text style={styles.title} numberOfLines={1}>{displayName}</Text>
                    <Text style={styles.description} numberOfLines={2}>
                        {displayDescription}
                    </Text>
                </View>
            </LinearGradient>

            <View style={styles.imageSection}>
                <PlaylistCover playlistId={id} isFavorites={id === 'favorites'} width={90} height={90} borderRadius={0} customCoverUrl={customCoverUrl} />
            </View>
        </TouchableOpacity>
    );
});

const styles = StyleSheet.create({
    card: {
        width: width - 40,
        height: 90,
        backgroundColor: '#121212',
        borderRadius: 8,
        flexDirection: 'row',
        overflow: 'hidden',
        marginBottom: 12,
        alignSelf: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.04)',
    },
    gradientContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 16,
        zIndex: 2,
    },
    textSection: {
        width: '75%',
    },
    title: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    description: {
        color: '#B3B3B3',
        fontSize: 12,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        marginTop: 4,
        lineHeight: 16,
    },
    imageSection: {
        width: 90,
        height: 90,
        position: 'absolute',
        right: 0,
        top: 0,
        zIndex: 1,
    },
});

export default withObservables(['id'], ({ id }: { id: string }) => ({
    playlist: id === 'favorites'
        ? of(null)
        : database.collections.get<Playlist>('playlists').findAndObserve(id).pipe(catchError(() => of(null)))
}))(RecentPlaylistCardBase);
