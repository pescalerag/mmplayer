import { Model } from '@nozbe/watermelondb';
import { children, text, field } from '@nozbe/watermelondb/decorators';
import { getArtistDisplayName } from '../../utils/libraryMetadata';



export default class Artist extends Model {
    static readonly table = 'artists';

    static readonly associations = {
        albums: { type: 'has_many' as const, foreignKey: 'artist_id' },
        track_collaborators: { type: 'has_many' as const, foreignKey: 'artist_id' },
    };

    @text('name') storedName: string;
    get name(): string { return getArtistDisplayName(this.storedName); }
    set name(value: string) { this.storedName = value; }
    @text('normalized_name') normalizedName: string;
    @text('image_url') imageUrl: string | null; // isOptional en schema
    @field('is_pinned') isPinned: boolean;

    @children('albums') albums: any;
    @children('track_collaborators') trackCollaborators: any;
}
