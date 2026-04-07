import { Model } from '@nozbe/watermelondb';
import { children, field, text } from '@nozbe/watermelondb/decorators';

export default class Tag extends Model {
    static table = 'tags';

    static associations = {
        track_tags: { type: 'has_many' as const, foreignKey: 'tag_id' },
    };

    @text('name') name: string;
    @text('color') color: string;
    @field('is_auto') isAuto: boolean; // true para "MP3 320kbps", false para "Vinyl-Rip"

    @children('track_tags') trackTags: any;
}