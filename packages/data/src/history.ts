import { Database, Model, Q } from "@nozbe/watermelondb";
import type Track from "../../../src/database/models/Track";
import type TrackTag from "../../../src/database/models/TrackTag";
import type AlbumTag from "../../../src/database/models/AlbumTag";
import type PlaybackHistoryTag from "../../../src/database/models/PlaybackHistoryTag";
import type { TagHistoryScope } from "../../../src/database/models/PlaybackHistoryTag";

export interface TagSnapshot {
  track: string[];
  album: string[];
}

export function evaluateListenDuration(
  durationSeconds: number | null | undefined,
  listenedSeconds: number,
) {
  if (
    typeof durationSeconds === "number" &&
    Number.isFinite(durationSeconds) &&
    durationSeconds > 0
  ) {
    const capped = Math.min(listenedSeconds, durationSeconds);
    const minimum = durationSeconds * 0.5;
    return {
      seconds: capped,
      minimum,
      eligible: capped >= 10 && capped >= minimum,
    };
  }
  const capped = Math.min(listenedSeconds, 600);
  return {
    seconds: capped,
    minimum: 20,
    eligible: capped >= 20,
  };
}

export function createPlaybackTagSnapshotService(
  defaultDb?: Pick<Database, "collections">,
) {
  const resolveDb = (db?: Pick<Database, "collections">) => {
    const target = db ?? defaultDb;
    if (!target) {
      throw new Error("Database instance required for PlaybackTagSnapshotService");
    }
    return target;
  };

  return {
    async capture(
      track: Track | null,
      db?: Pick<Database, "collections">,
    ): Promise<TagSnapshot | null> {
      if (!track) return null;
      const targetDb = resolveDb(db);
      const trackTags = await targetDb.collections
        .get<TrackTag>("track_tags")
        .query(Q.where("track_id", track.id))
        .fetch();
      const albumId = track.album?.id;
      let albumTags: AlbumTag[] = [];
      if (albumId) {
        albumTags = await targetDb.collections
          .get<AlbumTag>("album_tags")
          .query(Q.where("album_id", albumId))
          .fetch();
      }
      return {
        track: Array.from(new Set(trackTags.map((link) => link.tag.id))),
        album: Array.from(new Set(albumTags.map((link) => link.tag.id))),
      };
    },

    prepareRecords(
      historyId: string,
      snapshot: TagSnapshot | null,
      db?: Pick<Database, "collections">,
    ): Model[] {
      if (!snapshot) return [];
      const targetDb = resolveDb(db);
      const collection = targetDb.collections.get<PlaybackHistoryTag>(
        "playback_history_tags",
      );
      const scopes: TagHistoryScope[] = ["track", "album"];
      return scopes.flatMap((scope) =>
        snapshot[scope].map((tagId) =>
          collection.prepareCreate((record) => {
            record.historyId = historyId;
            record.tagId = tagId;
            record.scope = scope;
          }),
        ),
      );
    },

    async prepareHistoryDeletion(
      records: readonly Model[],
      db?: Pick<Database, "collections">,
    ): Promise<Model[]> {
      if (records.length === 0) return [];
      const targetDb = resolveDb(db);
      const links = await targetDb.collections
        .get<PlaybackHistoryTag>("playback_history_tags")
        .query(Q.where("history_id", Q.oneOf(records.map((record) => record.id))))
        .fetch();
      return [
        ...links.map((link) => link.prepareDestroyPermanently()),
        ...records.map((record) => record.prepareDestroyPermanently()),
      ];
    },
  };
}
