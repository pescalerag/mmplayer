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
};

export async function getAudioFiles(): Promise<AudioTag[]> {
  return await NativeAudioScannerModule.getAudioFiles();
}