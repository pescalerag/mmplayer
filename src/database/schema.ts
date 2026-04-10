import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const mySchema = appSchema({
    version: 5,
    tables: [
        tableSchema({
            name: 'tracks',
            columns: [
                { name: 'title', type: 'string' },
                { name: 'normalized_title', type: 'string' },
                { name: 'file_url', type: 'string' }, // La ruta local del archivo
                { name: 'duration', type: 'number' },
                { name: 'is_favorite', type: 'boolean' },
                { name: 'album_id', type: 'string', isIndexed: true },
                { name: 'artist_id', type: 'string', isIndexed: true },
                { name: 'track_number', type: 'number', isOptional: true },
                { name: 'disc_number', type: 'number', isOptional: true },
            ],
        }),
        tableSchema({
            name: 'albums',
            columns: [
                { name: 'title', type: 'string' },
                { name: 'normalized_title', type: 'string' },
                { name: 'year', type: 'number', isOptional: true },
                { name: 'cover_url', type: 'string', isOptional: true }, // Portada local
                { name: 'artist_id', type: 'string', isIndexed: true },
            ],
        }),
        tableSchema({
            name: 'artists',
            columns: [
                { name: 'name', type: 'string' },
                { name: 'normalized_name', type: 'string' },
                { name: 'image_url', type: 'string', isOptional: true },
            ],
        }),
        tableSchema({
            name: 'search_history',
            columns: [
                { name: 'query', type: 'string', isIndexed: true },
                { name: 'updated_at', type: 'number' },
            ],
        }),
        tableSchema({
            name: 'playlists',
            columns: [
                { name: 'name', type: 'string' },
                { name: 'description', type: 'string', isOptional: true },
                { name: 'cover_custom_url', type: 'string', isOptional: true }, // Tu cover custom (MVP)
                { name: 'header_custom_url', type: 'string', isOptional: true }, // Tu header custom (MVP)
                { name: 'created_at', type: 'number' },
            ],
        }),
        tableSchema({
            name: 'tags',
            columns: [
                { name: 'name', type: 'string' }, // Ej: "FLAC", "Vinyl-Rip"
                { name: 'color', type: 'string' }, // Ej: "#FF5733"
                { name: 'is_auto', type: 'boolean' }, // true si lo detectó el escáner, false si lo creó el usuario
            ],
        }),
        // Tablas pivote para las relaciones Muchos a Muchos
        tableSchema({
            name: 'playlist_tracks',
            columns: [
                { name: 'playlist_id', type: 'string', isIndexed: true },
                { name: 'track_id', type: 'string', isIndexed: true },
                { name: 'order', type: 'number' }, // Para saber el orden de la canción en la lista
            ],
        }),
        tableSchema({
            name: 'track_tags',
            columns: [
                { name: 'track_id', type: 'string', isIndexed: true },
                { name: 'tag_id', type: 'string', isIndexed: true },
            ],
        }),
        tableSchema({
            name: 'track_collaborators',
            columns: [
                { name: 'track_id', type: 'string', isIndexed: true },
                { name: 'artist_id', type: 'string', isIndexed: true },
            ],
        }),
    ],
});
