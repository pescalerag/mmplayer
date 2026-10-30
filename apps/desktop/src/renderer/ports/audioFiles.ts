/** Desktop filesystem access stays behind the IPC bridge; no Android native module is loaded. */
import type { FileMetadata, MetadataWriteItem } from "@mmplayer/platform";
export interface MusicZipResult {
  folder: string;
  imported: number;
  skipped: number;
}
export interface MusicZipProgress {
  completed: number;
  total: number;
  folder: string;
}
export interface ReplayGainMetadata {
  gain: number | null;
  peak: number | null;
}
export type DeviceStorageStats = {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
};
export enum RingtoneType {
  RINGTONE = 1,
  NOTIFICATION = 2,
  ALARM = 4,
}

export async function resolveAudioUriInfo(uri: string) {
  const tracks = (await window.mmplayer.invoke("library", undefined)).tracks;
  const track = tracks.find(
    (track) => track.fileUrl === uri || uri.endsWith("/" + track.id),
  );
  const info = track ? await window.mmplayer.invoke("fileSystem", { op: "getInfo", uri }) as { exists: boolean; size?: number } : null;
  return track
    ? {
        name: track.title,
        mimeType: "audio/*",
        size: info?.exists ? info.size : undefined,
        duration: track.duration,
        fileUrl: track.fileUrl,
        resolvedPath: track.fileUrl,
        originalUri: uri,
        title: track.title,
        artist: track.artist,
        album: track.album,
        coverUrl: track.cover,
        trackNumber: track.trackNumber || 0,
        discNumber: (track as any).discNumber || 0,
        lastModified: Date.now(),
      }
    : null;
}

export async function getOpenedFileInfo(uri: string) {
  return { name: uri.split("/").pop() || uri, mimeType: "audio/*" };
}

export async function importMusicZip(uri: string, name?: string): Promise<MusicZipResult> {
  return window.mmplayer.invoke("importMusicZip", { uri, name });
}
export function addMusicZipProgressListener(callback: (event: MusicZipProgress) => void) {
  const remove = window.mmplayer.on("musicZipProgress", callback);
  return { remove };
}

export async function getAudioFiles() {
  return [];
}

export async function getReplayGainMetadata(
  uri?: string,
): Promise<ReplayGainMetadata> {
  if (!uri || typeof window?.mmplayer?.invoke !== "function") {
    return { gain: null, peak: null };
  }
  try {
    return await window.mmplayer.invoke("readReplayGain", { uri });
  } catch {
    return { gain: null, peak: null };
  }
}

export async function getReplayGain(uri?: string): Promise<number | null> {
  const metadata = await getReplayGainMetadata(uri);
  return metadata.gain;
}

export async function readFileChunk(): Promise<string> {
  return "";
}

export async function readMetadata(uri: string) {
  const metadata = await window.mmplayer.invoke("readMetadata", { uri });
  return {
    ...metadata,
    year: metadata.year ? String(metadata.year) : "",
    trackNumber: metadata.trackNumber ? String(metadata.trackNumber) : "",
    discNumber: metadata.discNumber ? String(metadata.discNumber) : "",
  };
}

export async function updateMetadata(
  filePath: string,
  metadata: FileMetadata,
): Promise<boolean> {
  return updateMetadataBatch([{ filePath, metadata }]);
}

let metadataCancelled = false;
let metadataBatchId: string | undefined;
export async function updateMetadataBatch(
  items: MetadataWriteItem[],
): Promise<boolean> {
  metadataCancelled = false;
  const batchId = crypto.randomUUID();
  metadataBatchId = batchId;
  try {
    const results = await window.mmplayer.invoke("writeMetadata", {
      items,
      batchId,
    });
    if (metadataCancelled) throw Error("ERR_CANCELLED");
    const failures = results
      .filter((result) => !result.success)
      .map((result) => `${result.filePath}: ${result.error}`);
    if (failures.length) throw Error(failures.join("\n"));
    return true;
  } finally {
    metadataBatchId = undefined;
  }
}
export function cancelUpdateMetadataBatch(): Promise<void> {
  metadataCancelled = true;
  return metadataBatchId
    ? window.mmplayer.invoke("cancelMetadata", { batchId: metadataBatchId })
    : Promise.resolve();
}

export async function scanMultipleFiles(): Promise<boolean> {
  await window.mmplayer.invoke("scan", undefined);
  return true;
}

export async function requestWritePermission(): Promise<boolean> {
  return true;
}

export async function getStorageStats(): Promise<DeviceStorageStats> {
  return await window.mmplayer.invoke("fileSystem", { op: "diskStats" }) as DeviceStorageStats;
}

export async function updateWidget(): Promise<void> {}

export async function acquireCastWakeLock(): Promise<boolean> {
  return false;
}

export async function releaseCastWakeLock(): Promise<boolean> {
  return false;
}

export async function isBatteryOptimizationIgnored(): Promise<boolean> {
  return true;
}

export async function requestIgnoreBatteryOptimizations(): Promise<boolean> {
  return true;
}

export async function findAndScanUnindexedAudioFiles(): Promise<string[]> {
  await window.mmplayer.invoke("scan", undefined);
  return [];
}

export async function checkFilesExistOnDisk(
  filePaths: string[],
): Promise<boolean[]> {
  return await window.mmplayer.invoke("fileSystem", { op: "checkFiles", uris: filePaths }) as boolean[];
}

const FALLBACK_THUMBNAIL_JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

async function captureVideoFrameBase64(
  videoUri: string,
): Promise<string | null> {
  if (typeof document === "undefined" || typeof document.createElement !== "function") {
    return null;
  }
  return new Promise<string | null>((resolve) => {
    let settled = false;
    const video = document.createElement("video");
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        video.pause();
        video.removeAttribute("src");
        video.load?.();
      } catch {
        // Ignore cleanup errors
      }
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), 2500);
    try {
      video.muted = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.crossOrigin = "anonymous";
      const renderFrame = () => {
        try {
          const canvas = document.createElement("canvas");
          const width = Math.max(1, video.videoWidth || 240);
          const height = Math.max(1, video.videoHeight || 348);
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            finish(null);
            return;
          }
          ctx.drawImage(video, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
          const comma = dataUrl.indexOf(",");
          finish(comma >= 0 ? dataUrl.slice(comma + 1) : null);
        } catch {
          finish(null);
        }
      };
      video.onloadedmetadata = () => {
        try {
          const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
          const target = duration > 0.2 ? Math.min(1, duration * 0.1) : 0;
          if (target > 0) {
            video.currentTime = target;
          } else {
            renderFrame();
          }
        } catch {
          renderFrame();
        }
      };
      video.onseeked = renderFrame;
      video.onerror = () => finish(null);
      video.src = videoUri;
      video.load?.();
    } catch {
      finish(null);
    }
  });
}

export async function generateVideoThumbnail(
  videoUri: string,
  destPath?: string,
): Promise<string | null> {
  if (!videoUri) return null;
  const targetUri =
    destPath ||
    `mmplayer-media://asset/app-cache/video_thumb_${Date.now()}.jpg`;
  try {
    const { writeAsStringAsync, EncodingType } = await import("./fileSystem");
    const capturedBase64 = await captureVideoFrameBase64(videoUri);
    await writeAsStringAsync(
      targetUri,
      capturedBase64 || FALLBACK_THUMBNAIL_JPEG_BASE64,
      { encoding: EncodingType.Base64 },
    );
    return targetUri;
  } catch (error) {
    console.warn("[audioFiles] Error generating desktop video thumbnail:", error);
    return null;
  }
}

export function canWriteSettings(): boolean {
  return false;
}

export function openWriteSettingsPermission(): void {}

export async function setRingtone() {
  return { success: false, error: "UNSUPPORTED_ON_DESKTOP" };
}

export function getLaunchAudioUri(): string | null {
  return null;
}

export function clearLaunchAudioUri(): boolean {
  return false;
}

export function addAudioFileOpenedListener() {
  return { remove: () => {} };
}
