import { Ionicons } from '@expo/vector-icons';
import withObservables from '@nozbe/with-observables';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useCallback, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Keyboard,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LibraryCard from '../components/LibraryCard';
import SectionHeader from '../components/SectionHeader';
import TrackRow from '../components/TrackRow';
import Album from '../database/models/Album';
import Artist from '../database/models/Artist';
import Track from '../database/models/Track';
import { useMusicSearch } from '../hooks/useMusicSearch';
import { SearchStackParamList } from '../navigation/types';
import { usePlayerStore } from '../store/usePlayerStore';
import { Layout } from '../theme/theme';

type SearchNavigationProp = NativeStackNavigationProp<SearchStackParamList>;

// --- ENHANCED COMPONENTS FOR SEARCH ---

const SearchTrackRowBase = ({ track, album, artists }: { track: Track, album: Album, artists: Artist[] }) => {
    const artistNames = artists.length > 0
        ? artists.map(a => a.name).join(', ')
        : 'Artista Desconocido';

    const handlePress = () => {
        usePlayerStore.getState().playSingleTrack(track);
    };

    return (
        <TrackRow
            track={track}
            coverUrl={album?.coverUrl}
            artistName={artistNames}
            onPress={handlePress}
        />
    );
};

const SearchTrackRow = withObservables(['track'], ({ track }: { track: Track }) => ({
    track: track.observe(),
    album: track.album.observe(),
    artists: track.queryCollaborators.observe() as any, // Cast to any to match Artist[] expectation
}))(SearchTrackRowBase);
SearchTrackRow.displayName = 'SearchTrackRow';

const SearchAlbumCardBase = memo(function SearchAlbumCardBase({ album, artist, onPress }: { album: Album, artist: Artist, onPress: () => void }) {
    return (
        <View style={styles.cardContainer}>
            <LibraryCard
                title={album.title}
                subtitle={artist?.name || 'Artista Desconocido'}
                imageUrl={album.coverUrl}
                placeholderIcon="albums"
                onPress={onPress}
            />
        </View>
    );
});

const SearchAlbumCard = withObservables(['album'], ({ album }: { album: Album }) => ({
    album: album.observe(),
    artist: album.artist.observe(),
}))(SearchAlbumCardBase);
SearchAlbumCard.displayName = 'SearchAlbumCard';

const SearchArtistCard = memo(function SearchArtistCard({ artist, onPress }: { artist: Artist, onPress: () => void }) {
    return (
        <View style={styles.cardContainer}>
            <LibraryCard
                title={artist.name}
                imageUrl={artist.imageUrl}
                placeholderIcon="person"
                onPress={onPress}
            />
        </View>
    );
});

// --- MAIN SCREEN ---

export default function SearchScreen() {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<SearchNavigationProp>();
    const [query, setQuery] = useState('');
    const { results, isLoading, isSearching } = useMusicSearch(query);

    const handleClearSearch = useCallback(() => {
        setQuery('');
        Keyboard.dismiss();
    }, []);

    const renderHeader = () => (
        <View style={styles.header}>
            <Text style={styles.resultsTitle}>{isSearching ? 'Resultados' : 'Sugerencias'}</Text>

            {/* Artists Section */}
            {results.artists.length > 0 && (
                <>
                    <SectionHeader title="Artistas" />
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.horizontalScroll}
                    >
                        {results.artists.map(artist => (
                            <SearchArtistCard
                                key={artist.id}
                                artist={artist}
                                onPress={() => navigation.navigate('ArtistDetail', { artistId: artist.id })}
                            />
                        ))}
                    </ScrollView>
                </>
            )}

            {/* Albums Section */}
            {results.albums.length > 0 && (
                <>
                    <SectionHeader title="Álbumes" />
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.horizontalScroll}
                    >
                        {results.albums.map(album => (
                            <SearchAlbumCard
                                key={album.id}
                                album={album}
                                onPress={() => navigation.navigate('AlbumDetail', { albumId: album.id })}
                            />
                        ))}
                    </ScrollView>
                </>
            )}

            {results.tracks.length > 0 && (
                <SectionHeader title="Canciones" />
            )}
        </View>
    );

    const renderItem = useCallback((info: { item: Track }) => {
        const { item } = info;
        return <SearchTrackRow track={item} />;
    }, []);

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#8B5CF633', 'transparent']}
                style={[styles.searchGradient, { paddingTop: insets.top + 10 }]}
            >
                <Text style={styles.title}>Buscar</Text>
                <View style={styles.searchBarContainer}>
                    <View style={styles.searchBar}>
                        <Ionicons name="search" size={20} color="#B3B3B3" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Buscar artistas, álbumes o canciones"
                            placeholderTextColor="#999"
                            value={query}
                            onChangeText={setQuery}
                            autoCorrect={false}
                            selectionColor="#8B5CF6"
                        />
                        {query.length > 0 && (
                            <TouchableOpacity onPress={handleClearSearch} style={styles.clearButton}>
                                <Ionicons name="close-circle" size={20} color="#B3B3B3" />
                            </TouchableOpacity>
                        )}
                    </View>
                    {isLoading && (
                        <View style={styles.loaderContainer}>
                            <ActivityIndicator size="small" color="#8B5CF6" />
                        </View>
                    )}
                </View>
            </LinearGradient>

            <FlatList
                data={results.tracks}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                ListHeaderComponent={renderHeader}
                contentContainerStyle={{
                    paddingBottom: Layout.MINI_PLAYER_HEIGHT + Layout.TAB_BAR_HEIGHT + Layout.PLAYER_MARGIN + insets.bottom + 20
                }}
                ListEmptyComponent={
                    !isLoading && isSearching ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="search-outline" size={64} color="#333" />
                            <Text style={styles.emptyText}>
                                {`No hemos encontrado nada para "${query}"`}
                            </Text>
                        </View>
                    ) : null
                }
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                removeClippedSubviews={Platform.OS === 'android'}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    searchGradient: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    searchBar: {
        flex: 1,
        height: 48,
        backgroundColor: '#1A1A1A',
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#333',
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: 'Montserrat',
        height: '100%',
    },
    clearButton: {
        padding: 4,
    },
    loaderContainer: {
        marginLeft: 12,
    },
    header: {
        paddingBottom: 10,
    },
    title: {
        fontSize: 32,
        fontFamily: 'Montserrat',
        fontWeight: '900',
        color: '#FFFFFF',
        marginBottom: 15,
    },
    resultsTitle: {
        fontSize: 24,
        fontFamily: 'Montserrat',
        fontWeight: '900',
        color: '#FFFFFF',
        marginHorizontal: 20,
        marginTop: 10,
        marginBottom: 5,
    },
    horizontalScroll: {
        paddingLeft: 20,
        paddingRight: 5,
    },
    cardContainer: {
        marginRight: 10,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
        paddingHorizontal: 40,
    },
    emptyText: {
        color: '#666',
        fontSize: 16,
        fontFamily: 'Montserrat',
        textAlign: 'center',
        marginTop: 20,
    },
});
