import { Q } from '@nozbe/watermelondb';
import { useCallback, useEffect, useRef, useState } from 'react';
import { database } from '../database';
import Album from '../database/models/Album';
import Artist from '../database/models/Artist';
import Tag from '../database/models/Tag';
import Track from '../database/models/Track';
import Playlist from '../database/models/Playlist';

export type SearchResults = {
    tracks: Track[];
    albums: Album[];
    artists: Artist[];
    tags: Tag[];
    playlists: Playlist[];
};

export type TopMatch =
    | { type: 'artist', item: Artist }
    | { type: 'album', item: Album }
    | { type: 'track', item: Track }
    | { type: 'playlist', item: Playlist }
    | null;

const TRACKS_PER_PAGE = 50;

const normalizeText = (text: string) =>
    text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, "");

const buildTrackConditions = async (
    searchPattern: string,
    artistIds: string[],
    albumIds: string[]
): Promise<any[]> => {
    let trackIdsFromCollabs: string[] = [];
    if (artistIds.length > 0) {
        const collabs = await database.collections.get<any>('track_collaborators')
            .query(Q.where('artist_id', Q.oneOf(artistIds))).fetch();
        trackIdsFromCollabs = collabs.map(c => c._raw.track_id as string);
    }

    const trackConditions: any[] = [
        Q.where('normalized_title', Q.like(searchPattern))
    ];

    if (artistIds.length > 0) trackConditions.push(Q.where('artist_id', Q.oneOf(artistIds)));
    if (albumIds.length > 0) trackConditions.push(Q.where('album_id', Q.oneOf(albumIds)));
    if (trackIdsFromCollabs.length > 0) trackConditions.push(Q.where('id', Q.oneOf(trackIdsFromCollabs)));

    return trackConditions;
};

const determineTopMatch = (
    normalizedQuery: string,
    artists: Artist[],
    albums: Album[],
    tracks: Track[],
    playlists: Playlist[]
): TopMatch => {
    const startsWith = (text: string) => normalizeText(text).startsWith(normalizedQuery);

    const exactTrack = tracks.find(t => normalizeText(t.title) === normalizedQuery);
    const exactArtist = artists.find(a => normalizeText(a.name) === normalizedQuery);
    const exactAlbum = albums.find(a => normalizeText(a.title) === normalizedQuery);
    const exactPlaylist = playlists.find(p => normalizeText(p.name) === normalizedQuery);

    const startTrack = tracks.find(t => startsWith(t.title));
    const startArtist = artists.find(a => startsWith(a.name));
    const startAlbum = albums.find(a => startsWith(a.title));
    const startPlaylist = playlists.find(p => startsWith(p.name));

    if (exactTrack) return { type: 'track', item: exactTrack };
    if (exactArtist) return { type: 'artist', item: exactArtist };
    if (exactAlbum) return { type: 'album', item: exactAlbum };
    if (exactPlaylist) return { type: 'playlist', item: exactPlaylist };
    if (startTrack) return { type: 'track', item: startTrack };
    if (startArtist) return { type: 'artist', item: startArtist };
    if (startAlbum) return { type: 'album', item: startAlbum };
    if (startPlaylist) return { type: 'playlist', item: startPlaylist };
    
    if (tracks.length > 0) return { type: 'track', item: tracks[0] };
    if (artists.length > 0) return { type: 'artist', item: artists[0] };
    if (albums.length > 0) return { type: 'album', item: albums[0] };
    if (playlists.length > 0) return { type: 'playlist', item: playlists[0] };

    return null;
};

const fetchRelatedForTopTrack = async (track: Track, artists: Artist[], albums: Album[]) => {
    const [relatedArtist, relatedAlbum] = await Promise.all([
        track.artist.fetch(),
        track.album.fetch()
    ]);

    if (relatedArtist && !artists.some(a => a.id === relatedArtist.id)) {
        artists.unshift(relatedArtist);
    }
    if (relatedAlbum && !albums.some(a => a.id === relatedAlbum.id)) {
        albums.unshift(relatedAlbum);
    }
};

export function useMusicSearch(query: string) {
    const [results, setResults] = useState<SearchResults>({ tracks: [], albums: [], artists: [], tags: [], playlists: [] });
    const [suggestions, setSuggestions] = useState<SearchResults>({ tracks: [], albums: [], artists: [], tags: [], playlists: [] });
    const [topMatch, setTopMatch] = useState<TopMatch>(null);
    const [isLoading, setIsLoading] = useState(false);

    const [page, setPage] = useState(0);
    const [hasMoreTracks, setHasMoreTracks] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const trackConditionsRef = useRef<any[]>([]);

    useEffect(() => {
        const loadSuggestions = async () => {
            try {
                const [recentAlbums, randomArtists, recentTags, recentPlaylists] = await Promise.all([
                    database.collections.get<Album>('albums').query(Q.take(10)).fetch(),
                    database.collections.get<Artist>('artists').query(Q.take(10)).fetch(),
                    database.collections.get<Tag>('tags').query(Q.take(10)).fetch(),
                    database.collections.get<Playlist>('playlists').query(Q.take(10)).fetch(),
                ]);
                setSuggestions({
                    tracks: [],
                    albums: recentAlbums,
                    artists: randomArtists,
                    tags: recentTags,
                    playlists: recentPlaylists
                });
            } catch (error) {
                console.error('Error loading suggestions:', error);
            }
        };
        loadSuggestions();
    }, []);

    useEffect(() => {
        const normalizedQuery = normalizeText(query.trim());
        if (!normalizedQuery) {
            setResults({ tracks: [], albums: [], artists: [], tags: [], playlists: [] });
            setTopMatch(null);
            setPage(0);
            setHasMoreTracks(true);
            return;
        }

        setIsLoading(true);
        setPage(0);
        setHasMoreTracks(true);

        let isActive = true;

        const timeout = setTimeout(async () => {
            try {
                const searchPattern = `%${Q.sanitizeLikeString(normalizedQuery)}%`;

                const [artists, albums, tags, playlists] = await Promise.all([
                    database.collections.get<Artist>('artists').query(
                        Q.where('normalized_name', Q.like(searchPattern)),
                        Q.sortBy('name', Q.asc),
                        Q.take(20)
                    ).fetch(),
                    database.collections.get<Album>('albums').query(
                        Q.where('normalized_title', Q.like(searchPattern)),
                        Q.sortBy('title', Q.asc),
                        Q.take(20)
                    ).fetch(),
                    database.collections.get<Tag>('tags').query(
                        Q.where('normalized_name', Q.like(searchPattern)),
                        Q.take(20)
                    ).fetch(),
                    database.collections.get<Playlist>('playlists').query(
                        Q.where('name', Q.like(searchPattern)),
                        Q.sortBy('name', Q.asc),
                        Q.take(20)
                    ).fetch()
                ]);

                const artistIds = artists.map(a => a.id);
                const albumIds = albums.map(a => a.id);

                const trackConditions = await buildTrackConditions(searchPattern, artistIds, albumIds);
                trackConditionsRef.current = trackConditions;

                // Also query tracks starting with query directly to ensure they are returned first, 
                // in case they got cut off by pagination limits.
                const startsWithPattern = `${Q.sanitizeLikeString(normalizedQuery)}%`;
                const [startTracks, tracks] = await Promise.all([
                    database.collections.get<Track>('tracks').query(
                        Q.where('normalized_title', Q.like(startsWithPattern)),
                        Q.take(10)
                    ).fetch(),
                    database.collections.get<Track>('tracks').query(
                        Q.or(...trackConditions),
                        Q.sortBy('title', Q.asc),
                        Q.skip(0),
                        Q.take(TRACKS_PER_PAGE)
                    ).fetch()
                ]);

                // Merge and ensure uniqueness
                const mergedTracks = [...startTracks];
                for (const t of tracks) {
                    if (!mergedTracks.some(mt => mt.id === t.id)) {
                        mergedTracks.push(t);
                    }
                }

                // In-memory sorting function to bubble exact & start matches
                const bubbleExactAndStart = <T extends object>(
                    items: T[], 
                    getName: (item: T) => string
                ): T[] => {
                    return [...items].sort((a, b) => {
                        const aNorm = normalizeText(getName(a));
                        const bNorm = normalizeText(getName(b));
                        const aExact = aNorm === normalizedQuery;
                        const bExact = bNorm === normalizedQuery;
                        if (aExact && !bExact) return -1;
                        if (!aExact && bExact) return 1;

                        const aStart = aNorm.startsWith(normalizedQuery);
                        const bStart = bNorm.startsWith(normalizedQuery);
                        if (aStart && !bStart) return -1;
                        if (!aStart && bStart) return 1;

                        return 0; // Keep their original order
                    });
                };

                const sortedArtists = bubbleExactAndStart(artists, a => a.name);
                const sortedAlbums = bubbleExactAndStart(albums, a => a.title);
                const sortedPlaylists = bubbleExactAndStart(playlists, p => p.name);
                const sortedTracks = bubbleExactAndStart(mergedTracks, t => t.title);

                if (isActive) {
                    const currentTopMatch = determineTopMatch(
                        normalizedQuery, 
                        sortedArtists, 
                        sortedAlbums, 
                        sortedTracks, 
                        sortedPlaylists
                    );

                    if (currentTopMatch && currentTopMatch.type === 'track') {
                        await fetchRelatedForTopTrack(currentTopMatch.item, sortedArtists, sortedAlbums);
                    }

                    setHasMoreTracks(tracks.length === TRACKS_PER_PAGE);
                    setResults({ 
                        tracks: sortedTracks, 
                        albums: sortedAlbums, 
                        artists: sortedArtists, 
                        tags, 
                        playlists: sortedPlaylists 
                    });
                    setTopMatch(currentTopMatch);
                }
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                if (isActive) setIsLoading(false);
            }
        }, 400);

        return () => {
            isActive = false;
            clearTimeout(timeout);
        };
    }, [query]);

    const loadMoreTracks = useCallback(async () => {
        if (isLoadingMore || !hasMoreTracks || !query.trim()) return;

        setIsLoadingMore(true);
        try {
            const nextPage = page + 1;
            const nextOffset = nextPage * TRACKS_PER_PAGE;

            const newTracks = await database.collections.get<Track>('tracks').query(
                Q.or(...trackConditionsRef.current),
                Q.sortBy('title', Q.asc),
                Q.skip(nextOffset),
                Q.take(TRACKS_PER_PAGE)
            ).fetch();

            setResults(prev => ({
                ...prev,
                tracks: [...prev.tracks, ...newTracks]
            }));

            setPage(nextPage);
            setHasMoreTracks(newTracks.length === TRACKS_PER_PAGE);
        } catch (error) {
            console.error('Error loading more tracks:', error);
        } finally {
            setIsLoadingMore(false);
        }
    }, [isLoadingMore, hasMoreTracks, query, page]);

    return {
        results: query.trim() ? results : suggestions,
        topMatch: query.trim() ? topMatch : null,
        isLoading,
        isSearching: !!query.trim(),
        loadMoreTracks,
        isLoadingMore
    };
}
