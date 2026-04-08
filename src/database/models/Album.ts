import { Model } from '@nozbe/watermelondb';
import { children, field, relation, text } from '@nozbe/watermelondb/decorators';

export default class Album extends Model {
    static readonly table = 'albums';

    static readonly associations = {
        artists: { type: 'belongs_to' as const, key: 'artist_id' },
        tracks: { type: 'has_many' as const, foreignKey: 'album_id' },
    };

    @text('title') title: string;
    @field('year') year: number | null;         // isOptional en schema
    @text('cover_url') coverUrl: string | null;  // isOptional en schema

    @relation('artists', 'artist_id') artist: any;
    @children('tracks') tracks: any;
}
