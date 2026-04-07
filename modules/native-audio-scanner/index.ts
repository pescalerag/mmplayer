import { requireNativeModule } from 'expo-modules-core';

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
  trackNumber?: number;
  discNumber?: number;
};

const NativeAudioScanner = requireNativeModule('NativeAudioScanner');

export function getAudioFiles(): Promise<AudioTag[]> {
  return NativeAudioScanner.getAudioFiles();
}
