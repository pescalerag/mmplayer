import { BACKUP_TABLES, mergeBackupData, validateBackupData } from '../utils/backupData';

const data = (tables: Record<string, object[]>) => validateBackupData(tables);
const current = () => data({
    artists: [{ id: 'artist', name: 'Artist' }],
    albums: [{ id: 'album', title: 'Album', artist_id: 'artist' }],
    tracks: [{ id: 'song', title: 'Song', album_id: 'album', artist_id: 'artist', file_url: 'content://local/1', duration: 180, rating: 4, lyrics_lrc: 'Current', is_favorite: true }],
    tags: [{ id: 'rock', name: 'Rock', color: '#FF0000' }],
    playlists: [{ id: 'list', name: 'My playlist' }],
    playlist_tracks: [{ id: 'entry', playlist_id: 'list', track_id: 'song', order: 0 }],
    playback_history: [{ id: 'listen', item_type: 'track', item_id: 'song', played_at: 123, duration_played: 100, play_context: 'queue' }],
});
const imported = () => data({
    artists: [{ id: 'other-artist', name: 'ARTIST' }],
    albums: [{ id: 'other-album', title: 'Album', artist_id: 'other-artist' }],
    tracks: [{ id: 'other-song', title: 'Song', album_id: 'other-album', artist_id: 'other-artist', file_url: 'content://old-phone/9', duration: 180, rating: 2, lyrics_lrc: 'Imported' }],
    tags: [{ id: 'other-rock', name: 'Rock', color: '#00FF00' }, { id: 'new-tag', name: 'New' }],
    playlists: [{ id: 'other-list', name: 'My playlist' }],
    playlist_tracks: [{ id: 'other-entry', playlist_id: 'other-list', track_id: 'other-song', order: 0 }, { id: 'repeat', playlist_id: 'other-list', track_id: 'other-song', order: 1 }],
    track_tags: [{ id: 'link', track_id: 'other-song', tag_id: 'other-rock' }],
    playback_history: [{ id: 'other-listen', item_type: 'track', item_id: 'other-song', played_at: 123, duration_played: 120, play_context: 'queue' }],
    playback_history_tags: [{ id: 'snapshot', history_id: 'other-listen', tag_id: 'other-rock', scope: 'track' }],
});

it.each(['current', 'imported'] as const)('merges identities, foreign keys and listen snapshots with %s conflict precedence', policy => {
    const result = mergeBackupData(current(), imported(), policy);
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]).toMatchObject({ id: 'song', file_url: 'content://local/1', rating: policy === 'current' ? 4 : 2, lyrics_lrc: policy === 'current' ? 'Current' : 'Imported' });
    expect(result.artists).toHaveLength(1); expect(result.albums).toHaveLength(1);
    expect(result.tags).toHaveLength(2);
    expect(result.track_tags[0]).toMatchObject({ track_id: 'song', tag_id: 'rock' });
    expect(result.playback_history).toHaveLength(1);
    expect(result.playback_history[0]).toMatchObject({ id: 'listen', item_id: 'song', duration_played: 120 });
    expect(result.playback_history_tags[0]).toMatchObject({ history_id: 'listen', tag_id: 'rock' });
    expect(result.playlist_tracks).toHaveLength(2);
    expect(result.playlist_tracks.map(row => [row.playlist_id, row.track_id, row.order])).toEqual([['list', 'song', 0], ['list', 'song', 1]]);
    expect(mergeBackupData(result, imported(), policy)).toEqual(result);
});

it('does not overwrite another song when different phones reuse a numeric MediaStore ID', () => {
    const result = mergeBackupData(data({ tracks: [{ id: '1', title: 'First', file_url: 'content://local/1', duration: 100 }] }),
        data({ tracks: [{ id: '1', title: 'Second', file_url: 'content://other/1', duration: 200 }], track_tags: [{ id: 'link', track_id: '1', tag_id: 'tag' }] }), 'imported');
    expect(result.tracks).toHaveLength(2);
    expect(result.tracks[1].id).not.toBe('1');
    expect(result.track_tags[0].track_id).toBe(result.tracks[1].id);
});

it('preserves fields absent from old backups and fills missing current values', () => {
    const result = mergeBackupData(data({ tracks: [{ id: 'song', rating: 4, lyrics_lrc: null, skip_segments: 'timestamps' }] }),
        data({ tracks: [{ id: 'song', lyrics_lrc: 'Lyrics' }] }), 'imported');
    expect(result.tracks[0]).toMatchObject({ rating: 4, lyrics_lrc: 'Lyrics', skip_segments: 'timestamps' });
});

it('matches legacy accented names against the scanner normalized identity', () => {
    const result = mergeBackupData(data({ artists: [{ id: 'local', name: 'Beyoncé', normalized_name: 'beyonce' }], tags: [{ id: 'tag', name: 'Épico', normalized_name: 'epico' }] }),
        data({ artists: [{ id: 'imported', name: 'Beyoncé' }], tags: [{ id: 'old-tag', name: 'Épico' }] }), 'current');
    expect(result.artists).toHaveLength(1); expect(result.tags).toHaveLength(1);
});

it('rejects invalid data before any restore and ignores unknown fields', () => {
    for (const value of [null, [], {}, { tracks: {} }, { tracks: [{ id: 'x', duration: 'bad' }] }, { tracks: [{ id: 'x' }, { id: 'x' }] }]) {
        expect(() => validateBackupData(value)).toThrow();
    }
    expect(data({ tracks: [{ id: 'song', unknown_column: 'ignored', _status: 'deleted' }] }).tracks[0]).toEqual({ id: 'song' });
    expect(Object.keys(data({ tracks: [] })).sort()).toEqual([...BACKUP_TABLES].sort());
});
