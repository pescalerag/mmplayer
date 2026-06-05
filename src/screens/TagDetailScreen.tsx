import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import withObservables from '@nozbe/with-observables';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useCallback, useMemo } from 'react';
import { FlashList } from '@shopify/flash-list';
import { 
    Dimensions, 
    ScrollView, 
    StyleSheet, 
    Text, 
    TouchableOpacity, 
    View 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LibraryCard from '../components/LibraryCard';
import SectionHeader from '../components/SectionHeader';
import TrackRow from '../components/TrackRow';
import { database } from '../database';
import Album from '../database/models/Album';
import Artist from '../database/models/Artist';
import Tag from '../database/models/Tag';
import Track from '../database/models/Track';
import { SearchNavigationProp } from '../navigation/types';
import { usePlayerStore } from '../store/usePlayerStore';
import { useAlbumMenuStore } from '../store/useAlbumMenuStore';
import { Layout } from '../theme/theme';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');
const HEADER_HEIGHT = 320;

// ----- ALBUM CARD COMPONENT -----
const AlbumCardWithNav = memo(function AlbumCardWithNav({
    album,
    onPress,
    onLongPress,
}: {
    album: Album;
    onPress: (album: Album) => void;
    onLongPress: (album: Album) => void;
}) {
    const handlePress = useCallback(() => onPress(album), [album, onPress]);
    const handleLongPress = useCallback(() => onLongPress(album), [album, onLongPress]);

    return (
        <View style={styles.albumCardWrapper}>
            <LibraryCard
                title={album.title}
                imageUrl={album.coverUrl}
                placeholderIcon="albums"
                onPress={handlePress}
                onLongPress={handleLongPress}
            />
        </View>
    );
});

// ----- TRACK ROW COMPONENT -----
const TagTrackRow = withObservables(['track'], ({ track }: { track: Track }) => ({
    track: track.observe(),
    album: track.album.observe(),
    artists: track.queryCollaborators.observe() as any,
}))(function TagTrackRow({
    track,
    album,
    artists,
    tagId,
    index,
    onPress,
}: {
    track: Track;
    album: Album;
    artists: Artist[];
    tagId: string;
    index: number;
    onPress: (trackId: string) => void;
}) {
    const { t } = useTranslation();
    const artistNames = artists.length > 0
        ? artists.map(a => a.name).join(', ')
        : t('actions.unknown');
    return (
        <TrackRow
            track={track}
            contextId={`tag-${tagId}`}
            index={index}
            coverUrl={album?.coverUrl}
            artistName={artistNames}
            onPress={onPress}
        />
    );
});

// ----- MAIN DETAIL COMPONENT -----
function TagDetailScreen({
    tag,
    albums,
    tracks,
}: {
    tag: Tag;
    albums: Album[];
    tracks: Track[];
}) {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<SearchNavigationProp>();
    const { t } = useTranslation();

    const tagColor = tag.color || '#8B5CF6';

    const handleBack = useCallback(() => {
        navigation.goBack();
    }, [navigation]);

    const handleAlbumPress = useCallback((album: Album) => {
        navigation.navigate('AlbumDetail', { albumId: album.id });
    }, [navigation]);

    const handleAlbumLongPress = useCallback((album: Album) => {
        useAlbumMenuStore.getState().openMenu(album);
    }, []);

    const handleTrackPress = useCallback((trackId: string) => {
        const trackIndex = tracks.findIndex(t => t.id === trackId);
        if (trackIndex !== -1) {
            usePlayerStore.getState().loadQueue(tracks, trackIndex, `tag-${tag.id}`);
        }
    }, [tracks, tag]);

    const renderItem = useCallback((info: { item: Track; index: number }) => {
        const { item, index } = info;
        return (
            <View style={{ minHeight: 64, width: '100%' }}>
                <TagTrackRow
                    track={item}
                    tagId={tag.id}
                    index={index + 1}
                    onPress={handleTrackPress}
                />
            </View>
        );
    }, [handleTrackPress, tag.id]);

    const listHeader = useMemo(() => {
        return (
            <View style={{ marginBottom: 16 }}>
                {/* Custom Gradient Header */}
                <View style={styles.headerContainer}>
                    <LinearGradient
                        colors={[tagColor, 'rgba(0,0,0,0.8)', '#121212']}
                        locations={[0, 0.6, 1]}
                        style={styles.headerGradient}
                    />

                    {/* Botón Atrás */}
                    <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                        <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
                    </TouchableOpacity>



                    {/* Contenido Info */}
                    <View style={styles.headerInfo}>
                        <View style={styles.tagBadge}>
                            <Ionicons name="pricetag" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                            <Text style={styles.tagBadgeText}>{t('tags.tag_singular')}</Text>
                        </View>
                        
                        <Text style={styles.title} numberOfLines={2}>
                            {tag.name}
                        </Text>
                        
                        <Text style={styles.metaInfo}>
                            {albums.length} {albums.length === 1 ? t('library.album_singular') : t('library.album_plural')} · {tracks.length} {tracks.length === 1 ? t('library.song_singular') : t('library.song_plural')}
                        </Text>
                    </View>
                </View>

                {/* Sección Álbumes */}
                {albums.length > 0 && (
                    <View style={{ marginBottom: 24, marginTop: 16 }}>
                        <SectionHeader title={t('tags.albums_with_tag')} />
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.albumsScroll}
                        >
                            {albums.map((album) => (
                                <AlbumCardWithNav
                                    key={album.id}
                                    album={album}
                                    onPress={handleAlbumPress}
                                    onLongPress={handleAlbumLongPress}
                                />
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Cabecera Canciones */}
                {tracks.length > 0 && (
                    <View style={{ marginBottom: 8 }}>
                        <SectionHeader title={t('tags.songs_with_tag')} />
                        <View style={styles.tracksDivider} />
                    </View>
                )}
            </View>
        );
    }, [tag, albums, tracks.length, navigation, tagColor, handleBack, handleAlbumPress, handleAlbumLongPress, t]);

    return (
        <View style={styles.container}>
            <FlashList
                data={tracks}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                ListHeaderComponent={listHeader}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="pricetags-outline" size={48} color="#555" />
                        <Text style={styles.emptyText}>{t('tags.empty_tag_items')}</Text>
                    </View>
                }

                contentContainerStyle={{ paddingBottom: Layout.MINI_PLAYER_HEIGHT + Layout.TAB_BAR_HEIGHT + Layout.PLAYER_MARGIN + insets.bottom }}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    headerContainer: {
        width,
        height: HEADER_HEIGHT,
        position: 'relative',
        justifyContent: 'flex-end',
    },
    headerGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 16,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    headerInfo: {
        padding: 24,
        paddingBottom: 8,
    },
    tagBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        marginBottom: 8,
    },
    tagBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontFamily: 'Montserrat',
        fontWeight: '900',
        letterSpacing: 1,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 32,
        fontFamily: 'Montserrat',
        fontWeight: 'bold',
        marginBottom: 8,
    },
    metaInfo: {
        color: '#B3B3B3',
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    albumsScroll: {
        paddingHorizontal: 20,
        gap: 15,
    },
    albumCardWrapper: {
        width: (width - 70) / 3,
    },
    tracksDivider: {
        height: 1,
        backgroundColor: '#282828',
        marginHorizontal: 20,
        marginTop: 8,
        marginBottom: 4,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 60,
        paddingHorizontal: 40,
    },
    emptyText: {
        color: '#888',
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        textAlign: 'center',
        marginTop: 12,
    },
});

export default withObservables(['route'], ({ route }: { route: any }) => {
    const { tagId } = route.params;
    return {
        tag: database.collections.get<Tag>('tags').findAndObserve(tagId),
        albums: database.collections.get<Album>('albums').query(
            Q.experimentalJoinTables(['album_tags']),
            Q.on('album_tags', 'tag_id', tagId),
            Q.sortBy('title', Q.asc)
        ).observe(),
        tracks: database.collections.get<Track>('tracks').query(
            Q.experimentalJoinTables(['track_tags']),
            Q.on('track_tags', 'tag_id', tagId),
            Q.sortBy('title', Q.asc)
        ).observe(),
    };
})(TagDetailScreen);
