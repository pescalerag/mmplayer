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
    @text('file_url') fileUrl: string;
    @field('duration') duration: number;
    @field('is_favorite') isFavorite: boolean;
    @field('track_number') trackNumber: number | null;
    @field('disc_number') discNumber: number | null;

    @relation('albums', 'album_id') album: any;
    @relation('artists', 'artist_id') artist: any;

    @children('track_tags') trackTags: any;
    @children('track_collaborators') trackCollaboratorsRelation: any;

    @lazy queryCollaborators = this.collections.get('artists').query(
        Q.on('track_collaborators', 'track_id', this.id)
    );
}