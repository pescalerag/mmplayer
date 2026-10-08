import { requireNativeModule } from 'expo-modules-core';

const NativeAudioScannerModule = requireNativeModule('NativeAudioScanner');

export type AudioTag = {
  id: string;
  uri: string;
  filename: string;
  title: string;
  artist: string;
  album: string;
  albumId: string;
  coverUrl: string;
  duration: number;
  trackNumber: number;
  discNumber: number;
  year?: number | null; // Nuestro nuevo campo
  albumArtist?: string | null;
  lastModified: number;
  replayGain?: number | null;
  replayPeak?: number | null;
  genre?: string | null;
};

export async function getAudioFiles(scanReplayGain: boolean = false): Promise<AudioTag[]> {
  return await NativeAudioScannerModule.getAudioFiles(scanReplayGain);
}

export interface ReplayGainMetadata { gain: number | null; peak: number | null }

export async function getReplayGainMetadata(uri: string): Promise<ReplayGainMetadata> {
  return NativeAudioScannerModule.getReplayGainMetadata(uri);
}

export async function getReplayGain(uri: string): Promise<number | null> {
  return await NativeAudioScannerModule.getReplayGain(uri);
}

/**
 * Reads `length` bytes from `filePath` starting at byte `offset`.
 * Returns the data as a Base64-encoded string (no padding newlines).
 * Uses RandomAccessFile on the native side for true byte-accurate seeking.
 */
export async function readFileChunk(filePath: string, offset: number, length: number): Promise<string> {
  return await NativeAudioScannerModule.readFileChunk(filePath, offset, length);
}

export type PhysicalMetadata = {
  title: string;
  artist: string;
  album: string;
  year: string;
  trackNumber: string;
  genre: string;
  albumArtist: string;
  discNumber: string;
};

export async function readMetadata(filePath: string): Promise<PhysicalMetadata> {
  return await NativeAudioScannerModule.readMetadata(filePath);
}

export type UpdateMetadataPayload = {
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  year?: number | null;
  trackNumber?: number | null;
  genre?: string | null;
  coverArtPath?: string | null;
  albumArtist?: string | null;
  discNumber?: number | null;
};

export async function updateMetadata(
  filePath: string,
  metadata: UpdateMetadataPayload
): Promise<boolean> {
  return await NativeAudioScannerModule.updateMetadata(filePath, metadata);
}

export type BatchMetadataItem = {
  filePath: string;
  metadata: UpdateMetadataPayload;
};

export async function updateMetadataBatch(metadataList: BatchMetadataItem[]): Promise<boolean> {
  return await NativeAudioScannerModule.updateMetadataBatch(JSON.stringify(metadataList));
}

export async function cancelUpdateMetadataBatch(): Promise<void> {
  return await NativeAudioScannerModule.cancelUpdateMetadataBatch();
}

export async function scanMultipleFiles(filePaths: string[]): Promise<boolean> {
  return await NativeAudioScannerModule.scanMultipleFiles(filePaths);
}

export async function requestWritePermission(filePaths: string[]): Promise<boolean> {
  return await NativeAudioScannerModule.requestWritePermission(filePaths);
}

export type DeviceStorageStats = {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
};

export async function getStorageStats(): Promise<DeviceStorageStats> {
  return await NativeAudioScannerModule.getStorageStats();
}

export async function updateWidget(
  title: string,
  artist: string,
  coverUri: string | null,
  isPlaying: boolean
): Promise<void> {
  return await NativeAudioScannerModule.updateWidget(title, artist, coverUri, isPlaying);
}

export async function acquireCastWakeLock(): Promise<boolean> {
  try {
    return await NativeAudioScannerModule.acquireCastWakeLock();
  } catch (e) {
    console.warn('[NativeAudioScanner] acquireCastWakeLock error:', e);
    return false;
  }
}

export async function releaseCastWakeLock(): Promise<boolean> {
  try {
    return await NativeAudioScannerModule.releaseCastWakeLock();
  } catch (e) {
    console.warn('[NativeAudioScanner] releaseCastWakeLock error:', e);
    return false;
  }
}

export async function isBatteryOptimizationIgnored(): Promise<boolean> {
  try {
    return await NativeAudioScannerModule.isBatteryOptimizationIgnored();
  } catch (e) {
    console.warn('[NativeAudioScanner] isBatteryOptimizationIgnored error:', e);
    return true;
  }
}

export async function requestIgnoreBatteryOptimizations(): Promise<boolean> {
  try {
    return await NativeAudioScannerModule.requestIgnoreBatteryOptimizations();
  } catch (e) {
    console.warn('[NativeAudioScanner] requestIgnoreBatteryOptimizations error:', e);
    return false;
  }
}

export async function findAndScanUnindexedAudioFiles(knownUris: string[]): Promise<string[]> {
  try {
    return await NativeAudioScannerModule.findAndScanUnindexedAudioFiles(knownUris);
  } catch (e) {
    console.warn('[NativeAudioScanner] findAndScanUnindexedAudioFiles error:', e);
    return [];
  }
}

export async function checkFilesExistOnDisk(filePaths: string[]): Promise<boolean[]> {
  try {
    return await NativeAudioScannerModule.checkFilesExistOnDisk(filePaths);
  } catch (e) {
    console.warn('[NativeAudioScanner] checkFilesExistOnDisk error:', e);
    return filePaths.map(() => false);
  }
}

export async function generateVideoThumbnail(videoUri: string, destPath: string): Promise<string | null> {
  try {
    if (NativeAudioScannerModule && typeof NativeAudioScannerModule.generateVideoThumbnail === 'function') {
      return await NativeAudioScannerModule.generateVideoThumbnail(videoUri, destPath);
    }
  } catch (e) {
    console.warn('[NativeAudioScanner] generateVideoThumbnail error:', e);
  }
  return null;
}

export enum RingtoneType {
  RINGTONE = 1,
  NOTIFICATION = 2,
  ALARM = 4,
}

export function canWriteSettings(): boolean {
  try {
    return NativeAudioScannerModule.canWriteSettings();
  } catch {
    return false;
  }
}

export function openWriteSettingsPermission(): void {
  try {
    NativeAudioScannerModule.openWriteSettingsPermission();
  } catch (e) {
    console.warn('[NativeAudioScanner] openWriteSettingsPermission error:', e);
  }
}

export async function setRingtone(
  filePathOrUri: string,
  ringtoneType: RingtoneType
): Promise<{ success: boolean; error?: string }> {
  try {
    return await NativeAudioScannerModule.setRingtone(filePathOrUri, ringtoneType);
  } catch (e: any) {
    return { success: false, error: e?.message || 'UNKNOWN_ERROR' };
  }
}

export type ResolvedAudioInfo = {
  fileUrl: string;
  resolvedPath: string;
  originalUri: string;
  title: string;
  artist: string;
  album: string;
  albumArtist?: string | null;
  duration: number;
  coverUrl?: string | null;
  genre?: string | null;
  year?: number | null;
  trackNumber: number;
  discNumber: number;
  lastModified: number;
  size?: number;
};

export function getLaunchAudioUri(): string | null {
  try {
    return NativeAudioScannerModule.getLaunchAudioUri?.() ?? null;
  } catch {
    return null;
  }
}

export function clearLaunchAudioUri(): boolean {
  try {
    return NativeAudioScannerModule.clearLaunchAudioUri?.() ?? false;
  } catch {
    return false;
  }
}

export async function resolveAudioUriInfo(uriString: string): Promise<ResolvedAudioInfo | null> {
  try {
    return await NativeAudioScannerModule.resolveAudioUriInfo(uriString);
  } catch (e) {
    console.warn('[NativeAudioScanner] resolveAudioUriInfo error:', e);
    return null;
  }
}

export function addAudioFileOpenedListener(listener: (event: { uri: string }) => void) {
  return NativeAudioScannerModule.addListener('onAudioFileOpened', listener);
}



