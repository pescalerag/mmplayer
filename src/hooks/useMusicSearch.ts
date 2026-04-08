import { Q } from '@nozbe/watermelondb';
import { useEffect, useState } from 'react';
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
                const searchPattern = `%${Q.sanitizeLikeString(query)}%`;

                // PASO 1: Buscar las coincidencias exactas en Artistas y Tags
                const [artists, tags] = await Promise.all([
                    database.collections.get<Artist>('artists').query(
                        Q.where('name', Q.like(searchPattern)),
                        Q.take(20)
                    ).fetch(),
                    database.collections.get<Tag>('tags').query(
                        Q.where('name', Q.like(searchPattern)),
                        Q.take(20)
                    ).fetch()
                ]);

                // Extraemos los IDs
                const artistIds = artists.map(a => a.id);
                const tagIds = tags.map(t => t.id);

                // PASO 2: Construir condiciones dinámicas para Canciones
                // Siempre buscamos por título de canción
                const trackConditions: any[] = [
                    Q.where('title', Q.like(searchPattern))
                ];

                // Si encontramos artistas con ese nombre, traemos canciones relacionadas a esos IDs
                if (artistIds.length > 0) {
                    trackConditions.push(
                        Q.where('artist_id', Q.oneOf(artistIds)), // Artista principal
                        Q.on('albums', 'artist_id', Q.oneOf(artistIds)), // Artista del Álbum
                        Q.on('track_collaborators', 'artist_id', Q.oneOf(artistIds)) // Colaboradores
                    );
                }

                // Si encontramos tags con ese nombre, traemos canciones con esos tags
                if (tagIds.length > 0) {
                    trackConditions.push(Q.on('track_tags', 'tag_id', Q.oneOf(tagIds)));
                }

                // PASO 3: Construir condiciones dinámicas para Álbumes
                const albumConditions: any[] = [
                    Q.where('title', Q.like(searchPattern))
                ];

                if (artistIds.length > 0) {
                    albumConditions.push(Q.where('artist_id', Q.oneOf(artistIds)));
                }

                // PASO 4: Ejecutar las consultas limpias
                const [tracks, albums] = await Promise.all([
                    database.collections.get<Track>('tracks').query(
                        Q.experimentalJoinTables(['albums', 'track_collaborators', 'track_tags']),
                        Q.or(...trackConditions),
                        Q.take(50)
                    ).fetch(),
                    database.collections.get<Album>('albums').query(
                        Q.or(...albumConditions),
                        Q.take(20)
                    ).fetch()
                ]);

                // Como ya buscamos los 'artists' en el Paso 1, podemos devolverlos directamente
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