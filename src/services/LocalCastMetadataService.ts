import { database } from '../database';
import Track from '../database/models/Track';
import { TagService } from './tagService';

export interface CastTrackMetadata {
    trackId: string;
    rating: number | null;
    tagIds: string[];
    availableTags: { id: string; name: string; color: string }[];
}

let revision = 0;
let subscription: { unsubscribe: () => void } | undefined;
let cache: { version: string; value: Promise<CastTrackMetadata> } | null = null;

export const LocalCastMetadataService = {
    start() {
        this.stop();
        subscription = database.withChangesForTables?.(['tracks', 'tags', 'track_tags']).subscribe(() => {
            revision++;
            cache = null;
        });
    },
    stop() {
        subscription?.unsubscribe();
        subscription = undefined;
        cache = null;
        revision++;
    },
    async read(trackId: string, knownVersion: string | null) {
        const version = trackId + ':' + revision;
        if (knownVersion === version) return { metadataVersion: version };
        if (cache?.version !== version) {
            const value = Promise.all([
                database.get<Track>('tracks').find(trackId),
                TagService.getTagIdsForTrack(trackId),
                TagService.getAllTags(),
            ]).then(([track, tagIds, tags]) => ({
                trackId, rating: track.rating ?? null, tagIds,
                availableTags: tags.map(tag => ({ id: tag.id, name: tag.name, color: tag.color })),
            }));
            cache = { version, value };
        }
        try {
            return { metadataVersion: version, trackMetadata: await cache.value };
        } catch {
            cache = null;
            // Missing metadata must never interrupt audio delivery or acknowledge a failed read.
            return {};
        }
    },
    async edit(params: URLSearchParams): Promise<boolean> {
        const trackId = params.get('trackId');
        if (!trackId) return false;
        const action = params.get('action');
        if (action === 'rating') {
            const raw = params.get('rating');
            if (raw === null || raw.trim() === '') return false;
            const rating = Number(raw);
            if (!Number.isFinite(rating) || rating < 0 || rating > 5 || !Number.isInteger(rating * 2)) return false;
            const track = await database.get<Track>('tracks').find(trackId);
            await track.updateRating(rating === 0 ? null : rating);
        } else if (action === 'tag') {
            const tagId = params.get('tagId');
            const associated = params.get('associated');
            if (!tagId || (associated !== 'true' && associated !== 'false')) return false;
            await Promise.all([database.get('tags').find(tagId), database.get('tracks').find(trackId)]);
            await TagService.toggleTrackTag(trackId, tagId, associated === 'true');
        } else return false;
        revision++;
        cache = null;
        return true;
    },
};
