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

export type TopMatch = 
    | { type: 'artist', item: Artist }
    | { type: 'album', item: Album }
    | { type: 'track', item: Track }
    | null;

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
        const normalizedQuery = normalizeText(query.trim());
        if (!normalizedQuery) {
            setResults({ tracks: [], albums: [], artists: [] });
            setTopMatch(null);
            return;
        }

        setIsLoading(true);
        
        // 1. CREAMOS LA BANDERA: Al iniciar este efecto, esta búsqueda es la "activa"
        let isActive = true;

        const timeout = setTimeout(async () => {
            try {
                const searchPattern = `%${Q.sanitizeLikeString(normalizedQuery)}%`;

                // PASO 1: Buscar las coincidencias exactas en Artistas y Tags
                const [artists, tags] = await Promise.all([
                    database.collections.get<Artist>('artists').query(
                        Q.where('normalized_name', Q.like(searchPattern)),
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
                const trackConditions: any[] = [
                    Q.where('normalized_title', Q.like(searchPattern))
                ];

                if (artistIds.length > 0) {
                    trackConditions.push(
                        Q.where('artist_id', Q.oneOf(artistIds)), 
                        Q.on('albums', 'artist_id', Q.oneOf(artistIds)), 
                        Q.on('track_collaborators', 'artist_id', Q.oneOf(artistIds)) 
                    );
                }

                if (tagIds.length > 0) {
                    trackConditions.push(Q.on('track_tags', 'tag_id', Q.oneOf(tagIds)));
                }

                // PASO 3: Construir condiciones dinámicas para Álbumes
                const albumConditions: any[] = [
                    Q.where('normalized_title', Q.like(searchPattern))
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

                // 2. EVALUAMOS LA BANDERA: 
                // Solo actualizamos el estado si el usuario no ha escrito nada nuevo
                if (isActive) {
                    // --- CALCULAR EL MEJOR RESULTADO ---
                    let currentTopMatch: TopMatch = null;
                    
                    // Buscamos coincidencia exacta primero
                    const exactArtist = artists.find(a => normalizeText(a.name) === normalizedQuery);
                    const exactTrack = tracks.find(t => normalizeText(t.title) === normalizedQuery);
                    const exactAlbum = albums.find(a => normalizeText(a.title) === normalizedQuery);

                    if (exactArtist) currentTopMatch = { type: 'artist', item: exactArtist };
                    else if (exactTrack) currentTopMatch = { type: 'track', item: exactTrack };
                    else if (exactAlbum) currentTopMatch = { type: 'album', item: exactAlbum };
                    // Si no hay exacta, damos prioridad al primer artista, luego canción, luego álbum
                    else if (artists.length > 0) currentTopMatch = { type: 'artist', item: artists[0] };
                    else if (tracks.length > 0) currentTopMatch = { type: 'track', item: tracks[0] };
                    else if (albums.length > 0) currentTopMatch = { type: 'album', item: albums[0] };

                    // --- ENRIQUECIMIENTO DE BÚSQUEDA CRUZADA (Estilo Spotify) ---
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

                    setResults({ tracks, albums, artists });
                    setTopMatch(currentTopMatch);
                }
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                // 3. APAGAMOS EL LOADER: Solo si esta sigue siendo la búsqueda activa
                if (isActive) {
                    setIsLoading(false);
                }
            }
        }, 400);

        // 4. FUNCIÓN DE LIMPIEZA:
        return () => {
            isActive = false;
            clearTimeout(timeout);
        };
    }, [query]);

    return {
        results: query.trim() ? results : suggestions,
        topMatch: query.trim() ? topMatch : null,
        isLoading,
        isSearching: !!query.trim()
    };
}
