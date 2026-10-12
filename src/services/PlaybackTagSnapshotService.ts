import { Model, Q } from '@nozbe/watermelondb';
import { database } from '../database';
import Track from '../database/models/Track';
import TrackTag from '../database/models/TrackTag';
import AlbumTag from '../database/models/AlbumTag';
import PlaybackHistoryTag, { TagHistoryScope } from '../database/models/PlaybackHistoryTag';

interface TagSnapshot {
  track: string[];
  album: string[];
}

export const PlaybackTagSnapshotService = {
  async capture(track: Track | null): Promise<TagSnapshot | null> {
    if (!track) return null;
    const trackTags = await database.collections.get<TrackTag>('track_tags')
      .query(Q.where('track_id', track.id)).fetch();
    const albumId = track.album.id;
    let albumTags: AlbumTag[] = [];
    if (albumId) {
      albumTags = await database.collections.get<AlbumTag>('album_tags')
        .query(Q.where('album_id', albumId)).fetch();
    }
    return { track: Array.from(new Set(trackTags.map(link => link.tag.id))), album: Array.from(new Set(albumTags.map(link => link.tag.id))) };
  },

  prepareRecords(historyId: string, snapshot: TagSnapshot | null): Model[] {
    if (!snapshot) return [];
    const collection = database.collections.get<PlaybackHistoryTag>('playback_history_tags');
    const scopes: TagHistoryScope[] = ['track', 'album'];
    return scopes.flatMap(scope => snapshot[scope].map(tagId => collection.prepareCreate(record => {
      record.historyId = historyId;
      record.tagId = tagId;
      record.scope = scope;
    })));
  },

  async prepareHistoryDeletion(records: readonly Model[]): Promise<Model[]> {
    if (records.length === 0) return [];
    const links = await database.collections.get<PlaybackHistoryTag>('playback_history_tags')
      .query(Q.where('history_id', Q.oneOf(records.map(record => record.id)))).fetch();
    return [...links.map(link => link.prepareDestroyPermanently()), ...records.map(record => record.prepareDestroyPermanently())];
  },
};
