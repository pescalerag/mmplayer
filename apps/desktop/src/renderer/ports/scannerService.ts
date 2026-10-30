import { Q } from "@nozbe/watermelondb";
import { database } from "./database";
import { LibraryRefreshService } from "./libraryRefresh";
import { usePlayerStore } from "./playerStore";
import { useSettingsStore } from "../../../../../src/store/useSettingsStore";
import { useSyncStore } from "../../../../../src/store/useSyncStore";
import { ArtistImageService } from "../../../../../src/services/ArtistImageService";
import { AlbumCoverService } from "../../../../../src/services/AlbumCoverService";
import type Track from "../../../../../src/database/models/Track";
import type Album from "../../../../../src/database/models/Album";
import type Artist from "../../../../../src/database/models/Artist";
import i18n from "../../../../../src/constants/i18n";
import { useMigrationStore } from "../../../../../src/store/useMigrationStore";
import { PlaybackTagSnapshotService } from "../../../../../src/services/PlaybackTagSnapshotService";

const EXCLUSIONS_LOCAL_KEY = "mmplayer_exclusions";

let syncingFromWorker = false;

export async function syncExclusionsToWorker(): Promise<void> {
  if (syncingFromWorker) return;
  try {
    const { excludedFolders = [], excludedSongs = [] } =
      useSettingsStore.getState();
    await database.adapter.setLocal(
      EXCLUSIONS_LOCAL_KEY,
      JSON.stringify({ excludedFolders, excludedSongs }),
    );
  } catch (error) {
    console.warn("Could not sync exclusions to worker:", error);
  }
}

export async function pullExclusionsFromWorker(): Promise<void> {
  try {
    const raw = await database.adapter.getLocal(EXCLUSIONS_LOCAL_KEY);
    if (typeof raw !== "string" || !raw) return;
    const parsed = JSON.parse(raw);
    const workerFolders: string[] = Array.isArray(parsed?.excludedFolders)
      ? parsed.excludedFolders
      : [];
    const workerSongs: string[] = Array.isArray(parsed?.excludedSongs)
      ? parsed.excludedSongs
      : [];
    const current = useSettingsStore.getState();
    const curFolders = current.excludedFolders || [];
    const curSongs = current.excludedSongs || [];
    const foldersChanged =
      workerFolders.length !== curFolders.length ||
      workerFolders.some((f, i) => f !== curFolders[i]);
    const songsChanged =
      workerSongs.length !== curSongs.length ||
      workerSongs.some((s, i) => s !== curSongs[i]);
    if (foldersChanged || songsChanged) {
      syncingFromWorker = true;
      try {
        useSettingsStore.setState({
          excludedFolders: workerFolders,
          excludedSongs: workerSongs,
        });
      } finally {
        syncingFromWorker = false;
      }
    }
  } catch {
    // Ignore
  }
}

// Keep worker exclusions in sync whenever useSettingsStore changes
let prevFoldersRef: string[] = [];
let prevSongsRef: string[] = [];
useSettingsStore.subscribe((state) => {
  const folders = state.excludedFolders || [];
  const songs = state.excludedSongs || [];
  if (folders !== prevFoldersRef || songs !== prevSongsRef) {
    prevFoldersRef = folders;
    prevSongsRef = songs;
    void syncExclusionsToWorker();
  }
});

if (typeof window !== "undefined" && (window as any).mmplayer?.on) {
  (window as any).mmplayer.on("scan", (progress: { active?: boolean }) => {
    if (progress && progress.active === false) {
      void reviewMissingDesktopFiles().catch(console.error);
      void pullExclusionsFromWorker();
      void ArtistImageService.processMissingArtistImages({
        isBackground: true,
      }).catch(() => {});
      void AlbumCoverService.processMissingAlbumCovers({
        isBackground: true,
      }).catch(() => {});
    }
  });
}

let missingReview: Promise<void> | undefined;
/** Keep unavailable entries until the user explicitly chooses to remove them. */
export function reviewMissingDesktopFiles(): Promise<void> {
  if (missingReview) return missingReview;
  missingReview = (async () => {
    const findMissing = async () => {
      const tracks = await database.get<Track>("tracks").query().fetch();
      const exists = await window.mmplayer.invoke("fileSystem", {
        op: "checkFiles", uris: tracks.map(track => track.fileUrl),
      }) as boolean[];
      return tracks.filter((_, index) => exists[index] === false);
    };
    let missing = await findMissing();
    if (!missing.length) return;
    const migration = useMigrationStore.getState();
    migration.startMigration(missing.length);
    try {
      while (missing.length) {
        const action = await useMigrationStore.getState().promptConfirmDelete(missing.length);
        if (action === "keep") return;
        if (action === "retry") {
          await LibraryRefreshService.refresh();
          missing = await findMissing();
          continue;
        }
        // A drive or file may have returned while the confirmation was open.
        const stillMissing = new Set((await findMissing()).map(track => track.id));
        await deleteTracksAndRelations(missing.filter(track => stillMissing.has(track.id)));
        return;
      }
    } finally {
      useMigrationStore.getState().close();
    }
  })().finally(() => { missingReview = undefined; });
  return missingReview;
}

async function deleteTracksAndRelations(tracksToDelete: Track[]) {
  if (tracksToDelete.length === 0) return;

  const tracksCollection = database.collections.get<Track>("tracks");
  const trackIdsToDelete = tracksToDelete.map((t) => t.id);

  const affectedAlbumIds = new Set<string>();
  const affectedArtistIds = new Set<string>();
  tracksToDelete.forEach((t: Track) => {
    const albId = (t._raw as any).album_id as string | undefined;
    const artId = (t._raw as any).artist_id as string | undefined;
    if (albId) affectedAlbumIds.add(albId);
    if (artId) affectedArtistIds.add(artId);
  });

  const BATCH_DELETE_SIZE = 100;
  for (let i = 0; i < trackIdsToDelete.length; i += BATCH_DELETE_SIZE) {
    const batchIds = trackIdsToDelete.slice(i, i + BATCH_DELETE_SIZE);
    const tracksToDeleteBatch = await tracksCollection
      .query(Q.where("id", Q.oneOf(batchIds)))
      .fetch();

    const playlistTracksCollection =
      database.collections.get("playlist_tracks");
    const trackTagsCollection = database.collections.get("track_tags");
    const trackCollaboratorsCollection = database.collections.get(
      "track_collaborators",
    );
    const playbackHistoryCollection =
      database.collections.get("playback_history");

    const [playlistTracks, trackTags, trackCollaborators, playbackHistory] =
      await Promise.all([
        playlistTracksCollection
          .query(Q.where("track_id", Q.oneOf(batchIds)))
          .fetch(),
        trackTagsCollection
          .query(Q.where("track_id", Q.oneOf(batchIds)))
          .fetch(),
        trackCollaboratorsCollection
          .query(Q.where("track_id", Q.oneOf(batchIds)))
          .fetch(),
        playbackHistoryCollection
          .query(
            Q.where("item_type", "track"),
            Q.where("item_id", Q.oneOf(batchIds)),
          )
          .fetch(),
      ]);

    trackCollaborators.forEach((tc: any) => {
      const artId = (tc._raw as any).artist_id as string | undefined;
      if (artId) affectedArtistIds.add(artId);
    });

    await database.write(async () => {
      const historyOps = await PlaybackTagSnapshotService.prepareHistoryDeletion(playbackHistory);
      const batchOps = [
        ...tracksToDeleteBatch.map((t: Track) => t.prepareDestroyPermanently()),
        ...playlistTracks.map((r: any) => r.prepareDestroyPermanently()),
        ...trackTags.map((r: any) => r.prepareDestroyPermanently()),
        ...trackCollaborators.map((r: any) => r.prepareDestroyPermanently()),
        ...historyOps,
      ];
      await database.batch(batchOps);
    });
  }

  await usePlayerStore
    .getState()
    .handleDeletedEntities?.(trackIdsToDelete, [], []);

  await ScannerService.cleanDeletedFiles({
    targetAlbumIds: Array.from(affectedAlbumIds),
    targetArtistIds: Array.from(affectedArtistIds),
    skipFileCheck: true,
  });
}

export const ScannerService = {
  isScanning: false,

  async syncLibrary(
    _onProgress?: (current: number, total: number, phase: string) => void,
    isSilent = false,
  ): Promise<boolean> {
    useSyncStore.getState().setIsScanning(true, isSilent);
    try {
      await syncExclusionsToWorker();
      await LibraryRefreshService.refresh();
      await pullExclusionsFromWorker();
      return true;
    } finally {
      useSyncStore.getState().setIsScanning(false);
    }
  },

  async cleanDeletedFiles(
    arg1?:
      | {
          targetAlbumIds?: string[];
          targetArtistIds?: string[];
          skipFileCheck?: boolean;
        }
      | ((phase: string) => void),
    _arg2?: (phase: string) => void,
  ): Promise<void> {
    const options = typeof arg1 === "object" ? arg1 : undefined;
    let deletedAlbums: string[] = [];
    let deletedArtists: string[] = [];

    try {
      const tracksCollection = database.collections.get<Track>("tracks");
      const albumsCollection = database.collections.get<Album>("albums");
      const artistsCollection = database.collections.get<Artist>("artists");
      const collaboratorsCollection = database.collections.get(
        "track_collaborators",
      );

      const albumIdsToCheck =
        options?.targetAlbumIds ??
        (await albumsCollection.query().fetch()).map((a) => a.id);

      if (albumIdsToCheck.length > 0) {
        const albumsToDelete: Album[] = [];
        for (const albumId of albumIdsToCheck) {
          const count = await tracksCollection
            .query(Q.where("album_id", albumId))
            .fetchCount();
          if (count === 0) {
            try {
              const albumDoc = await albumsCollection.find(albumId);
              albumsToDelete.push(albumDoc);
            } catch {
              // Already deleted
            }
          }
        }
        if (albumsToDelete.length > 0) {
          deletedAlbums = albumsToDelete.map((a) => a.id);
          await database.write(async () => {
            await database.batch(
              albumsToDelete.map((a) => a.prepareDestroyPermanently()),
            );
          });
        }
      }

      const artistIdsToCheck =
        options?.targetArtistIds ??
        (await artistsCollection.query().fetch()).map((a) => a.id);

      if (artistIdsToCheck.length > 0) {
        const artistsToDelete: Artist[] = [];
        for (const artistId of artistIdsToCheck) {
          const [countTracks, countCollabs, countAlbums] = await Promise.all([
            tracksCollection.query(Q.where("artist_id", artistId)).fetchCount(),
            collaboratorsCollection
              .query(Q.where("artist_id", artistId))
              .fetchCount(),
            albumsCollection.query(Q.where("artist_id", artistId)).fetchCount(),
          ]);
          if (countTracks === 0 && countCollabs === 0 && countAlbums === 0) {
            try {
              const artistDoc = await artistsCollection.find(artistId);
              artistsToDelete.push(artistDoc);
            } catch {
              // Already deleted
            }
          }
        }
        if (artistsToDelete.length > 0) {
          deletedArtists = artistsToDelete.map((a) => a.id);
          await database.write(async () => {
            await database.batch(
              artistsToDelete.map((a) => a.prepareDestroyPermanently()),
            );
          });
        }
      }
    } catch (error) {
      console.error("Error cleaning empty entities on desktop:", error);
    }

    if (deletedAlbums.length > 0 || deletedArtists.length > 0) {
      await usePlayerStore
        .getState()
        .handleDeletedEntities?.([], deletedAlbums, deletedArtists);
    }
  },

  async deleteFolderContents(
    folderPath: string,
    _onProgress?: (phase: string) => void,
  ): Promise<void> {
    if (useSyncStore.getState().isScanning) return;
    try {
      useSyncStore.getState().setIsScanning(true);
      await syncExclusionsToWorker();
      const tracksCollection = database.collections.get<Track>("tracks");
      const cleanFolder = folderPath.replace(/\/+$/, "");
      const allTracks = await tracksCollection
        .query(Q.where("file_url", Q.like(`${cleanFolder}%`)))
        .fetch();

      const tracksToDelete = allTracks.filter((t) => {
        const lastSlash = t.fileUrl.lastIndexOf("/");
        if (lastSlash === -1) return false;
        const dirPath = t.fileUrl.substring(0, lastSlash);
        return (
          dirPath === cleanFolder || dirPath.startsWith(cleanFolder + "/")
        );
      });

      await deleteTracksAndRelations(tracksToDelete);
    } catch (error) {
      console.error("Error deleting folder contents on desktop:", error);
    } finally {
      useSyncStore.getState().setIsScanning(false);
    }
  },

  async deleteSongContents(
    songPath: string,
    _onProgress?: (phase: string) => void,
  ): Promise<void> {
    if (useSyncStore.getState().isScanning) return;
    try {
      useSyncStore.getState().setIsScanning(true);
      await syncExclusionsToWorker();
      const tracksCollection = database.collections.get<Track>("tracks");
      const tracksToDelete = await tracksCollection
        .query(Q.where("file_url", songPath))
        .fetch();
      await deleteTracksAndRelations(tracksToDelete);
    } catch (error) {
      console.error("Error deleting song contents on desktop:", error);
    } finally {
      useSyncStore.getState().setIsScanning(false);
    }
  },

  async deleteMultipleSongsContents(
    songPaths: string[],
    _onProgress?: (phase: string) => void,
  ): Promise<void> {
    if (useSyncStore.getState().isScanning) return;
    try {
      useSyncStore.getState().setIsScanning(true);
      await syncExclusionsToWorker();
      const tracksCollection = database.collections.get<Track>("tracks");
      const tracksToDelete = await tracksCollection
        .query(Q.where("file_url", Q.oneOf(songPaths)))
        .fetch();
      await deleteTracksAndRelations(tracksToDelete);
    } catch (error) {
      console.error(
        "Error deleting multiple songs contents on desktop:",
        error,
      );
    } finally {
      useSyncStore.getState().setIsScanning(false);
    }
  },

  async rescanReplayGain(
    onProgress?: (current: number, total: number) => void,
  ): Promise<void> {
    await ScannerService.runDeepReplayGainScan(
      onProgress ? (current, total) => onProgress(current, total) : undefined,
    );
  },

  async runDeepReplayGainScan(
    onProgress?: (current: number, total: number, phase: string) => void,
  ): Promise<number> {
    try {
      const { getReplayGainMetadata } = await import("./audioFiles");
      const tracksCollection = database.collections.get<Track>("tracks");
      const tracksWithoutGain = await tracksCollection
        .query(
          Q.or(
            Q.where("replay_gain", Q.eq(null as any)),
            Q.where("replay_peak", Q.eq(null as any)),
          ),
        )
        .fetch();

      if (tracksWithoutGain.length === 0) {
        return 0;
      }

      const CHUNK_SIZE = 10;
      let processed = 0;
      let updated = 0;

      for (let i = 0; i < tracksWithoutGain.length; i += CHUNK_SIZE) {
        const chunk = tracksWithoutGain.slice(i, i + CHUNK_SIZE);
        onProgress?.(
          processed,
          tracksWithoutGain.length,
          `Analizando volumen (${processed}/${tracksWithoutGain.length})`,
        );

        const batchOps: any[] = [];
        await Promise.all(
          chunk.map(async (track) => {
            try {
              const metadata = await getReplayGainMetadata(track.fileUrl);
              const gain =
                typeof metadata.gain === "number" &&
                Number.isFinite(metadata.gain)
                  ? metadata.gain
                  : null;
              const peak =
                typeof metadata.peak === "number" &&
                Number.isFinite(metadata.peak) &&
                metadata.peak > 0
                  ? metadata.peak
                  : null;
              if (gain !== null || peak !== null) {
                batchOps.push(
                  track.prepareUpdate((t: any) => {
                    if (gain !== null) t.replayGain = gain;
                    if (peak !== null) t.replayPeak = peak;
                  }),
                );
              }
            } catch (err) {
              console.error(
                `Error al obtener ReplayGain para ${track.fileUrl}:`,
                err,
              );
            }
          }),
        );

        if (batchOps.length > 0) {
          await database.write(async () => {
            await database.batch(batchOps);
          });
          updated += batchOps.length;
        }
        processed += chunk.length;
      }

      await LibraryRefreshService.refresh();
      return updated;
    } catch (error) {
      console.error("Error en runDeepReplayGainScan on desktop:", error);
      throw error;
    }
  },

  async forceFullRescan(): Promise<boolean> {
    await syncExclusionsToWorker();
    await LibraryRefreshService.refresh();
    return true;
  },

  async scanUnindexedFiles(): Promise<number> {
    await syncExclusionsToWorker();
    await LibraryRefreshService.refresh();
    return 0;
  },

  async repairMissingAlbumCovers(): Promise<number> {
    return 0;
  },

  async repairCorruptedData(): Promise<void> {},

  async repairCollaborators(onProgress?: (current: number, total: number, phase: string) => void): Promise<void> {
    if (useSyncStore.getState().isScanning) return;
    useSyncStore.getState().setIsScanning(true);
    try {
      onProgress?.(0, 0, i18n.t("scanner.repairing_lost_artists"));
      const count = await window.mmplayer.invoke("repairCollaborators", undefined);
      onProgress?.(count, count, i18n.t("scanner.library_repaired_success"));
    } finally {
      useSyncStore.getState().setIsScanning(false);
    }
  },

  async migrateLastModifiedIfNeeded(): Promise<void> {},

  async autoScanAndroid(): Promise<{
    total: number;
    added: number;
    skipped: number;
  }> {
    await ScannerService.syncLibrary(undefined, true);
    return { total: 0, added: 0, skipped: 0 };
  },
};
