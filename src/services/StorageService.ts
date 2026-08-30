import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import Artist from '../database/models/Artist';
import Playlist from '../database/models/Playlist';
import Album from '../database/models/Album';
import Track from '../database/models/Track';
import { getStorageStats } from '../../modules/native-audio-scanner';

const BASE_MEDIA_DIR = `${FileSystem.documentDirectory}media_assets/`;
const ARTIST_DIR = `${BASE_MEDIA_DIR}artist_images/`;
const PLAYLIST_DIR = `${BASE_MEDIA_DIR}playlist_covers/`;
const CD_DIR = `${BASE_MEDIA_DIR}cd_covers/`;
const CANVAS_DIR = `${BASE_MEDIA_DIR}canvas_videos/`;

export interface StorageBreakdown {
  deviceTotalBytes: number;
  deviceUsedBytes: number;
  deviceFreeBytes: number;
  
  otherFilesBytes: number;
  audioFilesBytes: number;
  mmplayerTotalBytes: number;

  artistImagesBytes: number;
  playlistCoversBytes: number;
  cdCoversBytes: number;
  canvasVideosBytes: number;
  lyricsBytes: number;
  cacheBytes: number;
}

const getDirectorySize = async (dirPath: string): Promise<number> => {
  if (Platform.OS === 'web' || !dirPath) return 0;
  try {
    const info = await FileSystem.getInfoAsync(dirPath);
    if (!info.exists) return 0;
    if (!info.isDirectory) return info.size || 0;

    const files = await FileSystem.readDirectoryAsync(dirPath);
    let total = 0;
    for (const file of files) {
      const fullPath = dirPath.endsWith('/') ? `${dirPath}${file}` : `${dirPath}/${file}`;
      const fileInfo = await FileSystem.getInfoAsync(fullPath);
      if (fileInfo.exists) {
        if (fileInfo.isDirectory) {
          total += await getDirectorySize(`${fullPath}/`);
        } else {
          total += fileInfo.size || 0;
        }
      }
    }
    return total;
  } catch {
    return 0;
  }
};

const clearDirectoryFiles = async (dirPath: string) => {
  if (Platform.OS === 'web' || !dirPath) return;
  try {
    const info = await FileSystem.getInfoAsync(dirPath);
    if (info.exists) {
      const files = await FileSystem.readDirectoryAsync(dirPath);
      for (const file of files) {
        await FileSystem.deleteAsync(`${dirPath}${file}`, { idempotent: true });
      }
    }
  } catch (e) {
    console.warn(`[StorageService] Error clearing dir ${dirPath}:`, e);
  }
};

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export const StorageService = {
  getStorageBreakdown: async (): Promise<StorageBreakdown> => {
    let deviceTotalBytes = 0;
    let deviceUsedBytes = 0;
    let deviceFreeBytes = 0;

    if (Platform.OS === 'android') {
      try {
        const stats = await getStorageStats();
        deviceTotalBytes = stats.totalBytes || 0;
        deviceFreeBytes = stats.freeBytes || 0;
        deviceUsedBytes = stats.usedBytes || (deviceTotalBytes - deviceFreeBytes);
      } catch (e) {
        console.warn('[StorageService] Error fetching native storage stats:', e);
      }
    }

    // 1. Archivos de audio y letras
    let audioFilesBytes = 0;
    let lyricsBytes = 0;
    try {
      const tracksColl = database.collections.get<Track>('tracks');
      const tracks = await tracksColl.query().fetch();
      for (const track of tracks) {
        const tSize = (track as any).size;
        if (tSize && typeof tSize === 'number' && tSize > 0) {
          audioFilesBytes += tSize;
        }
        if (track.lyricsLRC) {
          lyricsBytes += encodeURIComponent(track.lyricsLRC).replace(/%[a-f0-9]{2}/gi, 'x').length;
        }
      }
    } catch (e) {
      console.warn('[StorageService] Error calculating audio tracks size:', e);
    }

    // 2. Desglose MMPlayer
    const artistImagesBytes = await getDirectorySize(ARTIST_DIR);
    const playlistCoversBytes = await getDirectorySize(PLAYLIST_DIR);
    const cdCoversBytes = await getDirectorySize(CD_DIR);
    const canvasVideosBytes = await getDirectorySize(CANVAS_DIR);
    const cacheBytes = FileSystem.cacheDirectory ? await getDirectorySize(FileSystem.cacheDirectory) : 0;

    const mmplayerTotalBytes =
      artistImagesBytes +
      playlistCoversBytes +
      cdCoversBytes +
      canvasVideosBytes +
      lyricsBytes +
      cacheBytes;

    if (deviceTotalBytes === 0) {
      deviceUsedBytes = audioFilesBytes + mmplayerTotalBytes;
      deviceTotalBytes = deviceUsedBytes * 2 || 1024 * 1024 * 1024 * 64; // 64 GB
      deviceFreeBytes = deviceTotalBytes - deviceUsedBytes;
    }

    const otherFilesBytes = Math.max(0, deviceUsedBytes - audioFilesBytes - mmplayerTotalBytes);

    return {
      deviceTotalBytes,
      deviceUsedBytes,
      deviceFreeBytes,
      otherFilesBytes,
      audioFilesBytes,
      mmplayerTotalBytes,
      artistImagesBytes,
      playlistCoversBytes,
      cdCoversBytes,
      canvasVideosBytes,
      lyricsBytes,
      cacheBytes,
    };
  },

  clearCache: async (): Promise<void> => {
    if (Platform.OS === 'web' || !FileSystem.cacheDirectory) return;
    try {
      const files = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory);
      for (const file of files) {
        await FileSystem.deleteAsync(`${FileSystem.cacheDirectory}${file}`, { idempotent: true });
      }
    } catch (e) {
      console.warn('[StorageService] Error clearing cache:', e);
    }
  },

  clearAllArtistImages: async (): Promise<void> => {
    await clearDirectoryFiles(ARTIST_DIR);
    try {
      const artistsColl = database.collections.get<Artist>('artists');
      const artists = await artistsColl.query().fetch();
      const withImages = artists.filter(a => a.imageUrl !== null && a.imageUrl !== '');
      if (withImages.length > 0) {
        await database.write(async () => {
          const batchUpdates = withImages.map(artist =>
            artist.prepareUpdate(a => {
              a.imageUrl = null;
            })
          );
          await database.batch(batchUpdates);
        });
      }
    } catch (e) {
      console.warn('[StorageService] Error clearing artist images from DB:', e);
    }
  },

  clearAllPlaylistCovers: async (): Promise<void> => {
    await clearDirectoryFiles(PLAYLIST_DIR);
    try {
      const playlistsColl = database.collections.get<Playlist>('playlists');
      const playlists = await playlistsColl.query().fetch();
      const withCovers = playlists.filter(p => p.coverCustomUrl !== null && p.coverCustomUrl !== '');
      if (withCovers.length > 0) {
        await database.write(async () => {
          const batchUpdates = withCovers.map(playlist =>
            playlist.prepareUpdate(p => {
              p.coverCustomUrl = null;
            })
          );
          await database.batch(batchUpdates);
        });
      }
    } catch (e) {
      console.warn('[StorageService] Error clearing playlist covers from DB:', e);
    }
  },

  clearAllCDCovers: async (): Promise<void> => {
    await clearDirectoryFiles(CD_DIR);
    try {
      const albumsColl = database.collections.get<Album>('albums');
      const albums = await albumsColl.query().fetch();
      const withCD = albums.filter(a => a.cdArtUrl !== null && a.cdArtUrl !== '');
      if (withCD.length > 0) {
        await database.write(async () => {
          const batchUpdates = withCD.map(album =>
            album.prepareUpdate(a => {
              a.cdArtUrl = null;
            })
          );
          await database.batch(batchUpdates);
        });
      }
    } catch (e) {
      console.warn('[StorageService] Error clearing CD covers from DB:', e);
    }
  },

  clearAllCanvasVideos: async (): Promise<void> => {
    await clearDirectoryFiles(CANVAS_DIR);
    try {
      const tracksColl = database.collections.get<Track>('tracks');
      const tracks = await tracksColl.query().fetch();
      const withCanvas = tracks.filter(t => t.bgVideo !== null && t.bgVideo !== '');
      if (withCanvas.length > 0) {
        await database.write(async () => {
          const batchUpdates = withCanvas.map(track =>
            track.prepareUpdate(t => {
              t.bgVideo = null;
            })
          );
          await database.batch(batchUpdates);
        });
      }
    } catch (e) {
      console.warn('[StorageService] Error clearing canvas videos from DB:', e);
    }
  }
};
