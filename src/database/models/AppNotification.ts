import { Model } from '@nozbe/watermelondb';
import { field, text, date } from '@nozbe/watermelondb/decorators';

export type NotificationType =
  | 'songs_added'
  | 'songs_moved'
  | 'songs_deleted'
  | 'summary_weekly'
  | 'summary_monthly'
  | 'summary_yearly'
  | 'app_update';

export default class AppNotification extends Model {
  static readonly table = 'notifications';

  @text('type') type!: NotificationType;
  @text('title') title!: string;
  @text('description') description?: string | null;
  @date('created_at') createdAt!: Date;
  @field('is_read') isRead!: boolean;
  @text('action_type') actionType?: string | null;
  @text('action_payload') actionPayload?: string | null;
}
