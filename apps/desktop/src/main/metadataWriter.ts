import { copyFile, rename, rm, stat, access } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { File, Picture } from "node-taglib-sharp";
import { parseFile } from "music-metadata";
import type { FileMetadata } from "@mmplayer/platform";

/** Never mutate the original in place: a failed write/verification leaves it intact. */
export async function writeFileMetadata(path: string, patch: FileMetadata) {
  await access(path, constants.W_OK);
  const before = await stat(path);
  const temporary = join(
    dirname(path),
    `.${basename(path)}.${randomUUID()}.mmplayer${extname(path)}`,
  );
  try {
    await copyFile(path, temporary, constants.COPYFILE_EXCL);
    const file = File.createFromPath(temporary);
    try {
      const tag = file.tag;
      if (patch.title != null) tag.title = patch.title;
      if (patch.album != null) tag.album = patch.album;
      if (patch.artist != null)
        tag.performers = patch.artist ? [patch.artist] : [];
      if (patch.albumArtist != null)
        tag.albumArtists = patch.albumArtist ? [patch.albumArtist] : [];
      if (patch.genre != null) tag.genres = patch.genre ? [patch.genre] : [];
      if (patch.year != null) tag.year = patch.year;
      if (patch.trackNumber != null) tag.track = patch.trackNumber;
      if (patch.discNumber != null) tag.disc = patch.discNumber;
      if (patch.coverArtPath != null)
        tag.pictures = patch.coverArtPath
          ? [Picture.fromPath(patch.coverArtPath)]
          : [];
      file.save();
    } finally {
      file.dispose();
    }
    const { common } = await parseFile(temporary);
    const values = {
      title: common.title ?? "",
      album: common.album ?? "",
      artist: common.artist ?? "",
      albumArtist: common.albumartist ?? "",
      genre: common.genre?.join(", ") ?? "",
      year: common.year ?? 0,
      trackNumber: common.track.no ?? 0,
      discNumber: common.disk.no ?? 0,
    };
    for (const [key, expected] of Object.entries(patch)) {
      if (expected == null || key === "coverArtPath") continue;
      if (values[key as keyof typeof values] !== expected)
        throw Error(`Metadata verification failed: ${key}`);
    }
    const current = await stat(path);
    if (current.size !== before.size || current.mtimeMs !== before.mtimeMs)
      throw Error("The original file changed while saving. Retry the edit.");
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}
