import { Ionicons } from '@expo/vector-icons';
import withObservables from '@nozbe/with-observables';
import { useNavigation, useScrollToTop } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
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
import { useSearchHistory } from '../hooks/useSearchHistory';

type SearchNavigationProp = NativeStackNavigationProp<SearchStackParamList>;

type FilterOption = 'all' | 'artists' | 'albums' | 'tracks';

const FILTER_TABS: { id: FilterOption; label: string }[] = [
    { id: 'all', label: 'Todo' },
    { id: 'artists', label: 'Artistas' },
    { id: 'albums', label: 'Álbumes' },
    { id: 'tracks', label: 'Canciones' },
];

// --- ENHANCED COMPONENTS FOR SEARCH ---

const HistoryItem = ({ query, onDelete, onPress }: { query: string, onDelete: () => void, onPress: () => void }) => (
    <View style={styles.historyItem}>
        <TouchableOpacity style={styles.historyTextContainer} onPress={onPress}>
            <Ionicons name="time-outline" size={18} color="#666" style={styles.historyIcon} />
            <Text style={styles.historyText}>{query}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={styles.historyDelete}>
            <Ionicons name="close" size={18} color="#666" />
        </TouchableOpacity>
    </View>
);

const SearchTrackRowBase = ({ track, album, artists, onPress }: { track: Track, album: Album, artists: Artist[], onPress?: () => void }) => {
    const artistNames = artists.length > 0
        ? artists.map(a => a.name).join(', ')
        : 'Artista Desconocido';

    const handlePress = () => {
        onPress?.();
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
    const { history, saveSearch, clearHistory, deleteHistoryItem } = useSearchHistory();
    const [activeFilter, setActiveFilter] = useState<FilterOption>('all');

    const flatListRef = useRef<FlatList>(null);
    useScrollToTop(flatListRef);

    const handleResultClick = useCallback((textToSave: string) => {
        if (textToSave.trim()) {
            saveSearch(textToSave);
            Keyboard.dismiss();
        }
    }, [saveSearch]);

    useEffect(() => {
        const tabNavigator: any = navigation.getParent();
        if (!tabNavigator) return;

        const unsubscribe = tabNavigator.addListener('tabPress', (e: any) => {
            const state = tabNavigator.getState();
            const currentRoute = state.routes[state.index];

            if (currentRoute.key === e.target) {
                setQuery('');
                setActiveFilter('all');
                Keyboard.dismiss();
            }
        });

        return unsubscribe;
    }, [navigation]);

    const handleSearchSubmit = useCallback(() => {
        if (query.trim()) {
            saveSearch(query);
            Keyboard.dismiss();
        }
    }, [query, saveSearch]);

    const handleClearSearch = useCallback(() => {
        setQuery('');
        Keyboard.dismiss();
    }, []);

    const renderHeader = () => (
        <View style={styles.header}>
            {!isSearching && history.length > 0 && (
                <View style={styles.historySection}>
                    <View style={styles.sectionHeaderWithAction}>
                        <SectionHeader title="Búsquedas recientes" />
                        <TouchableOpacity onPress={clearHistory}>
                            <Text style={styles.clearHistoryText}>Borrar todo</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.historyList}>
                        {history.map(item => (
                            <HistoryItem
                                key={item.id}
                                query={item.query}
                                onDelete={() => deleteHistoryItem(item.id)}
                                onPress={() => {
                                    setQuery(item.query);
                                    saveSearch(item.query);
                                    Keyboard.dismiss();
                                }}
                            />
                        ))}
                    </View>
                </View>
            )}

            <Text style={styles.resultsTitle}>{isSearching ? 'Resultados' : 'Sugerencias'}</Text>

            {/* Artists Section */}
            {(activeFilter === 'all' || activeFilter === 'artists') && results.artists.length > 0 && (
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
                                onPress={() => {
                                    handleResultClick(query);
                                    navigation.navigate('ArtistDetail', { artistId: artist.id });
                                }}
                            />
                        ))}
                    </ScrollView>
                </>
            )}

            {/* Albums Section */}
            {(activeFilter === 'all' || activeFilter === 'albums') && results.albums.length > 0 && (
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
                                onPress={() => {
                                    handleResultClick(query);
                                    navigation.navigate('AlbumDetail', { albumId: album.id });
                                }}
                            />
                        ))}
                    </ScrollView>
                </>
            )}

            {(activeFilter === 'all' || activeFilter === 'tracks') && results.tracks.length > 0 && (
                <SectionHeader title="Canciones" />
            )}
        </View>
    );

    const renderItem = useCallback((info: { item: Track }) => {
        const { item } = info;
        return (
            <SearchTrackRow 
                track={item} 
                onPress={() => handleResultClick(query)}
            />
        );
    }, [handleResultClick, query]);

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
                            onSubmitEditing={handleSearchSubmit}
                            returnKeyType="search"
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

                {/* Filtros rápidos - Solo visibles al buscar */}
                {isSearching && (
                    <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.filtersContainer}
                        style={styles.filtersScroll}
                    >
                        {FILTER_TABS.map(tab => {
                            const isActive = activeFilter === tab.id;
                            return (
                                <TouchableOpacity
                                    key={tab.id}
                                    style={[styles.filterPill, isActive && styles.filterPillActive]}
                                    onPress={() => setActiveFilter(tab.id)}
                                >
                                    <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                                        {tab.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                )}
            </LinearGradient>

            <FlatList
                ref={flatListRef}
                data={(activeFilter === 'all' || activeFilter === 'tracks') ? results.tracks : []}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                ListHeaderComponent={renderHeader}
                contentContainerStyle={{
                    paddingBottom: Layout.MINI_PLAYER_HEIGHT + Layout.TAB_BAR_HEIGHT + Layout.PLAYER_MARGIN + insets.bottom + 20
                }}
                ListEmptyComponent={(() => {
                    if (isLoading || !isSearching) return null;

                    // Verificar si hay algún resultado visible según el filtro activo
                    const hasArtists = (activeFilter === 'all' || activeFilter === 'artists') && results.artists.length > 0;
                    const hasAlbums = (activeFilter === 'all' || activeFilter === 'albums') && results.albums.length > 0;
                    const hasTracks = (activeFilter === 'all' || activeFilter === 'tracks') && results.tracks.length > 0;

                    if (hasArtists || hasAlbums || hasTracks) return null;

                    return (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="search-outline" size={64} color="#333" />
                            <Text style={styles.emptyText}>
                                {`No hemos encontrado nada para "${query}"`}
                            </Text>
                        </View>
                    );
                })()}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                removeClippedSubviews={Platform.OS === 'android'}
                keyboardDismissMode="on-drag"
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
    historySection: {
        marginTop: 10,
        marginBottom: 20,
    },
    sectionHeaderWithAction: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingRight: 20,
    },
    clearHistoryText: {
        color: '#8B5CF6',
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '600',
    },
    historyList: {
        paddingHorizontal: 20,
        marginTop: 5,
    },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#1A1A1A',
    },
    historyTextContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    historyIcon: {
        marginRight: 12,
    },
    historyText: {
        color: '#E0E0E0',
        fontSize: 16,
        fontFamily: 'Montserrat',
    },
    historyDelete: {
        padding: 5,
    },
    filtersScroll: {
        marginTop: 15,
    },
    filtersContainer: {
        paddingBottom: 4,
        flexDirection: 'row',
    },
    filterPill: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#1A1A1A',
        borderWidth: 1,
        borderColor: '#333',
        marginRight: 8,
    },
    filterPillActive: {
        backgroundColor: '#8B5CF6',
        borderColor: '#8B5CF6',
    },
    filterText: {
        color: '#B3B3B3',
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    filterTextActive: {
        color: '#FFFFFF',
    },
});
