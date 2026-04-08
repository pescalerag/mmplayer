import { Model } from '@nozbe/watermelondb';
import { children, field, text } from '@nozbe/watermelondb/decorators';

export default class Playlist extends Model {
    static readonly table = 'playlists';

    static readonly associations = {
        playlist_tracks: { type: 'has_many' as const, foreignKey: 'playlist_id' },
    };

    @text('name') name: string;
    @text('description') description: string | null;        // isOptional en schema
    @text('cover_custom_url') coverCustomUrl: string | null;   // isOptional en schema
    @text('header_custom_url') headerCustomUrl: string | null; // isOptional en schema

    @field('created_at') createdAt: number;

    @children('playlist_tracks') playlistTracks: any;
}