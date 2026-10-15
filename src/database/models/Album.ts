import { Model, Q } from "@nozbe/watermelondb";
import { getAlbumDisplayTitle } from '../../utils/libraryMetadata';
import {
  children,
  field,
  lazy,
  relation,
  text,
} from "@nozbe/watermelondb/decorators";

export default class Album extends Model {
  static readonly table = "albums";

  static readonly associations = {
    artists: { type: "belongs_to" as const, key: "artist_id" },
    tracks: { type: "has_many" as const, foreignKey: "album_id" },
    album_tags: { type: "has_many" as const, foreignKey: "album_id" },
  };

  @text("title") storedTitle: string;
  get title(): string { return getAlbumDisplayTitle(this.storedTitle); }
  set title(value: string) { this.storedTitle = value; }
  @text("normalized_title") normalizedTitle: string;
  @field("year") year: number | null; // isOptional en schema
  @text("cover_url") coverUrl: string | null; // isOptional en schema
  @text("cover_color") coverColor: string | null;
  @text("cover_color_source") coverColorSource: string | null;
  @text("cd_art_url") cdArtUrl: string | null;
  @field("is_pinned") isPinned: boolean;
  @field("is_excluded_from_shuffle") isExcludedFromShuffle: boolean;

  @relation("artists", "artist_id") artist: any;
  @children("tracks") tracks: any;
  @children("album_tags") albumTags: any;

  @lazy queryTags = this.collections.get('tags').query(
    Q.on('album_tags', 'album_id', this.id),
    Q.sortBy('name', Q.asc)
  );

  async toggleExcludeFromShuffle(): Promise<void> {
    await this.database.write(async () => {
      await this.update((a: any) => {
        a.isExcludedFromShuffle = !a.isExcludedFromShuffle;
      });
    });
  }

  async setExcludeFromShuffle(excluded: boolean): Promise<void> {
    await this.database.write(async () => {
      await this.update((a: any) => {
        a.isExcludedFromShuffle = excluded;
      });
    });
  }
}
