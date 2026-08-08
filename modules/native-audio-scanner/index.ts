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
};

export async function getAudioFiles(scanReplayGain: boolean = false): Promise<AudioTag[]> {
  return await NativeAudioScannerModule.getAudioFiles(scanReplayGain);
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

export async function updateMetadata(
  filePath: string,
  title: string | null,
  artist: string | null,
  album: string | null,
  year: number | null,
  trackNumber: number | null,
  genre: string | null,
  coverArtPath: string | null,
  albumArtist?: string | null,
  discNumber?: number | null
): Promise<boolean> {
  return await NativeAudioScannerModule.updateMetadata(
    filePath,
    {
      title,
      artist,
      album,
      year,
      trackNumber,
      genre,
      coverArtPath,
      albumArtist,
      discNumber
    }
  );
}

export type BatchMetadataItem = {
  filePath: string;
  metadata: {
    title: string | null;
    artist: string | null;
    album: string | null;
    year: number | null;
    trackNumber: number | null;
    genre: string | null;
    coverArtPath: string | null;
    albumArtist: string | null;
    discNumber: number | null;
  };
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