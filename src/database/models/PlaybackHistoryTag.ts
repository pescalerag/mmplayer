import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export type TagHistoryScope = 'track' | 'album';

export default class PlaybackHistoryTag extends Model {
  static readonly table = 'playback_history_tags';
  @field('history_id') historyId: string;
  @field('tag_id') tagId: string;
  @field('scope') scope: TagHistoryScope;
}
