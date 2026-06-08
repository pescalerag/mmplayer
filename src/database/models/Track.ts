import { Model, Q } from '@nozbe/watermelondb';
import { children, field, lazy, relation, text } from '@nozbe/watermelondb/decorators';


export default class Track extends Model {
    static readonly table = 'tracks';

    static readonly associations = {
        albums: { type: 'belongs_to' as const, key: 'album_id' },
        artists: { type: 'belongs_to' as const, key: 'artist_id' },
        track_tags: { type: 'has_many' as const, foreignKey: 'track_id' },
        track_collaborators: { type: 'has_many' as const, foreignKey: 'track_id' },
    };

    @text('title') title: string;
    @text('normalized_title') normalizedTitle: string;
    @text('file_url') fileUrl: string;
    @field('duration') duration: number;
    @field('is_favorite') isFavorite: boolean;
    @field('track_number') trackNumber: number | null;
    @field('disc_number') discNumber: number | null;
    @field('last_modified') lastModified: number;

    @relation('albums', 'album_id') album: any;
    @relation('artists', 'artist_id') artist: any;

    @children('track_tags') trackTags: any;
    @children('track_collaborators') trackCollaboratorsRelation: any;

    @lazy queryCollaborators = this.collections.get('artists').query(
        Q.on('track_collaborators', 'track_id', this.id)
    );

    @lazy queryTags = this.collections.get('tags').query(
        Q.on('track_tags', 'track_id', this.id)
    );

    async toggleLike(): Promise<void> {
        await this.database.write(async () => {
            await this.update(t => {
                t.isFavorite = !t.isFavorite;
            });
        });
    }
}