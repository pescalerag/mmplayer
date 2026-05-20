import { Model } from '@nozbe/watermelondb';
import { relation } from '@nozbe/watermelondb/decorators';

export default class AlbumTag extends Model {
    static readonly table = 'album_tags';

    static readonly associations = {
        albums: { type: 'belongs_to' as const, key: 'album_id' },
        tags: { type: 'belongs_to' as const, key: 'tag_id' },
    };

    @relation('albums', 'album_id') album: any;
    @relation('tags', 'tag_id') tag: any;
}
