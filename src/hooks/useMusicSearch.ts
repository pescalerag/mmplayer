import { Q } from '@nozbe/watermelondb';
import { useCallback, useEffect, useRef, useState } from 'react';
import { database } from '../database';
import Album from '../database/models/Album';
import Artist from '../database/models/Artist';
import Tag from '../database/models/Tag';
import Track from '../database/models/Track';

export type SearchResults = {
    tracks: Track[];
    albums: Album[];
    artists: Artist[];
};

export type TopMatch =
    | { type: 'artist', item: Artist }
    | { type: 'album', item: Album }
    | { type: 'track', item: Track }
    | null;

const TRACKS_PER_PAGE = 50;

const normalizeText = (text: string) =>
    text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

export function useMusicSearch(query: string) {
    const [results, setResults] = useState<SearchResults>({ tracks: [], albums: [], artists: [] });
    const [suggestions, setSuggestions] = useState<SearchResults>({ tracks: [], albums: [], artists: [] });
    const [topMatch, setTopMatch] = useState<TopMatch>(null);
    const [isLoading, setIsLoading] = useState(false);

    const [page, setPage] = useState(0);
    const [hasMoreTracks, setHasMoreTracks] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const trackConditionsRef = useRef<any[]>([]);

    useEffect(() => {
        const loadSuggestions = async () => {
            try {
                const [recentAlbums, randomArtists] = await Promise.all([
                    database.collections.get<Album>('albums').query(Q.take(10)).fetch(),
                    database.collections.get<Artist>('artists').query(Q.take(10)).fetch(),
                ]);
                setSuggestions({
                    tracks: [],
                    albums: recentAlbums,
                    artists: randomArtists,
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
            setResults({ tracks: [], albums: [], artists: [] });
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

                const [artists, albums, tags] = await Promise.all([
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
                    ).fetch()
                ]);

                const artistIds = artists.map(a => a.id);
                const albumIds = albums.map(a => a.id);
                const tagIds = tags.map(t => t.id);

                let trackIdsFromTags: string[] = [];
                if (tagIds.length > 0) {
                    const trackTags = await database.collections.get<any>('track_tags')
                        .query(Q.where('tag_id', Q.oneOf(tagIds))).fetch();
                    trackIdsFromTags = trackTags.map(tt => tt._raw.track_id as string);
                }

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
                if (trackIdsFromTags.length > 0) trackConditions.push(Q.where('id', Q.oneOf(trackIdsFromTags)));
                if (trackIdsFromCollabs.length > 0) trackConditions.push(Q.where('id', Q.oneOf(trackIdsFromCollabs)));

                trackConditionsRef.current = trackConditions;

                const tracks = await database.collections.get<Track>('tracks').query(
                    Q.or(...trackConditions),
                    Q.sortBy('title', Q.asc),
                    Q.skip(0),
                    Q.take(TRACKS_PER_PAGE)
                ).fetch();

                if (isActive) {
                    let currentTopMatch: TopMatch = null;

                    const startsWith = (text: string) => normalizeText(text).startsWith(normalizedQuery);

                    const exactArtist = artists.find(a => normalizeText(a.name) === normalizedQuery);
                    const exactTrack = tracks.find(t => normalizeText(t.title) === normalizedQuery);
                    const exactAlbum = albums.find(a => normalizeText(a.title) === normalizedQuery);

                    const startArtist = artists.find(a => startsWith(a.name));
                    const startTrack = tracks.find(t => startsWith(t.title));
                    const startAlbum = albums.find(a => startsWith(a.title));

                    if (exactArtist) currentTopMatch = { type: 'artist', item: exactArtist };
                    else if (exactTrack) currentTopMatch = { type: 'track', item: exactTrack };
                    else if (exactAlbum) currentTopMatch = { type: 'album', item: exactAlbum };
                    else if (startArtist) currentTopMatch = { type: 'artist', item: startArtist };
                    else if (startTrack) currentTopMatch = { type: 'track', item: startTrack };
                    else if (startAlbum) currentTopMatch = { type: 'album', item: startAlbum };
                    else if (artists.length > 0) currentTopMatch = { type: 'artist', item: artists[0] };
                    else if (tracks.length > 0) currentTopMatch = { type: 'track', item: tracks[0] };
                    else if (albums.length > 0) currentTopMatch = { type: 'album', item: albums[0] };

                    if (currentTopMatch && currentTopMatch.type === 'track') {
                        const track = currentTopMatch.item;
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
                    }

                    setHasMoreTracks(tracks.length === TRACKS_PER_PAGE);
                    setResults({ tracks, albums, artists });
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
