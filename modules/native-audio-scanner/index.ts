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