import { Model } from '@nozbe/watermelondb';
import { date, field, text } from '@nozbe/watermelondb/decorators';

export default class PlaybackHistory extends Model {
    static readonly table = 'playback_history';

    @field('item_id') itemId: string;
    @field('item_type') itemType: string;
    @text('play_context') playContext: string; 
    @field('duration_played') durationPlayed: number | null; 
    @date('played_at') playedAt: Date;
}