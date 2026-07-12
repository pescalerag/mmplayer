import { Model, Q } from "@nozbe/watermelondb";
import {
    children,
    field,
    relation,
    text,
    lazy,
} from "@nozbe/watermelondb/decorators";

export default class Album extends Model {
  static readonly table = "albums";

  static readonly associations = {
    artists: { type: "belongs_to" as const, key: "artist_id" },
    tracks: { type: "has_many" as const, foreignKey: "album_id" },
    album_tags: { type: "has_many" as const, foreignKey: "album_id" },
  };

  @text("title") title: string;
  @text("normalized_title") normalizedTitle: string;
  @field("year") year: number | null; // isOptional en schema
  @text("cover_url") coverUrl: string | null; // isOptional en schema
  @field("is_pinned") isPinned: boolean;

  @relation("artists", "artist_id") artist: any;
  @children("tracks") tracks: any;
  @children("album_tags") albumTags: any;

  @lazy queryTags = this.collections.get('tags').query(
      Q.on('album_tags', 'album_id', this.id),
      Q.sortBy('name', Q.asc)
  );
}
