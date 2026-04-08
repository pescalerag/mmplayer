import { useEffect, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import Track from '../database/models/Track';
import Album from '../database/models/Album';
import Artist from '../database/models/Artist';

export type SearchResults = {
    tracks: Track[];
    albums: Album[];
    artists: Artist[];
};

export function useMusicSearch(query: string) {
    const [results, setResults] = useState<SearchResults>({ tracks: [], albums: [], artists: [] });
    const [suggestions, setSuggestions] = useState<SearchResults>({ tracks: [], albums: [], artists: [] });
    const [isLoading, setIsLoading] = useState(false);

    // Initial suggestions (Recent or random)
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
        if (!query.trim()) {
            setResults({ tracks: [], albums: [], artists: [] });
            return;
        }

        setIsLoading(true);
        const timeout = setTimeout(async () => {
            try {
                const searchPattern = `%${query}%`;
                
                // Optimized search across tables
                const [tracks, albums, artists] = await Promise.all([
                    database.collections.get<Track>('tracks').query(
                        Q.experimentalJoinTables(['artists']),
                        Q.or(
                            Q.where('title', Q.like(searchPattern)),
                            Q.on('artists', 'name', Q.like(searchPattern))
                        ),
                        Q.take(50)
                    ).fetch(),
                    database.collections.get<Album>('albums').query(
                        Q.where('title', Q.like(searchPattern)),
                        Q.take(20)
                    ).fetch(),
                    database.collections.get<Artist>('artists').query(
                        Q.where('name', Q.like(searchPattern)),
                        Q.take(20)
                    ).fetch(),
                ]);

                setResults({ tracks, albums, artists });
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setIsLoading(false);
            }
        }, 400);

        return () => clearTimeout(timeout);
    }, [query]);

    return { 
        results: query.trim() ? results : suggestions, 
        isLoading, 
        isSearching: !!query.trim() 
    };
}
