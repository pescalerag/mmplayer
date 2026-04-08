import { Model } from '@nozbe/watermelondb';
import { field, relation } from '@nozbe/watermelondb/decorators';

export default class PlaylistTrack extends Model {
    static readonly table = 'playlist_tracks';

    static readonly associations = {
        playlists: { type: 'belongs_to' as const, key: 'playlist_id' },
        tracks: { type: 'belongs_to' as const, key: 'track_id' },
    };

    @field('order') order: number;

    @relation('playlists', 'playlist_id') playlist: any;
    @relation('tracks', 'track_id') track: any;
}
