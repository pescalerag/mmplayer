import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import AlbumTag from '../database/models/AlbumTag';
import Tag from '../database/models/Tag';
import Track from '../database/models/Track';
import TrackTag from '../database/models/TrackTag';

const normalizeText = (text: string) =>
    text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

export const TagService = {
    /**
     * Get all tags sorted by name alphabetically.
     */
    async getAllTags(): Promise<Tag[]> {
        return database.collections.get<Tag>('tags')
            .query(Q.sortBy('name', Q.asc))
            .fetch();
    },

    /**
     * Create a new custom tag if it doesn't already exist.
     */
    async createTag(name: string, color: string): Promise<Tag> {
        const trimmedName = name.trim();
        if (!trimmedName) throw new Error('El nombre de la etiqueta no puede estar vacío');

        const normalizedInput = normalizeText(trimmedName);

        // Búsqueda insensible a mayúsculas/acentos usando la columna normalizada
        const existing = await database.collections.get<Tag>('tags')
            .query(Q.where('normalized_name', normalizedInput))
            .fetch();

        if (existing.length > 0) return existing[0];

        return database.write(async () => {
            return database.collections.get<Tag>('tags').create(tag => {
                tag.name = trimmedName;        // Guardamos el original bonito
                tag.normalizedName = normalizedInput; // Guardamos el limpio para búsquedas
                tag.color = color;
                tag.isAuto = false;
            });
        });
    },

    /**
     * Get IDs of tags assigned to a specific track.
     */
    async getTagIdsForTrack(trackId: string): Promise<string[]> {
        const trackTags = await database.collections.get<TrackTag>('track_tags')
            .query(Q.where('track_id', trackId))
            .fetch();
        return trackTags.map(tt => tt.tag.id);
    },

    /**
     * Get IDs of tags assigned to a specific album.
     */
    async getTagIdsForAlbum(albumId: string): Promise<string[]> {
        const albumTags = await database.collections.get<AlbumTag>('album_tags')
            .query(Q.where('album_id', albumId))
            .fetch();
        return albumTags.map(at => at.tag.id);
    },

    /**
     * Toggle association between a track and a tag.
     */
    async toggleTrackTag(trackId: string, tagId: string, shouldAssociate: boolean): Promise<void> {
        await database.write(async () => {
            const trackTagsCollection = database.collections.get<TrackTag>('track_tags');

            const existingLinks = await trackTagsCollection
                .query(
                    Q.where('track_id', trackId),
                    Q.where('tag_id', tagId)
                )
                .fetch();

            if (shouldAssociate) {
                if (existingLinks.length === 0) {
                    await trackTagsCollection.create(tt => {
                        tt.track.id = trackId;
                        tt.tag.id = tagId;
                    });
                }
            } else {
                for (const link of existingLinks) {
                    await link.destroyPermanently();
                }
            }
        });
    },

    /**
     * Toggle association between an album and a tag.
     */
    async toggleAlbumTag(albumId: string, tagId: string, shouldAssociate: boolean, applyToTracks: boolean = false): Promise<void> {
        await database.write(async () => {
            const albumTagsCollection = database.collections.get<AlbumTag>('album_tags');
            const trackTagsCollection = database.collections.get<TrackTag>('track_tags');

            // 1. Manejar la etiqueta del álbum
            const existingLinks = await albumTagsCollection.query(Q.where('album_id', albumId), Q.where('tag_id', tagId)).fetch();

            const batchOperations: any[] = [];

            if (shouldAssociate && existingLinks.length === 0) {
                batchOperations.push(
                    albumTagsCollection.prepareCreate(at => {
                        at.album.id = albumId;
                        at.tag.id = tagId;
                    })
                );
            } else if (!shouldAssociate) {
                existingLinks.forEach(link => batchOperations.push(link.prepareDestroyPermanently()));
            }

            // 2. Propagar a las canciones si se solicita
            if (applyToTracks) {
                const tracksInAlbum = await database.collections.get<Track>('tracks').query(Q.where('album_id', albumId)).fetch();

                for (const track of tracksInAlbum) {
                    const existingTrackLinks = await trackTagsCollection.query(Q.where('track_id', track.id), Q.where('tag_id', tagId)).fetch();

                    if (shouldAssociate && existingTrackLinks.length === 0) {
                        batchOperations.push(
                            trackTagsCollection.prepareCreate(tt => {
                                tt.track.id = track.id;
                                tt.tag.id = tagId;
                            })
                        );
                    } else if (!shouldAssociate) {
                        existingTrackLinks.forEach(link => batchOperations.push(link.prepareDestroyPermanently()));
                    }
                }
            }

            // Ejecutar todas las operaciones de golpe para máximo rendimiento
            if (batchOperations.length > 0) {
                await database.batch(...batchOperations);
            }
        });
    },

    /**
     * Update a tag.
     */
    async updateTag(tagId: string, name: string, color: string): Promise<void> {
        const trimmedName = name.trim();
        if (!trimmedName) throw new Error('El nombre de la etiqueta no puede estar vacío');

        const normalizedInput = normalizeText(trimmedName);

        await database.write(async () => {
            const tag = await database.collections.get<Tag>('tags').find(tagId);
            await tag.update(t => {
                t.name = trimmedName;        // Actualizamos el original bonito
                t.normalizedName = normalizedInput; // Actualizamos el limpio
                t.color = color;
            });
        });
    },
    async deleteTag(tagId: string): Promise<void> {
        await database.write(async () => {
            const tag = await database.collections.get<Tag>('tags').find(tagId);

            // Eliminar asociaciones de canciones
            const trackTags = await database.collections.get<TrackTag>('track_tags').query(Q.where('tag_id', tagId)).fetch();
            // Eliminar asociaciones de álbumes
            const albumTags = await database.collections.get<AlbumTag>('album_tags').query(Q.where('tag_id', tagId)).fetch();

            const recordsToDelete = [...trackTags, ...albumTags, tag];

            // Eliminamos all en un solo batch
            const deleteOperations = recordsToDelete.map(record => record.prepareDestroyPermanently());
            await database.batch(...deleteOperations);
        });
    },
};
