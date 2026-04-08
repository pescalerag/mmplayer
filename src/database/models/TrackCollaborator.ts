import { Model } from '@nozbe/watermelondb';
import { relation } from '@nozbe/watermelondb/decorators';

export default class TrackCollaborator extends Model {
    static readonly table = 'track_collaborators';

    static readonly associations = {
        tracks: { type: 'belongs_to' as const, key: 'track_id' },
        artists: { type: 'belongs_to' as const, key: 'artist_id' },
    };

    @relation('tracks', 'track_id') track: any;
    @relation('artists', 'artist_id') artist: any;
}
