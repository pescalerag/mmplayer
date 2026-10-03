import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import {
  MediaAssetService,
  cleanupTempSource,
} from '../services/MediaAssetService';
import { database } from '../database';

describe('MediaAssetService - Image Assets & Maintenance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'android';
    (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([]);
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 1024 });
  });

  describe('cleanupTempSource', () => {
    it('does nothing if uri is empty or does not start with file://', async () => {
      await cleanupTempSource('');
      await cleanupTempSource('content://media/123');
      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    });

    it('deletes temp file when path includes cache or DocumentPicker', async () => {
      await cleanupTempSource('file:///data/user/0/com.mmplayer/cache/temp.jpg');
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        'file:///data/user/0/com.mmplayer/cache/temp.jpg',
        { idempotent: true }
      );

      await cleanupTempSource('file:///data/user/0/com.mmplayer/DocumentPicker/temp.mp4');
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        'file:///data/user/0/com.mmplayer/DocumentPicker/temp.mp4',
        { idempotent: true }
      );
    });

    it('does not delete if not a temp cache path', async () => {
      await cleanupTempSource('file:///storage/emulated/0/Music/song.mp3');
      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    });
  });

  describe('User Avatar', () => {
    it('saves user avatar and cleans up temp source', async () => {
      const source = 'file:///data/user/0/com.mmplayer/cache/avatar.png';
      const result = await MediaAssetService.saveUserAvatar(source);
      expect(result).toContain('user_avatar.png');
      expect(FileSystem.copyAsync).toHaveBeenCalled();
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(source, { idempotent: true });
    });

    it('returns existing path when sourceUri is already destination', async () => {
      const dest = `${FileSystem.documentDirectory}media_assets/user_avatar/user_avatar.jpg`;
      const result = await MediaAssetService.saveUserAvatar(dest);
      expect(result).toContain(dest);
      expect(FileSystem.copyAsync).not.toHaveBeenCalled();
    });

    it('removes user avatar', async () => {
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValueOnce(['user_avatar.jpg']);
      await MediaAssetService.removeUserAvatar();
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        expect.stringContaining('user_avatar.jpg'),
        { idempotent: true }
      );
    });
  });

  describe('Artist Image', () => {
    it('saves artist image and cleans up temp source', async () => {
      const source = 'file:///cache/artist1.jpg';
      const result = await MediaAssetService.saveArtistImage('art-10', source);
      expect(result).toContain('artist_art-10.jpg');
      expect(FileSystem.copyAsync).toHaveBeenCalled();
    });

    it('removes artist image', async () => {
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValueOnce(['artist_art-10.jpg']);
      await MediaAssetService.removeArtistImage('art-10');
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        expect.stringContaining('artist_art-10.jpg'),
        { idempotent: true }
      );
    });
  });

  describe('Playlist Cover', () => {
    it('saves playlist cover and cleans up temp source', async () => {
      const source = 'file:///cache/pl1.jpg';
      const result = await MediaAssetService.savePlaylistCover('pl-5', source);
      expect(result).toContain('playlist_pl-5.jpg');
      expect(FileSystem.copyAsync).toHaveBeenCalled();
    });

    it('removes playlist cover', async () => {
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValueOnce(['playlist_pl-5.jpg']);
      await MediaAssetService.removePlaylistCover('pl-5');
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        expect.stringContaining('playlist_pl-5.jpg'),
        { idempotent: true }
      );
    });
  });

  describe('Album CD Cover', () => {
    it('saves album CD cover and cleans up temp source', async () => {
      const source = 'file:///cache/cd.png';
      const result = await MediaAssetService.saveAlbumCDCover('alb-2', source);
      expect(result).toContain('album_cd_alb-2.png');
      expect(FileSystem.copyAsync).toHaveBeenCalled();
    });

    it('removes album CD cover', async () => {
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValueOnce(['album_cd_alb-2.png']);
      await MediaAssetService.removeAlbumCDCover('alb-2');
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        expect.stringContaining('album_cd_alb-2.png'),
        { idempotent: true }
      );
    });
  });

  describe('Canvas Videos and Thumbnails', () => {
    it('getAllUploadedCanvasVideos lists and parses video items', async () => {
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValueOnce([
        'canvas_abc123.mp4',
        'not_a_video.txt',
      ]);
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 2048,
        modificationTime: 1700000000,
      });

      const videos = await MediaAssetService.getAllUploadedCanvasVideos();
      expect(videos).toHaveLength(1);
      expect(videos[0].fileName).toBe('canvas_abc123.mp4');
      expect(videos[0].md5).toBe('abc123');
    });

    it('removeTrackCanvasVideo purges entity file', async () => {
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValueOnce(['canvas_track_track-99.mp4']);
      await MediaAssetService.removeTrackCanvasVideo('track-99');
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        expect.stringContaining('canvas_track_track-99.mp4'),
        { idempotent: true }
      );
    });
  });

  describe('Garbage Collector & Migrations', () => {
    let pendingCallbacks: (() => Promise<void>)[] = [];

    beforeEach(() => {
      pendingCallbacks = [];
      jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
        pendingCallbacks.push(cb);
        return 0 as any;
      });
    });

    afterEach(() => {
      (global.setTimeout as any).mockRestore?.();
    });

    it('runGarbageCollector cleans up orphan files not in DB', async () => {
      (database.collections.get as jest.Mock).mockImplementation((name: string) => ({
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue([{ id: 'valid_1' }]),
        }),
      }));

      (FileSystem.readDirectoryAsync as jest.Mock).mockImplementation((dir: string) => {
        if (dir.includes('artist_images')) return Promise.resolve(['artist_valid_1.jpg', 'artist_orphan_2.jpg']);
        if (dir.includes('playlist_covers')) return Promise.resolve(['playlist_orphan_3.jpg']);
        if (dir.includes('cd_covers')) return Promise.resolve(['album_cd_orphan_4.jpg']);
        if (dir.includes('canvas_videos')) return Promise.resolve(['canvas_track_orphan_5.mp4']);
        return Promise.resolve([]);
      });

      MediaAssetService.runGarbageCollector();

      for (const cb of pendingCallbacks) {
        await cb();
      }

      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        expect.stringContaining('artist_orphan_2.jpg'),
        { idempotent: true }
      );
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        expect.stringContaining('playlist_orphan_3.jpg'),
        { idempotent: true }
      );
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        expect.stringContaining('album_cd_orphan_4.jpg'),
        { idempotent: true }
      );
    });

    it('migrateLegacyCacheAssets migrates files located outside media_assets', async () => {
      const mockRecord: any = {
        id: 'legacy_1',
        imageUrl: 'file:///cache/old_art.jpg',
        cdArtUrl: 'file:///cache/old_cd.jpg',
        bgVideo: 'file:///cache/old_video.mp4',
        coverCustomUrl: 'file:///cache/old_cover.jpg',
        update: jest.fn((cb: (r: any) => void) => cb(mockRecord)),
      };

      (database.collections.get as jest.Mock).mockReturnValue({
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue([mockRecord]),
        }),
      });

      (database.write as jest.Mock).mockImplementation(async (cb) => cb());

      MediaAssetService.migrateLegacyCacheAssets();

      for (const cb of pendingCallbacks) {
        await cb();
      }

      expect(database.write).toHaveBeenCalled();
    });
  });

  describe('Canvas Videos and Duplicate Detection', () => {
    it('returns empty list for getAllUploadedCanvasVideos on web or error', async () => {
      (Platform as any).OS = 'web';
      expect(await MediaAssetService.getAllUploadedCanvasVideos()).toEqual([]);

      (Platform as any).OS = 'android';
      (FileSystem.readDirectoryAsync as jest.Mock).mockRejectedValueOnce(new Error('disk error'));
      expect(await MediaAssetService.getAllUploadedCanvasVideos()).toEqual([]);
    });

    it('checkCanvasDuplicate detects duplicate by md5 and by size', async () => {
      // 1. empty or web
      (Platform as any).OS = 'web';
      expect((await MediaAssetService.checkCanvasDuplicate('')).isDuplicate).toBe(false);
      (Platform as any).OS = 'android';

      // 2. not exists
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({ exists: false });
      expect((await MediaAssetService.checkCanvasDuplicate('file:///temp/test.mp4')).isDuplicate).toBe(false);

      // 3. duplicate by MD5
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValueOnce(['canvas_abc123.mp4']);
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((uri: string, opts?: any) => {
        if (uri.includes('canvas_abc123.mp4')) {
          return Promise.resolve({ exists: true, size: 5000, modificationTime: 100 });
        }
        if (opts?.md5) {
          return Promise.resolve({ exists: true, size: 5000, md5: 'abc123' });
        }
        return Promise.resolve({ exists: true, size: 5000 });
      });

      const dupMd5 = await MediaAssetService.checkCanvasDuplicate('file:///temp/test.mp4');
      expect(dupMd5.isDuplicate).toBe(true);
      expect(dupMd5.existingVideo?.md5).toBe('abc123');

      // 4. duplicate by size when no md5
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValueOnce(['canvas_other.mp4']);
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((uri: string, opts?: any) => {
        if (uri.includes('canvas_other.mp4')) {
          return Promise.resolve({ exists: true, size: 8888, modificationTime: 100 });
        }
        if (opts?.md5) {
          return Promise.resolve({ exists: true, size: 8888 }); // no md5 returned
        }
        return Promise.resolve({ exists: true, size: 8888 });
      });

      const dupSize = await MediaAssetService.checkCanvasDuplicate('file:///temp/test2.mp4');
      expect(dupSize.isDuplicate).toBe(true);
      expect(dupSize.existingVideo?.size).toBe(8888);

      // 5. No duplicate found
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValueOnce([]);
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((uri: string, opts?: any) => {
        if (opts?.md5) {
          return Promise.resolve({ exists: true, size: 1234, md5: 'unique_md5' });
        }
        return Promise.resolve({ exists: true, size: 1234 });
      });
      const noDup = await MediaAssetService.checkCanvasDuplicate('file:///temp/unique.mp4');
      expect(noDup.isDuplicate).toBe(false);
      expect(noDup.md5).toBe('unique_md5');

      // 6. Error handling
      (FileSystem.getInfoAsync as jest.Mock).mockRejectedValueOnce(new Error('getInfo failure'));
      const errRes = await MediaAssetService.checkCanvasDuplicate('file:///temp/err.mp4');
      expect(errRes.isDuplicate).toBe(false);
    });

    it('saveNewCanvasVideo reuses existing canvas if already in canvas dir or md5 matches', async () => {
      const canvasDir = `${FileSystem.documentDirectory}media_assets/canvas_videos/`;
      const existingUri = `${canvasDir}canvas_123.mp4`;

      // 1. already in canvas dir and exists
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({ exists: true });
      const res1 = await MediaAssetService.saveNewCanvasVideo(existingUri);
      expect(res1).toBe(existingUri);

      // 2. md5 matches existing video
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValueOnce(['canvas_found.mp4']);
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((uri: string, opts?: any) => {
        if (uri.includes('canvas_found.mp4')) {
          return Promise.resolve({ exists: true, size: 3000, modificationTime: 100 });
        }
        if (opts?.md5) {
          return Promise.resolve({ exists: true, size: 3000, md5: 'found' });
        }
        return Promise.resolve({ exists: true, size: 3000 });
      });

      const tempSource = 'file:///data/user/0/cache/temp_source.mp4';
      const res2 = await MediaAssetService.saveNewCanvasVideo(tempSource, 'found');
      expect(res2).toContain('canvas_found.mp4');
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(tempSource, { idempotent: true });

      // 3. New video copied (destPath does not exist yet)
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValueOnce([]);
      (FileSystem.getInfoAsync as jest.Mock).mockImplementation((uri: string) => {
        if (uri.includes('canvas_brand_new.mp4')) {
          return Promise.resolve({ exists: false });
        }
        return Promise.resolve({ exists: true, size: 4000, md5: 'brand_new' });
      });
      const res3 = await MediaAssetService.saveNewCanvasVideo('file:///storage/new_video.mp4', 'brand_new');
      expect(res3).toContain('canvas_brand_new.mp4');
      expect(FileSystem.copyAsync).toHaveBeenCalled();
    });

    it('saveTrackCanvasVideo reuses canvas and handles errors in deleteCanvasVideo', async () => {
      const canvasDir = `${FileSystem.documentDirectory}media_assets/canvas_videos/`;
      const existingUri = `${canvasDir}canvas_track_1.mp4`;

      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({ exists: true });
      const res1 = await MediaAssetService.saveTrackCanvasVideo('1', existingUri);
      expect(res1).toBe(existingUri);

      // Error in deleteCanvasVideo does not throw
      (FileSystem.deleteAsync as jest.Mock).mockRejectedValueOnce(new Error('delete error'));
      await expect(MediaAssetService.deleteCanvasVideo('file:///some/video.mp4')).resolves.not.toThrow();
    });
  });
});
