import { archiveSize, createArchive, extractArchive } from "./archives";
import { replaceFile } from './atomicFile';
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { pathToFileURL, fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import {
  statfs,
  mkdir,
  readFile,
  writeFile,
  rename,
  stat,
  opendir,
  access,
  copyFile,
  readdir,
  rm,
} from "node:fs/promises";
import {
  join,
  resolve,
  extname,
  basename,
  dirname,
  normalize,
  isAbsolute,
  sep,
} from "node:path";
import { parseFile } from "music-metadata";
import { Q } from "@nozbe/watermelondb";
import { sanitizedRaw } from "@nozbe/watermelondb/RawRecord";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";
import { createLibraryDatabase, mySchema, myMigrations } from "@mmplayer/data";
import { createPlaylistService } from "@mmplayer/data/playlists";
import {
  createPlaybackTagSnapshotService,
  evaluateListenDuration,
} from "@mmplayer/data/history";
import { normalizeSkipSegments } from "@mmplayer/core/timestamps";
import type { LibrarySnapshot, ScanProgress } from "@mmplayer/platform";
import type {
  FileMetadata,
  FileSystemRequest,
  MetadataWriteItem,
  MetadataWriteResult,
} from "@mmplayer/platform";
import type Track from "../../../../src/database/models/Track";
import type Album from "../../../../src/database/models/Album";
import type Artist from "../../../../src/database/models/Artist";
import type Playlist from "../../../../src/database/models/Playlist";
import type Tag from "../../../../src/database/models/Tag";
import type PlaylistTrack from "../../../../src/database/models/PlaylistTrack";
import type TrackTag from "../../../../src/database/models/TrackTag";
import type PlaybackHistory from "../../../../src/database/models/PlaybackHistory";
import type TrackCollaborator from "../../../../src/database/models/TrackCollaborator";
import {
  UNKNOWN_ARTIST,
  UNKNOWN_ALBUM,
  VARIOUS_ARTISTS,
  getArtistStorageName,
  getAlbumStorageTitle,
} from "../../../../src/utils/libraryMetadata";
import i18n from "../../../../src/constants/i18n";
import { readReplayGainTags } from "./replayGainReader";

const PlaybackTagSnapshotService = createPlaybackTagSnapshotService();

const INDEX_VERSION = 2;
const EXCLUSIONS_LOCAL_KEY = "mmplayer_exclusions";

const DISC_SUFFIX_RE =
  /\s*(?:[\(\[\{]\s*(?:cd|disc|disco|disk)\s*[-_#.]?\s*0*(\d+)(?:\s*(?:\/|of|de)\s*\d+)?\s*(?:[:\-–—]\s*[^)\]\}]*)?[\)\]\}]|(?:[-–—,:|/]\s*|\s+)(?:cd|disc|disco|disk)\s*[-_#.]?\s*0*(\d+)(?:\s*(?:\/|of|de)\s*\d+)?)\s*$/i;
const DISC_FOLDER_RE = /^(?:cd|disc|disco|disk)\s*[-_#.]?\s*0*(\d+)(?:\b.*)?$/i;

function parseAlbumAndDisc(
  rawAlbum: string | undefined,
  filePath: string,
  tagDiscNo: number | null | undefined,
): { albumName: string; discNumber: number } {
  let cleanedAlbum = (rawAlbum || "").trim();
  let discFromAlbum: number | null = null;
  if (cleanedAlbum) {
    const match = cleanedAlbum.match(DISC_SUFFIX_RE);
    if (match) {
      const parsed = parseInt(match[1] || match[2], 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        discFromAlbum = parsed;
        cleanedAlbum = cleanedAlbum.slice(0, match.index).trim();
      }
    }
  }
  const parentDir = filePath ? basename(dirname(filePath)) : "";
  let discFromFolder: number | null = null;
  const folderMatch = parentDir.match(DISC_FOLDER_RE);
  if (folderMatch) {
    const parsed = parseInt(folderMatch[1], 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      discFromFolder = parsed;
    }
  }
  if (cleanedAlbum && DISC_FOLDER_RE.test(cleanedAlbum)) {
    const m = cleanedAlbum.match(DISC_FOLDER_RE);
    if (m && !discFromAlbum) discFromAlbum = parseInt(m[1], 10);
    cleanedAlbum = "";
  }
  if (!cleanedAlbum && discFromFolder !== null && filePath) {
    const grandParentDir = dirname(dirname(filePath));
    const grandParent = basename(grandParentDir);
    if (grandParent && grandParent !== "." && grandParent !== grandParentDir) {
      cleanedAlbum = grandParent;
    }
  }
  const finalAlbum =
    getAlbumStorageTitle(cleanedAlbum || UNKNOWN_ALBUM) || UNKNOWN_ALBUM;
  const discNumber =
    (typeof tagDiscNo === "number" && tagDiscNo > 0 ? tagDiscNo : null) ??
    discFromAlbum ??
    discFromFolder ??
    1;
  return { albumName: finalAlbum, discNumber };
}

const normalizeUrlKey = (url: string) => {
  const clean = url.replace(/#/g, "%23").replace(/\/+$/, "");
  return process.platform === "win32" ? clean.toLowerCase() : clean;
};

const audioExtensions = new Set([
  ".mp3",
  ".flac",
  ".ogg",
  ".opus",
  ".m4a",
  ".aac",
  ".wav",
  ".wma",
  ".aiff",
  ".aif",
  ".ape",
  ".wv",
]);
const identity = (text: string) => text.normalize("NFC").trim().toLowerCase();
const stableId = (text: string) =>
  createHash("sha256").update(text).digest("hex").slice(0, 32);
const fileId = (path: string) =>
  stableId(
    process.platform === "win32"
      ? normalize(path).toLowerCase()
      : normalize(path),
  );
interface FileEntry {
  path: string;
  modified: number;
  size: number;
  available: boolean;
  cover?: string;
}
interface FileIndex {
  version?: number;
  roots: string[];
  files: Record<string, FileEntry>;
  excludedFolders?: string[];
  excludedSongs?: string[];
}

async function* walk(root: string): AsyncGenerator<string> {
  const info = await stat(root);
  if (info.isFile()) {
    if (audioExtensions.has(extname(root).toLowerCase())) yield root;
    return;
  }
  const directory = await opendir(root);
  for await (const entry of directory) {
    if (entry.isDirectory()) yield* walk(join(root, entry.name));
    else if (
      entry.isFile() &&
      audioExtensions.has(extname(entry.name).toLowerCase())
    )
      yield join(root, entry.name);
  }
}

export class DesktopLibrary {
  private database;
  private playlists;
  private index: FileIndex = { roots: [], files: {} };
  private indexWrite: Promise<void> = Promise.resolve();
  private runningScan: Promise<number> | null = null;
  private metadataBatchId?: string;
  private metadataCancelled = false;
  private ready: Promise<void>;
  constructor(
    private directory: string,
    private notify: (
      event: "library" | "scan" | "error" | "database" | "metadataProgress" | "musicZipProgress",
      data?: unknown,
    ) => void,
  ) {
    // WatermelonDB publishes CommonJS. esbuild's Node ESM interop preserves that
    // module object; normalize its default export at this boundary only.
    const Adapter =
      (SQLiteAdapter as unknown as { default?: typeof SQLiteAdapter })
        .default ?? SQLiteAdapter;
    const adapter = new Adapter({
      dbName: join(directory, "library.db"),
      schema: mySchema,
      migrations: myMigrations,
    });
    this.database = createLibraryDatabase(adapter);
    for (const table of Object.keys(mySchema.tables)) {
      this.database.get(table).changes.subscribe((changes) => {
        this.notify("database", {
          source: this.rendererWrite ? "renderer" : "worker",
          table,
          changes: changes.map((change) => ({
            type: change.type,
            raw: { ...change.record._raw },
          })),
        });
      });
    }
    this.playlists = createPlaylistService(this.database, {
      readInitialCover: async (id) =>
        this.index.files[id]?.cover ? `mmplayer-media://cover/${id}` : null,
      removeCover: async () => {},
    });
    this.ready = (async () => {
      await adapter.initializingPromise;
      await mkdir(join(directory, "artwork"), { recursive: true });
      try {
        const saved = JSON.parse(
          await readFile(join(directory, "library-files.json"), "utf8"),
        );
        if (
          !Array.isArray(saved.roots) ||
          !saved.files ||
          typeof saved.files !== "object"
        )
          throw Error("Invalid file index");
        this.index = saved;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT")
          this.notify(
            "error",
            "Could not read the desktop library file index.",
          );
      }
    })();
  }
  async initialize(language?: string) {
    await this.ready;
    if (language && ["en", "es", "pt"].includes(language))
      await i18n.changeLanguage(language);
  }
  private rendererWrite = false;
  /** Existing mobile models and queries execute against the worker's SQLite database. */
  async databaseRequest(input: { method: string; args: any[] }) {
    await this.ready;
    const { method, args } = input;
    const adapter = this.database.adapter;
    const checkTable = (table: string) => {
      if (!Object.hasOwn(mySchema.tables, table))
        throw Error("Invalid library table");
    };
    if (method === "find") {
      checkTable(args[0]);
      return this.database
        .get(args[0])
        .find(args[1])
        .then((record) => ({ ...record._raw }))
        .catch(() => null);
    }
    if (["query", "queryIds", "count", "unsafeQueryRaw"].includes(method)) {
      checkTable(args[0].table);
      if (method === "query") {
        const rows = (await adapter.unsafeQueryRaw(args[0])) as Record<
          string,
          unknown
        >[];
        const tableSchema = mySchema.tables[args[0].table];
        return rows.map((raw) => sanitizedRaw(raw, tableSchema));
      }
      if (method === "queryIds") return adapter.queryIds(args[0]);
      if (method === "count") return adapter.count(args[0]);
      return adapter.unsafeQueryRaw(args[0]);
    }
    if (method === "getLocal") return adapter.getLocal(args[0]);
    if (method === "setLocal") {
      await adapter.setLocal(args[0], args[1]);
      if (args[0] === EXCLUSIONS_LOCAL_KEY && typeof args[1] === "string") {
        try {
          const parsed = JSON.parse(args[1]);
          if (Array.isArray(parsed?.excludedFolders))
            this.index.excludedFolders = parsed.excludedFolders;
          if (Array.isArray(parsed?.excludedSongs))
            this.index.excludedSongs = parsed.excludedSongs;
          await this.saveIndex();
        } catch {
          // Ignore malformed exclusion payload
        }
      }
      return;
    }
    if (method === "removeLocal") return adapter.removeLocal(args[0]);
    if (method !== "batch")
      throw Error("Unsupported library operation: " + method);
    await this.database.write(async () => {
      const prepared = [];
      for (const [kind, table, value] of args[0]) {
        checkTable(table);
        const collection = this.database.get(table);
        if (kind === "create")
          prepared.push(collection.prepareCreateFromDirtyRaw(value));
        else {
          const record = await collection.find(
            typeof value === "string" ? value : value.id,
          );
          if (kind === "update")
            prepared.push(
              record.prepareUpdate((model) => {
                Object.assign(model._raw, value);
              }),
            );
          else if (kind === "markAsDeleted")
            prepared.push(record.prepareMarkAsDeleted());
          else if (kind === "destroyPermanently")
            prepared.push(record.prepareDestroyPermanently());
          else throw Error("Invalid library write");
        }
      }
      this.rendererWrite = true;
      try {
        await this.database.batch(prepared);
      } finally {
        this.rendererWrite = false;
      }
    });
    this.notify("library");
  }
  private async saveIndex() {
    const file = join(this.directory, "library-files.json");
    const content = JSON.stringify(this.index);
    const write = this.indexWrite.catch(() => {}).then(async () => {
      await writeFile(file + '.pending', content, 'utf8');
      await replaceFile(file + '.pending', file);
    });
    this.indexWrite = write;
    await write;
  }
  private async loadExclusions() {
    try {
      const raw = await this.database.adapter.getLocal(EXCLUSIONS_LOCAL_KEY);
      if (typeof raw === "string" && raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.excludedFolders))
          this.index.excludedFolders = parsed.excludedFolders;
        if (Array.isArray(parsed?.excludedSongs))
          this.index.excludedSongs = parsed.excludedSongs;
      }
    } catch {
      // Ignore
    }
    return {
      excludedFolders: this.index.excludedFolders || [],
      excludedSongs: this.index.excludedSongs || [],
    };
  }
  async addRoots(roots: string[]) {
    await this.ready;
    const resolvedRoots = roots.map((path) => resolve(path));
    this.index.roots = [...new Set([...this.index.roots, ...resolvedRoots])];
    const { excludedFolders, excludedSongs } = await this.loadExclusions();
    if (excludedFolders.length > 0 || excludedSongs.length > 0) {
      const rootKeys = resolvedRoots.map((r) =>
        normalizeUrlKey(pathToFileURL(r).href),
      );
      const nextFolders = excludedFolders.filter((folderUrl) => {
        const fKey = normalizeUrlKey(folderUrl);
        return !rootKeys.some(
          (rKey) =>
            fKey === rKey ||
            fKey.startsWith(rKey + "/") ||
            rKey.startsWith(fKey + "/"),
        );
      });
      const nextSongs = excludedSongs.filter((songUrl) => {
        const sKey = normalizeUrlKey(songUrl);
        return !rootKeys.some(
          (rKey) => sKey === rKey || sKey.startsWith(rKey + "/"),
        );
      });
      if (
        nextFolders.length !== excludedFolders.length ||
        nextSongs.length !== excludedSongs.length
      ) {
        this.index.excludedFolders = nextFolders;
        this.index.excludedSongs = nextSongs;
        await this.database.adapter.setLocal(
          EXCLUSIONS_LOCAL_KEY,
          JSON.stringify({
            excludedFolders: nextFolders,
            excludedSongs: nextSongs,
          }),
        );
      }
    }
    await this.saveIndex();
    return this.scan();
  }
  async importPaths(paths: string[]) {
    if (!Array.isArray(paths) || paths.length > 10000)
      throw Error("Invalid dropped files");
    const roots: string[] = [];
    for (const path of paths) {
      if (typeof path !== "string" || !isAbsolute(path))
        throw Error("Invalid dropped path");
      const info = await stat(path);
      if (
        info.isDirectory() ||
        (info.isFile() && audioExtensions.has(extname(path).toLowerCase()))
      )
        roots.push(resolve(path));
    }
    if (!roots.length) return { imported: 0, trackIds: [] };
    const imported = await this.addRoots(roots);
    const key = (path: string) =>
      process.platform === "win32"
        ? normalize(path).toLowerCase()
        : normalize(path);
    const keys = roots.map(key);
    const trackIds = Object.entries(this.index.files)
      .filter(([, entry]) => {
        const path = key(entry.path);
        return (
          entry.available &&
          keys.some(
            (root) =>
              path === root ||
              path.startsWith(
                root + (process.platform === "win32" ? "\\" : "/"),
              ),
          )
        );
      })
      .map(([id]) => id);
    return { imported, trackIds };
  }
  async excludeFolders(folderPaths: string[]): Promise<number> {
    await this.ready;
    const { excludedFolders, excludedSongs } = await this.loadExclusions();
    const folderUrls = folderPaths.map((p) =>
      p.startsWith("file://") ? p : pathToFileURL(resolve(p)).href,
    );
    const updated = [...new Set([...excludedFolders, ...folderUrls])];
    this.index.excludedFolders = updated;
    await this.database.adapter.setLocal(
      EXCLUSIONS_LOCAL_KEY,
      JSON.stringify({
        excludedFolders: updated,
        excludedSongs,
      }),
    );
    await this.saveIndex();
    return this.scan();
  }
  async excludeSongs(songIdsOrUrls: string[]): Promise<number> {
    await this.ready;
    const { excludedFolders, excludedSongs } = await this.loadExclusions();
    const newSongs: string[] = [];
    for (const item of songIdsOrUrls) {
      if (item.startsWith("file://")) {
        newSongs.push(item);
      } else {
        const entry = this.index.files[item];
        if (entry?.path) {
          newSongs.push(pathToFileURL(entry.path).href);
        } else {
          try {
            const track = await this.database.get<Track>("tracks").find(item);
            if (track?.fileUrl) {
              newSongs.push(track.fileUrl);
            }
          } catch {
            // Not found
          }
        }
      }
    }
    const updated = [...new Set([...excludedSongs, ...newSongs])];
    this.index.excludedSongs = updated;
    await this.database.adapter.setLocal(
      EXCLUSIONS_LOCAL_KEY,
      JSON.stringify({
        excludedFolders,
        excludedSongs: updated,
      }),
    );
    await this.saveIndex();
    return this.scan();
  }
  async repairCollaborators(): Promise<number> {
    await this.ready;
    const tracks = await this.database.get<Track>("tracks").query().fetch();
    const artists = this.database.get<Artist>("artists");
    const credits = this.database.get<TrackCollaborator>("track_collaborators");
    const artistMap = new Map((await artists.query().fetch()).map(artist => [identity(artist.storedName), artist]));
    let repaired = 0;
    for (const track of tracks) {
      const entry = this.index.files[track.id];
      if (!entry?.available) continue;
      let names: string[];
      try {
        const { common } = await parseFile(entry.path);
        names = [...new Set((common.artists?.length ? common.artists.join(";") : common.artist || UNKNOWN_ARTIST)
          .split(/[~;,]/).map(name => getArtistStorageName(name.trim())).filter(Boolean))];
      } catch (error) {
        console.warn("Could not repair collaborators:", entry.path, error);
        continue;
      }
      if (!names.length) names = [UNKNOWN_ARTIST];
      await this.database.write(async () => {
        const ids: string[] = [];
        for (const name of names) {
          const key = identity(name);
          let artist = artistMap.get(key);
          if (!artist) {
            artist = await artists.create(record => { record.storedName = name; record.normalizedName = key; });
            artistMap.set(key, artist);
          }
          ids.push(artist.id);
        }
        const existing = await credits.query(Q.where("track_id", track.id)).fetch();
        const kept = new Set<string>();
        for (const credit of existing) {
          if (!ids.includes(credit.artist.id) || kept.has(credit.artist.id)) await credit.destroyPermanently();
          else kept.add(credit.artist.id);
        }
        for (const id of ids) if (!kept.has(id)) await credits.create(record => {
          record._raw.id = stableId(`credit:${track.id}:${id}`);
          record.track.id = track.id; record.artist.id = id;
        });
        if (track.artist.id !== ids[0]) await track.update(record => { record.artist.id = ids[0]; });
      });
      repaired++;
    }
    this.notify("library");
    return repaired;
  }
  scan(): Promise<number> {
    if (this.runningScan) return this.runningScan;
    this.runningScan = this.scanFiles().finally(() => {
      this.runningScan = null;
    });
    return this.runningScan;
  }
  private async cleanupOrphanedEntities() {
    const [allTracks, allAlbums, allArtists, allCollabs] = await Promise.all([
      this.database.get<Track>("tracks").query().fetch(),
      this.database.get<Album>("albums").query().fetch(),
      this.database.get<Artist>("artists").query().fetch(),
      this.database
        .get<TrackCollaborator>("track_collaborators")
        .query()
        .fetch(),
    ]);
    const activeAlbumIds = new Set<string>();
    const activeArtistIds = new Set<string>();
    const validTrackIds = new Set<string>();
    for (const t of allTracks) {
      validTrackIds.add(t.id);
      if (t.album.id) activeAlbumIds.add(t.album.id);
      if (t.artist.id) activeArtistIds.add(t.artist.id);
    }
    const orphanCollabs = allCollabs.filter(
      (c) => !validTrackIds.has(c.track.id),
    );
    const orphanAlbums = allAlbums.filter((a) => !activeAlbumIds.has(a.id));
    for (const a of allAlbums) {
      if (activeAlbumIds.has(a.id) && a.artist.id) {
        activeArtistIds.add(a.artist.id);
      }
    }
    for (const c of allCollabs) {
      if (validTrackIds.has(c.track.id) && c.artist.id) {
        activeArtistIds.add(c.artist.id);
      }
    }
    const orphanArtists = allArtists.filter((a) => !activeArtistIds.has(a.id));
    if (
      orphanCollabs.length > 0 ||
      orphanAlbums.length > 0 ||
      orphanArtists.length > 0
    ) {
      await this.database.write(async () => {
        await this.database.batch(
          ...orphanCollabs.map((c) => c.prepareDestroyPermanently()),
          ...orphanAlbums.map((a) => a.prepareDestroyPermanently()),
          ...orphanArtists.map((a) => a.prepareDestroyPermanently()),
        );
      });
    }
  }
  private async scanFiles() {
    await this.ready;
    const needsMigration = this.index.version !== INDEX_VERSION;
    const { excludedFolders, excludedSongs } = await this.loadExclusions();
    const excludedFolderKeys = excludedFolders.map(normalizeUrlKey);
    const excludedSongKeys = new Set(excludedSongs.map(normalizeUrlKey));
    const isUrlExcluded = (fileUrl: string) => {
      if (excludedFolderKeys.length === 0 && excludedSongKeys.size === 0)
        return false;
      const key = normalizeUrlKey(fileUrl);
      if (excludedSongKeys.has(key)) return true;
      const lastSlash = key.lastIndexOf("/");
      const dirKey = lastSlash !== -1 ? key.substring(0, lastSlash) : "";
      return excludedFolderKeys.some(
        (folderKey) =>
          dirKey === folderKey || dirKey.startsWith(folderKey + "/"),
      );
    };
    const seen = new Set<string>();
    const progress: ScanProgress = {
      completed: 0,
      discovered: 0,
      active: true,
      errors: 0,
    };
    this.notify("scan", { ...progress });
    const [tracks, artists, albums] = await Promise.all([
      this.database.get<Track>("tracks").query().fetch(),
      this.database.get<Artist>("artists").query().fetch(),
      this.database.get<Album>("albums").query().fetch(),
    ]);
    const trackMap = new Map(tracks.map((track) => [track.id, track]));
    const artistMap = new Map(
      artists.map((artist) => [identity(artist.storedName), artist]),
    );
    const albumMap = new Map<string, Album>();
    for (const album of albums) {
      const cleanAlbumTitle = parseAlbumAndDisc(
        album.storedTitle,
        "",
        null,
      ).albumName;
      const key = identity(cleanAlbumTitle);
      if (!albumMap.has(key)) {
        albumMap.set(key, album);
      }
    }
    const resolveArtistList = async (rawArtistStr: string) => {
      const names = rawArtistStr
        .split(/[~;,]/)
        .map((s) => getArtistStorageName(s.trim()))
        .filter((s) => s.length > 0);
      if (names.length === 0) names.push(UNKNOWN_ARTIST);
      const result: Artist[] = [];
      for (const name of names) {
        const key = identity(name);
        let artist = artistMap.get(key);
        if (!artist) {
          artist = await this.database
            .get<Artist>("artists")
            .create((record) => {
              record.storedName = name;
              record.normalizedName = key;
            });
          artistMap.set(key, artist);
        }
        result.push(artist);
      }
      return result;
    };
    for (const root of this.index.roots) {
      try {
        for await (const path of walk(root)) {
          const id = fileId(path);
          if (seen.has(id)) continue;
          const fileUrl = pathToFileURL(path).href;
          if (isUrlExcluded(fileUrl)) {
            delete this.index.files[id];
            continue;
          }
          seen.add(id);
          progress.discovered++;
          const info = await stat(path);
          const previous = this.index.files[id];
          if (
            !needsMigration &&
            previous &&
            trackMap.has(id) &&
            previous.modified === info.mtimeMs &&
            previous.size === info.size
          ) {
            previous.available = true;
          } else {
            try {
              const metadata = await parseFile(path, { duration: true });
              const common = metadata.common;
              let rgGain: number | null =
                typeof common.replaygain_track_gain?.dB === "number" &&
                Number.isFinite(common.replaygain_track_gain.dB)
                  ? common.replaygain_track_gain.dB
                  : typeof common.replaygain_album_gain?.dB === "number" &&
                      Number.isFinite(common.replaygain_album_gain.dB)
                    ? common.replaygain_album_gain.dB
                    : null;
              let rgPeak: number | null =
                typeof common.replaygain_track_peak?.ratio === "number" &&
                Number.isFinite(common.replaygain_track_peak.ratio) &&
                common.replaygain_track_peak.ratio > 0
                  ? common.replaygain_track_peak.ratio
                  : typeof common.replaygain_album_peak?.ratio === "number" &&
                      Number.isFinite(common.replaygain_album_peak.ratio) &&
                      common.replaygain_album_peak.ratio > 0
                    ? common.replaygain_album_peak.ratio
                    : null;
              if (rgGain === null || rgPeak === null) {
                const rawRg = await readReplayGainTags(path);
                if (rgGain === null && rawRg.gain !== null) rgGain = rawRg.gain;
                if (rgPeak === null && rawRg.peak !== null) rgPeak = rawRg.peak;
              }
              let cover = previous?.cover;
              const picture = common.picture?.[0];
              if (picture) {
                cover = join(
                  this.directory,
                  "artwork",
                  `${id}.${picture.format === "image/png" ? "png" : "jpg"}`,
                );
                await writeFile(cover, picture.data);
              }
              await this.database.write(async () => {
                const rawArtist =
                  (common.artists?.length ? common.artists.join(";") : common.artist) || UNKNOWN_ARTIST;
                const trackArtists = await resolveArtistList(rawArtist);
                const primaryArtist = trackArtists[0];

                const rawAlbumArtist = common.albumartist?.trim() || "";
                const isExplicitAlbumArtist =
                  rawAlbumArtist.length > 0 &&
                  getArtistStorageName(rawAlbumArtist) !== UNKNOWN_ARTIST;
                let albumArtist = primaryArtist;
                if (isExplicitAlbumArtist) {
                  const albumArtists = await resolveArtistList(rawAlbumArtist);
                  if (albumArtists.length > 0) albumArtist = albumArtists[0];
                }

                const { albumName, discNumber } = parseAlbumAndDisc(
                  common.album,
                  path,
                  common.disk.no,
                );
                const albumKey = identity(albumName);
                let album = albumMap.get(albumKey);
                const coverUrl = cover ? `mmplayer-media://cover/${id}` : null;

                if (!album) {
                  album = await this.database
                    .get<Album>("albums")
                    .create((record) => {
                      record.storedTitle = albumName;
                      record.normalizedTitle = albumKey;
                      record.artist.id = albumArtist.id;
                      record.year = common.year ?? null;
                      record.coverUrl = coverUrl;
                    });
                  albumMap.set(albumKey, album);
                } else {
                  let nextArtist: Artist | null = null;
                  if (
                    isExplicitAlbumArtist &&
                    album.artist.id !== albumArtist.id
                  ) {
                    nextArtist = albumArtist;
                  } else if (
                    !isExplicitAlbumArtist &&
                    album.artist.id !== primaryArtist.id &&
                    albumName !== UNKNOWN_ALBUM
                  ) {
                    const variosList = await resolveArtistList(VARIOUS_ARTISTS);
                    if (album.artist.id !== variosList[0].id) {
                      nextArtist = variosList[0];
                    }
                  }
                  const needsTitleFix = album.storedTitle !== albumName;
                  const needsCover = !album.coverUrl && !!coverUrl;
                  const needsYear =
                    !album.year &&
                    typeof common.year === "number" &&
                    common.year > 0;
                  if (nextArtist || needsTitleFix || needsCover || needsYear) {
                    await album.update((record) => {
                      if (needsTitleFix) {
                        record.storedTitle = albumName;
                        record.normalizedTitle = albumKey;
                      }
                      if (nextArtist) record.artist.id = nextArtist.id;
                      if (needsCover) record.coverUrl = coverUrl;
                      if (needsYear) record.year = common.year ?? null;
                    });
                  }
                }

                const update = (record: Track) => {
                  record.title = common.title || basename(path, extname(path));
                  record.normalizedTitle = identity(record.title);
                  record.fileUrl = fileUrl;
                  record.duration = metadata.format.duration || 0;
                  record.artist.id = primaryArtist.id;
                  record.album.id = album!.id;
                  record.trackNumber = common.track.no;
                  record.discNumber = discNumber;
                  record.genre = common.genre?.join(", ") || null;
                  record.replayGain = rgGain;
                  record.replayPeak = rgPeak;
                  record.lastModified = info.mtimeMs;
                };
                const existing = trackMap.get(id);
                if (existing) await existing.update(update);
                else {
                  const track = await this.database
                    .get<Track>("tracks")
                    .create((record) => {
                      record._raw.id = id;
                      update(record);
                    });
                  trackMap.set(id, track);
                }
                const credits = this.database.get<TrackCollaborator>(
                  "track_collaborators",
                );
                const validArtists = new Set(trackArtists.map(artist => artist.id));
                for (const credit of await credits.query(Q.where("track_id", id)).fetch()) {
                  if (!validArtists.has(credit.artist.id)) await credit.destroyPermanently();
                }
                for (const collaborator of trackArtists) {
                  const creditId = stableId(`credit:${id}:${collaborator.id}`);
                  if (!(await credits.find(creditId).catch(() => null)))
                    await credits.create((record) => {
                      record._raw.id = creditId;
                      record.track.id = id;
                      record.artist.id = collaborator.id;
                    });
                }
              });
              this.index.files[id] = {
                path,
                modified: info.mtimeMs,
                size: info.size,
                available: true,
                cover,
              };
            } catch (error) {
              progress.errors++;
              if (previous) previous.available = true;
              console.warn("Could not index audio:", path, error);
            }
          }
          progress.completed++;
          if (progress.completed % 25 === 0)
            this.notify("scan", { ...progress });
        }
      } catch (error) {
        progress.errors++;
        console.warn("Library location is unavailable:", root, error);
      }
    }
    const excludedDbTracks = Array.from(trackMap.values()).filter((t) =>
      isUrlExcluded(t.fileUrl),
    );
    if (excludedDbTracks.length > 0) {
      const idsToDelete = excludedDbTracks.map((t) => t.id);
      for (const id of idsToDelete) delete this.index.files[id];
      const [playlistTracks, trackTags, trackCollabs, historyRows] =
        await Promise.all([
          this.database
            .get<PlaylistTrack>("playlist_tracks")
            .query(Q.where("track_id", Q.oneOf(idsToDelete)))
            .fetch(),
          this.database
            .get<TrackTag>("track_tags")
            .query(Q.where("track_id", Q.oneOf(idsToDelete)))
            .fetch(),
          this.database
            .get<TrackCollaborator>("track_collaborators")
            .query(Q.where("track_id", Q.oneOf(idsToDelete)))
            .fetch(),
          this.database
            .get<PlaybackHistory>("playback_history")
            .query(
              Q.where("item_type", "track"),
              Q.where("item_id", Q.oneOf(idsToDelete)),
            )
            .fetch(),
        ]);
      await this.database.write(async () => {
        const historyDeletionOps =
          await PlaybackTagSnapshotService.prepareHistoryDeletion(
            historyRows,
            this.database,
          );
        await this.database.batch(
          ...excludedDbTracks.map((t) => t.prepareDestroyPermanently()),
          ...playlistTracks.map((r) => r.prepareDestroyPermanently()),
          ...trackTags.map((r) => r.prepareDestroyPermanently()),
          ...trackCollabs.map((r) => r.prepareDestroyPermanently()),
          ...historyDeletionOps,
        );
      });
    }
    if (needsMigration || excludedDbTracks.length > 0) {
      await this.cleanupOrphanedEntities();
      this.index.version = INDEX_VERSION;
    }
    for (const [id, entry] of Object.entries(this.index.files))
      if (!seen.has(id)) entry.available = false;
    await this.saveIndex();
    this.notify("scan", { ...progress, active: false });
    this.notify("library");
    return progress.completed;
  }
  async snapshot(): Promise<LibrarySnapshot> {
    await this.ready;
    const [tracks, albums, artists, playlists, tags, playlistLinks, tagLinks, credits] =
      await Promise.all([
        this.database.get<Track>("tracks").query().fetch(),
        this.database.get<Album>("albums").query().fetch(),
        this.database.get<Artist>("artists").query().fetch(),
        this.database.get<Playlist>("playlists").query().fetch(),
        this.database.get<Tag>("tags").query().fetch(),
        this.database.get<PlaylistTrack>("playlist_tracks").query().fetch(),
        this.database.get<TrackTag>("track_tags").query().fetch(),
        this.database.get<TrackCollaborator>("track_collaborators").query().fetch(),
      ]);
    const albumMap = new Map(albums.map((item) => [item.id, item]));
    const artistMap = new Map(artists.map((item) => [item.id, item]));
    const creditsByTrack = new Map<string, string[]>();
    for (const credit of credits) {
      const ids = creditsByTrack.get(credit.track.id) || [];
      if (!ids.includes(credit.artist.id)) ids.push(credit.artist.id);
      creditsByTrack.set(credit.track.id, ids);
    }
    const serialized = tracks.map((track) => {
      const album = albumMap.get(track.album.id);
      const artist = artistMap.get(track.artist.id);
      const entry = this.index.files[track.id];
      return {
        id: track.id,
        title: track.title,
        artist: [...new Set([track.artist.id, ...(creditsByTrack.get(track.id) || [])])]
          .map(id => artistMap.get(id)?.name).filter(Boolean).join(", "),
        artistId: track.artist.id,
        album: album?.title || "",
        albumId: track.album.id,
        duration: track.duration,
        fileUrl: `mmplayer-media://track/${encodeURIComponent(track.id)}`,
        available: entry?.available === true,
        cover: entry?.cover
          ? `mmplayer-media://cover/${encodeURIComponent(track.id)}`
          : null,
        isFavorite: track.isFavorite,
        rating: track.rating,
        genre: track.genre,
        year: album?.year ?? null,
        lyricsLRC: track.lyricsLRC,
        skipSegments: track.skipSegments,
        trackNumber: track.trackNumber,
        discNumber: (track as any).discNumber ?? null,
        replayGain: track.replayGain ?? null,
        replayPeak: track.replayPeak ?? null,
        isExcludedFromShuffle: Boolean(
          track.isExcludedFromShuffle || album?.isExcludedFromShuffle,
        ),
      };
    });
    const byAlbum = new Map<string, typeof serialized>(),
      byArtist = new Map<string, typeof serialized>();
    for (const track of serialized) {
      const albumTracks = byAlbum.get(track.albumId) || [];
      albumTracks.push(track);
      byAlbum.set(track.albumId, albumTracks);
      const artistTracks = byArtist.get(track.artistId) || [];
      artistTracks.push(track);
      byArtist.set(track.artistId, artistTracks);
    }
    return {
      tracks: serialized,
      albums: albums.map((album) => {
        const members = byAlbum.get(album.id) || [];
        return {
          id: album.id,
          name: album.title,
          isPinned: Boolean(album.isPinned),
          count: members.length,
          cover:
            album.coverUrl ||
            members.find((track) => track.cover)?.cover ||
            null,
        };
      }),
      artists: artists.map((artist) => {
        const members = byArtist.get(artist.id) || [];
        return {
          id: artist.id,
          name: artist.name,
          isPinned: Boolean(artist.isPinned),
          count: members.length,
          cover:
            artist.imageUrl ||
            members.find((track) => track.cover)?.cover ||
            null,
        };
      }),
      playlists: playlists.map((playlist) => {
        const trackIds = playlistLinks
          .filter((link) => link.playlist.id === playlist.id)
          .sort((a, b) => a.order - b.order)
          .map((link) => link.track.id as string);
        return {
          id: playlist.id,
          name: playlist.name,
          isPinned: Boolean(playlist.isPinned),
          count: trackIds.length,
          trackIds,
          cover: playlist.coverCustomUrl || playlist.coverUrl || null,
        };
      }),
      tags: tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        trackIds: tagLinks
          .filter((link) => link.tag.id === tag.id)
          .map((link) => link.track.id),
      })),
    };
  }
  private resolveAssetPath(
    uri: string,
    allowExternalRead = false,
  ): string | null {
    if (typeof uri !== "string" || !uri.trim()) return null;
    const clean = uri.split("?")[0].split("#")[0].trim();
    if (clean.startsWith("mmplayer-media://asset/")) {
      const rel = decodeURIComponent(
        clean.slice("mmplayer-media://asset/".length),
      ).replace(/^\/+/, "");
      const segments = rel.split("/").filter(Boolean);
      if (
        segments.length === 0 ||
        segments.some((seg) => seg === "." || seg === "..")
      )
        return null;
      const root = resolve(this.directory);
      const target = resolve(root, ...segments);
      if (target !== root && !target.startsWith(root + sep)) return null;
      return target;
    }
    if (clean.startsWith("mmplayer-media://track/")) {
      return this.index.files[decodeURIComponent(clean.slice("mmplayer-media://track/".length))]?.path ?? null;
    }
    if (clean.startsWith("mmplayer-media://cover/")) {
      const id = decodeURIComponent(
        clean.slice("mmplayer-media://cover/".length),
      );
      const entry = this.index.files[id];
      return entry?.cover ?? null;
    }
    if (allowExternalRead) {
      try {
        const p = clean.startsWith("file:") ? fileURLToPath(clean) : clean;
        return isAbsolute(p) ? resolve(p) : null;
      } catch {
        return null;
      }
    }
    return null;
  }
  async mediaPath(
    id: string,
    kind: "track" | "cover" | "asset",
  ): Promise<string | null> {
    await this.ready;
    if (kind === "asset") {
      const path = this.resolveAssetPath(`mmplayer-media://asset/${id}`, false);
      if (!path) return null;
      try {
        await access(path);
        return path;
      } catch {
        return null;
      }
    }
    const entry = this.index.files[id];
    if (!entry || !entry.available) return null;
    const path = kind === "track" ? entry.path : entry.cover;
    if (!path) return null;
    try {
      await access(path);
      return path;
    } catch {
      return null;
    }
  }
  async importMusicZip(input: { uri: string; name?: string }) {
    await this.ready;
    const source = this.resolveAssetPath(input.uri, true);
    if (!source) throw Error("music_zip.invalid_archive");
    const folder = join(this.directory, "documents", "imported_music", randomUUID());
    let registered = false;
    try {
      const extracted = await extractArchive(source, folder, (completed, total) => this.notify("musicZipProgress", { completed, total, folder }));
      let imported = 0;
      for await (const path of walk(folder)) if (audioExtensions.has(extname(path).toLowerCase())) imported++;
      if (!imported) throw Error("music_zip.no_audio");
      registered = true;
      await this.addRoots([folder]);
      imported = Object.values(this.index.files).filter(entry => entry.available && entry.path.startsWith(folder + sep)).length;
      return { folder, imported, skipped: extracted.files - imported };
    } catch (error) { if (!registered) await rm(folder, { recursive: true, force: true }); throw error; }
  }
  async fileSystemRequest(input: FileSystemRequest): Promise<unknown> {
    await this.ready;
    if (!input || typeof input !== "object")
      throw Error("Invalid fileSystem request");
    switch (input.op) {
      case "checkFiles": {
        if (!Array.isArray(input.uris) || input.uris.length > 100000 || input.uris.some(uri => typeof uri !== "string")) throw Error("Invalid file list");
        const result = new Array<boolean>(input.uris.length);
        let cursor = 0;
        await Promise.all(Array.from({ length: Math.min(8, result.length) }, async () => {
          while (cursor < input.uris.length) {
            const index = cursor++;
            try {
              const path = this.resolveAssetPath(input.uris[index], true);
              result[index] = path ? (await stat(path)).isFile() : false;
            } catch { result[index] = false; }
          }
        }));
        return result;
      }
      case "diskStats": {
        const info = await statfs(this.directory);
        const totalBytes = Number(info.blocks) * Number(info.bsize), freeBytes = Number(info.bavail) * Number(info.bsize);
        return { totalBytes, freeBytes, usedBytes: totalBytes - freeBytes };
      }
      case "archive": {
        if (!Array.isArray(input.sources) || !input.sources.length) throw Error("Invalid archive sources");
        const sources = input.sources.map(uri => this.resolveAssetPath(uri, true));
        if (sources.some(path => !path)) throw Error("Invalid archive source");
        if (input.action === "size") return archiveSize(sources[0]!);
        const target = this.resolveAssetPath(input.target ?? "", false);
        if (!target) throw Error("Invalid archive destination");
        if (input.action === "zip") await createArchive(sources as string[], target);
        else if (input.action === "unzip") await extractArchive(sources[0]!, target);
        else throw Error("Invalid archive action");
        return input.target;
      }
      case "getInfo": {
        const target = this.resolveAssetPath(input.uri, true);
        if (!target) return { exists: false, isDirectory: false, uri: input.uri };
        try {
          const info = await stat(target);
          const result: Record<string, unknown> = {
            exists: true,
            isDirectory: info.isDirectory(),
            size: info.size,
            modificationTime: Math.floor(info.mtimeMs / 1000),
            uri: input.uri.split("?")[0],
          };
          if (input.md5 && info.isFile()) {
            const bytes = await readFile(target);
            result.md5 = createHash("md5").update(bytes).digest("hex");
          }
          return result;
        } catch {
          return { exists: false, isDirectory: false, uri: input.uri };
        }
      }
      case "makeDirectory": {
        const target = this.resolveAssetPath(input.uri, false);
        if (!target) throw Error(`Invalid directory URI: ${input.uri}`);
        await mkdir(target, { recursive: input.intermediates !== false });
        return;
      }
      case "readDirectory": {
        const target = this.resolveAssetPath(input.uri, false);
        if (!target) throw Error(`Invalid directory URI: ${input.uri}`);
        try {
          return await readdir(target);
        } catch {
          return [];
        }
      }
      case "copy": {
        const fromPath = this.resolveAssetPath(input.from, true);
        const toPath = this.resolveAssetPath(input.to, false);
        if (!fromPath || !toPath)
          throw Error(`Invalid copy paths: ${input.from} -> ${input.to}`);
        await mkdir(dirname(toPath), { recursive: true });
        await copyFile(fromPath, toPath);
        return;
      }
      case "move": {
        const fromPath = this.resolveAssetPath(input.from, false);
        const toPath = this.resolveAssetPath(input.to, false);
        if (!fromPath || !toPath)
          throw Error(`Invalid move paths: ${input.from} -> ${input.to}`);
        await mkdir(dirname(toPath), { recursive: true });
        await rm(toPath, { force: true }).catch(() => {});
        await rename(fromPath, toPath);
        return;
      }
      case "delete": {
        const target = this.resolveAssetPath(input.uri, false);
        if (!target) {
          if (input.idempotent) return;
          throw Error(`Invalid delete URI: ${input.uri}`);
        }
        try {
          await rm(target, { recursive: true, force: Boolean(input.idempotent) });
        } catch (err) {
          if (!input.idempotent) throw err;
        }
        return;
      }
      case "writeBase64": {
        const target = this.resolveAssetPath(input.uri, false);
        if (!target) throw Error(`Invalid write URI: ${input.uri}`);
        await mkdir(dirname(target), { recursive: true });
        const cleanBase64 = input.base64.includes(",")
          ? input.base64.slice(input.base64.indexOf(",") + 1)
          : input.base64;
        await writeFile(target, Buffer.from(cleanBase64, "base64"));
        return;
      }
      case "readString": {
        const target = this.resolveAssetPath(input.uri, true);
        if (!target) throw Error(`Invalid read URI: ${input.uri}`);
        const buf = await readFile(target);
        return input.encoding === "base64"
          ? buf.toString("base64")
          : buf.toString("utf8");
      }
      case "writeString": {
        const target = this.resolveAssetPath(input.uri, false);
        if (!target) throw Error(`Invalid write URI: ${input.uri}`);
        await mkdir(dirname(target), { recursive: true });
        const buf =
          input.encoding === "base64"
            ? Buffer.from(input.contents, "base64")
            : Buffer.from(input.contents, "utf8");
        await writeFile(target, buf);
        return;
      }
      case "download": {
        const target = this.resolveAssetPath(input.uri, false);
        if (!target) throw Error(`Invalid download destination: ${input.uri}`);
        const parsed = new URL(input.url);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
          throw Error("Unsupported download protocol");
        const response = await fetch(input.url);
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          await mkdir(dirname(target), { recursive: true });
          await writeFile(target, Buffer.from(arrayBuffer));
        }
        return {
          uri: input.uri.split("?")[0],
          status: response.status,
          headers,
        };
      }
      default:
        throw Error("Unsupported fileSystem operation");
    }
  }
  private async indexedPath(uri: string) {
    await this.ready;
    if (typeof uri !== "string") throw Error("Invalid audio reference");
    if (uri.startsWith("mmplayer-media://track/")) {
      const entry =
        this.index.files[uri.slice("mmplayer-media://track/".length)];
      if (entry?.available) return entry.path;
    }
    const path = uri.startsWith("file:") ? fileURLToPath(uri) : uri;
    const entry = this.index.files[fileId(path)];
    if (!entry?.available)
      throw Error("The audio file is not available in the library.");
    return entry.path;
  }
  async trackExportPath(uri: string) {
    // Shared TrackMenu uses the model's physical file URL. Only export an
    // available indexed song, never an arbitrary renderer-supplied file.
    const path = await this.indexedPath(uri);
    await access(path);
    return path;
  }
  async readMetadata(uri: string): Promise<FileMetadata> {
    const { common } = await parseFile(await this.indexedPath(uri), {
      skipCovers: true,
    });
    return {
      title: common.title ?? "",
      artist: common.artist ?? "",
      album: common.album ?? "",
      albumArtist: common.albumartist ?? "",
      genre: common.genre?.join(", ") ?? "",
      year: common.year ?? 0,
      trackNumber: common.track.no ?? 0,
      discNumber: common.disk.no ?? 0,
    };
  }
  async readReplayGain(
    uri: string,
  ): Promise<{ gain: number | null; peak: number | null }> {
    const path = await this.indexedPath(uri).catch(() =>
      uri.startsWith("file:") ? fileURLToPath(uri) : uri,
    );
    const raw = await readReplayGainTags(path);
    if (raw.gain !== null && raw.peak !== null) {
      return { gain: raw.gain, peak: raw.peak };
    }
    try {
      const { common } = await parseFile(path, { skipCovers: true });
      const gain =
        raw.gain ??
        (typeof common.replaygain_track_gain?.dB === "number" &&
        Number.isFinite(common.replaygain_track_gain.dB)
          ? common.replaygain_track_gain.dB
          : typeof common.replaygain_album_gain?.dB === "number" &&
              Number.isFinite(common.replaygain_album_gain.dB)
            ? common.replaygain_album_gain.dB
            : null);
      const peak =
        raw.peak ??
        (typeof common.replaygain_track_peak?.ratio === "number" &&
        Number.isFinite(common.replaygain_track_peak.ratio) &&
        common.replaygain_track_peak.ratio > 0
          ? common.replaygain_track_peak.ratio
          : typeof common.replaygain_album_peak?.ratio === "number" &&
              Number.isFinite(common.replaygain_album_peak.ratio) &&
              common.replaygain_album_peak.ratio > 0
            ? common.replaygain_album_peak.ratio
            : null);
      return { gain, peak };
    } catch {
      return { gain: raw.gain, peak: raw.peak };
    }
  }
  private async resolveCoverArtInput(
    value: string,
    tempFiles: string[],
  ): Promise<string> {
    const validExtensions = new Set([
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
      ".bmp",
      ".gif",
    ]);
    if (value.startsWith("data:image/")) {
      const match = /^data:image\/([a-z0-9+.-]+);base64,(.+)$/i.exec(value);
      if (!match) throw Error("Select an imported artwork before saving.");
      const rawExt = match[1].toLowerCase();
      const ext =
        rawExt === "jpeg" ? ".jpg" : rawExt === "png" ? ".png" : ".jpg";
      const cacheDir = join(this.directory, "app-cache");
      await mkdir(cacheDir, { recursive: true });
      const tempPath = join(
        cacheDir,
        `cover_data_${Date.now()}_${tempFiles.length}${ext}`,
      );
      await writeFile(tempPath, Buffer.from(match[2], "base64"));
      tempFiles.push(tempPath);
      return tempPath;
    }
    const assetOrCover = this.resolveAssetPath(value, false);
    if (assetOrCover) {
      const info = await stat(assetOrCover).catch(() => null);
      if (info?.isFile()) return assetOrCover;
    }
    const clean = value.split("?")[0];
    const localPath = clean.startsWith("file:") ? fileURLToPath(clean) : clean;
    const existingCover = Object.values(this.index.files).find(
      (entry) => entry.cover === localPath,
    );
    if (existingCover?.cover) return existingCover.cover;
    if (isAbsolute(localPath)) {
      const ext = extname(localPath).toLowerCase();
      if (validExtensions.has(ext)) {
        const info = await stat(localPath).catch(() => null);
        if (info?.isFile()) return localPath;
      }
    }
    throw Error("Select an imported artwork before saving.");
  }
  async writeMetadata(
    items: MetadataWriteItem[],
    batchId?: string,
  ): Promise<MetadataWriteResult[]> {
    if (!Array.isArray(items) || items.length > 100000)
      throw Error("Invalid metadata batch");
    if (
      batchId !== undefined &&
      (typeof batchId !== "string" || batchId.length > 200)
    )
      throw Error("Invalid metadata batch");
    if (!items.length) return [];
    this.metadataBatchId = batchId;
    this.metadataCancelled = false;
    const worker = new Worker(join(__dirname, "metadataWorker.cjs"));
    const results: MetadataWriteResult[] = [];
    const savedYears: { id: string; year: number }[] = [];
    const clearedCovers: string[] = [];
    const updatedCovers: string[] = [];
    const tempCoverFiles: string[] = [];
    try {
      for (const item of items) {
        if (this.metadataCancelled) break;
        try {
          const path = await this.indexedPath(item.filePath);
          const patch: FileMetadata = {};
          for (const [key, value] of Object.entries(item.metadata)) {
            if (value == null) continue;
            if (
              ["title", "artist", "album", "albumArtist", "genre"].includes(key)
            ) {
              if (typeof value !== "string" || value.length > 10000)
                throw Error("Invalid metadata text");
            } else if (["year", "trackNumber", "discNumber"].includes(key)) {
              if (
                typeof value !== "number" ||
                !Number.isInteger(value) ||
                value < 0 ||
                value > 9999
              )
                throw Error("Invalid metadata number");
            } else if (key === "coverArtPath") {
              if (typeof value !== "string")
                throw Error("Invalid coverArtPath");
              if (value === "") {
                patch.coverArtPath = "";
                continue;
              }
              patch.coverArtPath = await this.resolveCoverArtInput(
                value,
                tempCoverFiles,
              );
              continue;
            } else throw Error("Unsupported metadata field");
            Object.assign(patch, { [key]: value });
          }
          const result = await new Promise<{
            success: boolean;
            error?: string;
          }>((resolveResult, reject) => {
            if (worker.threadId === -1) {
              reject(new Error("The metadata writer stopped."));
              return;
            }
            const clean = () => {
              worker.off("error", failed);
              worker.off("exit", exited);
              worker.off("message", done);
            };
            const done = (result: { success: boolean; error?: string }) => {
              clean();
              resolveResult(result);
            };
            const failed = (error: Error) => {
              clean();
              reject(error);
            };
            const exited = () =>
              failed(new Error("The metadata writer stopped unexpectedly."));
            worker.once("message", done);
            worker.once("error", failed);
            worker.once("exit", exited);
            worker.postMessage({ path, metadata: patch });
          });
          results.push({ filePath: item.filePath, ...result });
          if (result.success) {
            const id = fileId(path);
            const indexed = this.index.files[id];
            if (indexed) {
              indexed.modified = -1;
              if (patch.coverArtPath === "") {
                delete indexed.cover;
                clearedCovers.push(id);
              } else if (patch.coverArtPath) {
                updatedCovers.push(id);
              }
              if (patch.year != null) savedYears.push({ id, year: patch.year });
            }
          }
        } catch (error) {
          results.push({
            filePath: item.filePath,
            success: false,
            error: String(error),
          });
        }
        if (results.length % 10 === 0 || results.length === items.length)
          this.notify("metadataProgress", {
            batchId,
            current: results.length,
            total: items.length,
          });
      }
    } finally {
      await worker.terminate();
      this.metadataBatchId = undefined;
      for (const tempFile of tempCoverFiles) {
        await rm(tempFile, { force: true }).catch(() => {});
      }
    }
    if (results.some((result) => result.success)) await this.scan();
    for (const id of updatedCovers) {
      if (!this.index.files[id]?.cover) continue;
      const track = await this.database
        .get<Track>("tracks")
        .find(id)
        .catch(() => null);
      const album = await track?.album.fetch().catch(() => null);
      if (album) {
        const nextCoverUrl = `mmplayer-media://cover/${encodeURIComponent(id)}?t=${Date.now()}`;
        await this.database.write(() =>
          album.update((record: Album) => {
            record.coverUrl = nextCoverUrl;
            record.coverColor = null;
            record.coverColorSource = null;
          }),
        );
      }
    }
    for (const id of clearedCovers) {
      const track = await this.database.get<Track>("tracks").find(id);
      const album = await track.album.fetch();
      if (album?.coverUrl?.split("?")[0] === `mmplayer-media://cover/${id}`) {
        await this.database.write(() =>
          album.update((record: Album) => {
            record.coverUrl = null;
            record.coverColor = null;
            record.coverColorSource = null;
          }),
        );
      }
    }
    if (savedYears.length) {
      const albums = new Map<string, { album: Album; year: number }>();
      for (const saved of savedYears) {
        const track = await this.database.get<Track>("tracks").find(saved.id);
        const album = await track.album.fetch();
        if (album) albums.set(album.id, { album, year: saved.year });
      }
      await this.database.write(async () => {
        await this.database.batch(
          ...[...albums.values()]
            .filter(({ album, year }) => album.year !== (year || null))
            .map(({ album, year }) =>
              album.prepareUpdate((record) => {
                record.year = year || null;
              }),
            ),
        );
      });
    }
    return results;
  }
  cancelMetadata(batchId: string) {
    if (this.metadataBatchId === batchId) this.metadataCancelled = true;
  }
  async mutate(command: string, input: Record<string, unknown>) {
    await this.ready;
    const id = (field: string) => {
      const value = input[field];
      if (typeof value !== "string" || !value || value.length > 200)
        throw Error("Invalid identifier");
      return value;
    };
    const trackIds = () => {
      const value = input.trackIds;
      if (
        !Array.isArray(value) ||
        value.length > 100000 ||
        value.some((item) => typeof item !== "string" || item.length > 200)
      )
        throw Error("Invalid track selection");
      return value as string[];
    };
    if (command === "createPlaylist") {
      if (typeof input.name !== "string" || input.name.length > 200)
        throw Error("Invalid name");
      const playlist = await this.playlists.createPlaylist(input.name);
      this.notify("library");
      return playlist.id;
    }
    if (command === "addToPlaylist" || command === "removeFromPlaylist") {
      const playlistId = id("playlistId"),
        ids = trackIds();
      await this.database.get<Playlist>("playlists").find(playlistId);
      if (command === "addToPlaylist") {
        const tracks = await this.database
          .get<Track>("tracks")
          .query(Q.where("id", Q.oneOf([...new Set(ids)])))
          .fetch();
        const valid = new Set(tracks.map((track) => track.id));
        await this.playlists.addMultipleTracksToPlaylist(
          playlistId,
          ids.filter((id) => valid.has(id)),
        );
      } else
        await this.playlists.removeMultipleTracksFromPlaylist(playlistId, ids);
      this.notify("library");
      return;
    }
    const result = await this.database.write(async () => {
      if (
        ["favorite", "rate", "saveLyrics", "saveTimestamps", "listen"].includes(
          command,
        )
      ) {
        const track = await this.database
          .get<Track>("tracks")
          .find(id("trackId"));
        if (command === "favorite")
          return track.update((record) => {
            record.isFavorite = !record.isFavorite;
          });
        if (command === "rate") {
          const rating = input.rating;
          if (
            rating !== null &&
            (typeof rating !== "number" ||
              !Number.isFinite(rating) ||
              rating < 0.5 ||
              rating > 5 ||
              (rating * 2) % 1 !== 0)
          )
            throw Error("Invalid rating");
          await track.update((record) => {
            record.rating = rating as number | null;
          });
        } else if (command === "saveLyrics") {
          if (typeof input.lyrics !== "string" || input.lyrics.length > 2000000)
            throw Error("Invalid lyrics");
          await track.update((record) => {
            record.lyricsLRC = input.lyrics as string;
          });
        } else if (command === "saveTimestamps") {
          if (typeof input.value !== "string" || input.value.length > 100000)
            throw Error("Invalid timestamps");
          const config = JSON.parse(input.value);
          const segments = normalizeSkipSegments(
            config.segments,
            track.duration * 1000,
          );
          await track.update((record) => {
            record.skipSegments = JSON.stringify({
              enabled: config.enabled !== false,
              segments,
            });
          });
        } else if (command === "listen") {
          if (
            typeof input.seconds !== "number" ||
            !Number.isFinite(input.seconds) ||
            input.seconds < 0 ||
            input.seconds > 604800
          )
            throw Error("Invalid listening duration");
          const evaluation = evaluateListenDuration(
            track.duration,
            input.seconds,
          );
          if (!evaluation.eligible) return;
          const snapshot = await PlaybackTagSnapshotService.capture(
            track,
            this.database,
          );
          const history = this.database
            .get<PlaybackHistory>("playback_history")
            .prepareCreate((record) => {
              record.itemId = track.id;
              record.itemType = "track";
              record.playContext = "desktop";
              record.durationPlayed = Math.floor(evaluation.seconds);
              record.playedAt = new Date();
              record.tagsCaptured = snapshot !== null;
            });
          await this.database.batch(
            history,
            ...PlaybackTagSnapshotService.prepareRecords(
              history.id,
              snapshot,
              this.database,
            ),
          );
        }
      } else if (command === "createTag") {
        if (
          typeof input.name !== "string" ||
          !input.name.trim() ||
          input.name.length > 200
        )
          throw Error("Invalid name");
        if (
          typeof input.color !== "string" ||
          !/^#[\da-f]{6}$/i.test(input.color)
        )
          throw Error("Invalid colour");
        const tag = await this.database.get<Tag>("tags").create((record) => {
          record.name = (input.name as string).trim();
          record.normalizedName = identity(record.name);
          record.color = input.color as string;
        });
        return tag.id;
      } else if (command === "toggleTag") {
        const tagId = id("tagId"),
          trackId = id("trackId");
        await this.database.get<Tag>("tags").find(tagId);
        await this.database.get<Track>("tracks").find(trackId);
        const links = await this.database
          .get<TrackTag>("track_tags")
          .query(Q.where("tag_id", tagId), Q.where("track_id", trackId))
          .fetch();
        if (links.length)
          await this.database.batch(
            ...links.map((link) => link.prepareDestroyPermanently()),
          );
        else
          await this.database.get<TrackTag>("track_tags").create((link) => {
            link.track.id = trackId;
            link.tag.id = tagId;
          });
      } else throw Error("Unknown library command");
    });
    this.notify("library");
    // Never return WatermelonDB model instances over IPC.
    return typeof result === "string" ? result : undefined;
  }
}
