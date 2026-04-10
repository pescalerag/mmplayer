import { Model } from '@nozbe/watermelondb';
import { date, readonly, text } from '@nozbe/watermelondb/decorators';

export default class SearchHistory extends Model {
    static readonly table = 'search_history';

    @text('query') query: string;

    @readonly @date('updated_at') updatedAt: Date;
}
