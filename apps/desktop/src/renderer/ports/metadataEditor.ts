import { Alert } from "react-native";
import * as FileSystem from "./fileSystem";
import { usePlayerStore } from "./playerStore";
import { player } from "../player";
import {
  buildMetadataBatch,
  type EditableMetadata,
} from "../../../../../src/utils/metadataBatch";
import { i18n } from "../strings";
import type { MetadataWriteResult } from "@mmplayer/platform";
export type { EditableMetadata } from "../../../../../src/utils/metadataBatch";
let cancelled = false;
let activeBatch: string | undefined;
let coverStageSeq = 0;
function failureMessage(result: MetadataWriteResult) {
  let file = result.filePath.split(/[\\/]/).pop() ?? result.filePath;
  try {
    file = decodeURIComponent(file);
  } catch {
    /* A literal percent is valid in a local filename. */
  }
  return result.errorCode === "permission"
    ? i18n.t("desktop:metadataPermission", { file })
    : `${file}: ${result.error}`;
}

export const MetadataEditorService = {
  async saveMetadata(
    tracks: { fileUrl: string }[],
    metadata: EditableMetadata,
    batch: boolean,
    autoNumber = false,
    progress?: (current: number, total: number) => void,
  ) {
    cancelled = false;
    let stagedCoverUri: string | null = null;
    const effectiveMetadata: EditableMetadata = { ...metadata };
    if (
      typeof effectiveMetadata.coverArtPath === "string" &&
      effectiveMetadata.coverArtPath.startsWith("blob:")
    ) {
      stagedCoverUri = `${FileSystem.cacheDirectory}metadata_cover_${Date.now()}_${++coverStageSeq}.jpg`;
      await FileSystem.copyAsync({
        from: effectiveMetadata.coverArtPath,
        to: stagedCoverUri,
      });
      effectiveMetadata.coverArtPath = stagedCoverUri;
    }
    const items = buildMetadataBatch(
      tracks,
      effectiveMetadata,
      batch,
      autoNumber,
    );
    for (const item of items) {
      if (effectiveMetadata.year === "") item.metadata.year = 0;
      if (!batch && effectiveMetadata.trackNumber === "")
        item.metadata.trackNumber = 0;
      if (effectiveMetadata.discNumber === "") item.metadata.discNumber = 0;
    }
    if (!items.length) {
      if (stagedCoverUri) {
        await FileSystem.deleteAsync(stagedCoverUri, { idempotent: true }).catch(
          () => {},
        );
      }
      return;
    }
    const batchId = crypto.randomUUID();
    activeBatch = batchId;
    const stop = window.mmplayer.on("metadataProgress", (event) => {
      if (event.batchId === batchId) progress?.(event.current, event.total);
    });
    let results: MetadataWriteResult[];
    try {
      results = await window.mmplayer.invoke("writeMetadata", {
        items,
        batchId,
      });
    } finally {
      stop();
      activeBatch = undefined;
      if (stagedCoverUri) {
        await FileSystem.deleteAsync(stagedCoverUri, { idempotent: true }).catch(
          () => {},
        );
      }
    }
    // Refresh the snapshots used by the persistent player and saved recent cards once per job.
    const snapshot = await window.mmplayer.invoke("library", undefined);
    player.setTracks(snapshot.tracks);
    const indexed = new Map(snapshot.tracks.map((track) => [track.id, track]));
    const current = usePlayerStore.getState();
    usePlayerStore.setState({
      recentMedia: current.recentMedia.map((item: any) => {
        const track = indexed.get(item.id);
        return track
          ? {
              ...item,
              title: track.title,
              subtitle: track.artist,
              imageUrl: track.cover,
            }
          : item;
      }),
    });
    await current.saveRecentsState().catch(console.warn);
    if (cancelled) throw Error("ERR_CANCELLED");
    const failures = results
      .filter((result) => !result.success)
      .map(failureMessage);
    if (failures.length) {
      Alert.alert(i18n.t("desktop:metadataPartial"), failures.join("\n"));
      throw Error(i18n.t("desktop:metadataPartial"));
    }
  },
  cancelSave() {
    cancelled = true;
    return activeBatch
      ? window.mmplayer.invoke("cancelMetadata", { batchId: activeBatch })
      : Promise.resolve();
  },
};
