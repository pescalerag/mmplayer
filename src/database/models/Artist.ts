import { Model } from '@nozbe/watermelondb';
import { children, text } from '@nozbe/watermelondb/decorators';



export default class Artist extends Model {
    static readonly table = 'artists';

    static readonly associations = {
        albums: { type: 'has_many' as const, foreignKey: 'artist_id' },
        track_collaborators: { type: 'has_many' as const, foreignKey: 'artist_id' },
    };

    @text('name') name: string;
    @text('normalized_name') normalizedName: string;
    @text('image_url') imageUrl: string | null; // isOptional en schema

    @children('albums') albums: any;
    @children('track_collaborators') trackCollaborators: any;
}
