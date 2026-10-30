import { Database } from "@nozbe/watermelondb";
import type { DatabaseAdapter } from "@nozbe/watermelondb/adapters/type";
import Track from "../../../src/database/models/Track";
import Album from "../../../src/database/models/Album";
import Artist from "../../../src/database/models/Artist";
import Playlist from "../../../src/database/models/Playlist";
import Tag from "../../../src/database/models/Tag";
import PlaylistTrack from "../../../src/database/models/PlaylistTrack";
import TrackTag from "../../../src/database/models/TrackTag";
import AlbumTag from "../../../src/database/models/AlbumTag";
import TrackCollaborator from "../../../src/database/models/TrackCollaborator";
import PlaybackHistory from "../../../src/database/models/PlaybackHistory";
import PlaybackHistoryTag from "../../../src/database/models/PlaybackHistoryTag";
import SearchHistory from "../../../src/database/models/SearchHistory";
import AppNotification from "../../../src/database/models/AppNotification";

export { mySchema } from "../../../src/database/schema";
export { myMigrations } from "../../../src/database/migrations";
export function createLibraryDatabase(adapter: DatabaseAdapter): Database {
  return new Database({
    adapter,
    modelClasses: [
      Track,
      Album,
      Artist,
      Playlist,
      Tag,
      PlaylistTrack,
      TrackTag,
      AlbumTag,
      TrackCollaborator,
      PlaybackHistory,
      PlaybackHistoryTag,
      SearchHistory,
      AppNotification,
    ],
  });
}
