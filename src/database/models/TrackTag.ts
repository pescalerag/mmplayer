import { Model } from '@nozbe/watermelondb';
import { relation } from '@nozbe/watermelondb/decorators';

export default class TrackTag extends Model {
    static readonly table = 'track_tags';

    static readonly associations = {
        tracks: { type: 'belongs_to' as const, key: 'track_id' },
        tags: { type: 'belongs_to' as const, key: 'tag_id' },
    };

    @relation('tracks', 'track_id') track: any;
    @relation('tags', 'tag_id') tag: any;
}
