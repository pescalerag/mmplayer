import {
  ExternalAudioService,
  createExternalTrack,
  EXTERNAL_AUDIO_UNSAVED_MSG,
} from '../services/ExternalAudioService';
import * as NativeScanner from '../../modules/native-audio-scanner';
import { database } from '../database';
import { navigationRef, waitForNavigationReady } from '../navigation/navigationRef';
import { usePlayerStore } from '../store/usePlayerStore';
import { useToastStore } from '../store/useToastStore';

jest.mock('../../modules/native-audio-scanner', () => ({
  resolveAudioUriInfo: jest.fn(),
  clearLaunchAudioUri: jest.fn(),
  addAudioFileOpenedListener: jest.fn(),
}));

describe('ExternalAudioService', () => {
  const showToastSpy = jest.fn();
  const playSingleTrackSpy = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    (useToastStore.getState as jest.Mock) = jest.fn().mockReturnValue({
      showToast: showToastSpy,
    });
    (usePlayerStore.getState as jest.Mock) = jest.fn().mockReturnValue({
      playSingleTrack: playSingleTrackSpy,
    });
  });

  describe('isAudioUrl', () => {
    it('returns false for non-string or falsy values', () => {
      expect(ExternalAudioService.isAudioUrl(null)).toBe(false);
      expect(ExternalAudioService.isAudioUrl(undefined)).toBe(false);
      expect(ExternalAudioService.isAudioUrl('' as any)).toBe(false);
    });

    it('returns false for special ignored URLs', () => {
      expect(ExternalAudioService.isAudioUrl('mmplayer://play/123')).toBe(false);
      expect(ExternalAudioService.isAudioUrl('https://example.com/widget/player')).toBe(false);
      expect(ExternalAudioService.isAudioUrl('trackplayer://notification.click')).toBe(false);
    });

    it('returns true for content:// URIs', () => {
      expect(ExternalAudioService.isAudioUrl('content://media/external/audio/media/1234')).toBe(true);
    });

    it('returns true for supported audio file extensions', () => {
      expect(ExternalAudioService.isAudioUrl('file:///storage/emulated/0/Music/song.mp3')).toBe(true);
      expect(ExternalAudioService.isAudioUrl('/sdcard/Download/track.FLAC')).toBe(true);
      expect(ExternalAudioService.isAudioUrl('file:///song.wav?param=1')).toBe(true);
      expect(ExternalAudioService.isAudioUrl('/music/tune.ogg')).toBe(true);
      expect(ExternalAudioService.isAudioUrl('/music/tune.m4a')).toBe(true);
      expect(ExternalAudioService.isAudioUrl('/music/tune.opus')).toBe(true);
      expect(ExternalAudioService.isAudioUrl('/music/tune.aac')).toBe(true);
    });

    it('returns false for non-audio file extensions or web URLs', () => {
      expect(ExternalAudioService.isAudioUrl('file:///docs/report.pdf')).toBe(false);
      expect(ExternalAudioService.isAudioUrl('/images/photo.png')).toBe(false);
      expect(ExternalAudioService.isAudioUrl('https://example.com/audio.mp3')).toBe(false);
    });
  });

  describe('createExternalTrack', () => {
    it('creates an in-memory track object with relations and dummy methods', async () => {
      const info = {
        title: 'External Song',
        artist: 'External Artist',
        album: 'External Album',
        fileUrl: 'file:///path/to/song.mp3',
        originalUri: 'content://audio/1',
        duration: 180,
        coverUrl: 'file:///path/to/cover.jpg',
        year: 2024,
        size: 5000000,
        genre: 'Rock',
        trackNumber: 3,
        discNumber: 1,
        resolvedPath: '/path/to/song.mp3',
        lastModified: 1700000000,
      };

      const track = createExternalTrack(info);

      expect(track.id).toMatch(/^ext_/);
      expect(track.title).toBe('External Song');
      expect(track.fileUrl).toBe('file:///path/to/song.mp3');
      expect((track as any).isExternal).toBe(true);
      expect(track.isExcludedFromShuffle).toBe(true);

      // Verify album relation
      const album = await track.album.fetch();
      expect(album.title).toBe('External Album');
      expect(album.year).toBe(2024);

      // Verify artist relation
      const artist = await track.artist.fetch();
      expect(artist.name).toBe('External Artist');

      // Verify queryCollaborators and queryTags
      const collabs = await (track as any).queryCollaborators.fetch();
      expect(collabs).toHaveLength(1);
      const tags = await (track as any).queryTags.fetch();
      expect(tags).toEqual([]);

      // Verify toggleLike shows toast
      await track.toggleLike();
      expect(showToastSpy).toHaveBeenCalledWith(EXTERNAL_AUDIO_UNSAVED_MSG, 'information-circle');

      // Verify other dummy methods don't throw
      await track.updateRating(5);
      await track.updateBgVideo('file:///video.mp4');
      await track.toggleExcludeFromShuffle();
      await track.setExcludeFromShuffle(false);
    });

    it('uses fallback metadata when info properties are missing', async () => {
      const info = {
        fileUrl: 'file:///path/to/untitled.mp3',
        originalUri: 'content://audio/2',
      };

      const track = createExternalTrack(info as any);
      expect(track.title).toBe('Audio');
      const album = await track.album.fetch();
      expect(album.title).toBe('Álbum desconocido');
      const artist = await track.artist.fetch();
      expect(artist.name).toBe('Artista desconocido');
    });
  });

  describe('handleOpenedAudioUrl', () => {
    it('returns false for empty URL', async () => {
      expect(await ExternalAudioService.handleOpenedAudioUrl('')).toBe(false);
    });

    it('returns false if native info resolution returns null', async () => {
      (NativeScanner.resolveAudioUriInfo as jest.Mock).mockResolvedValue(null);
      const result = await ExternalAudioService.handleOpenedAudioUrl('content://audio/1');
      expect(result).toBe(false);
    });

    it('plays existing track from database if already scanned', async () => {
      const existingTrack = { id: 'track_in_db', title: 'Existing Track' };
      (NativeScanner.resolveAudioUriInfo as jest.Mock).mockResolvedValue({
        fileUrl: 'file:///storage/song.mp3',
        originalUri: 'content://audio/99',
        title: 'Existing Track',
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([existingTrack]),
      };
      (database.collections.get as jest.Mock).mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      });

      (waitForNavigationReady as jest.Mock).mockResolvedValue(true);

      const result = await ExternalAudioService.handleOpenedAudioUrl('content://audio/99');
      expect(result).toBe(true);
      expect(playSingleTrackSpy).toHaveBeenCalledWith(existingTrack, 'external_file');
      expect(navigationRef.navigate).toHaveBeenCalledWith('Player');
      expect(NativeScanner.clearLaunchAudioUri).toHaveBeenCalled();
    });

    it('creates and plays external track when not found in database', async () => {
      (NativeScanner.resolveAudioUriInfo as jest.Mock).mockResolvedValue({
        fileUrl: 'file:///storage/new_song.mp3',
        originalUri: 'content://audio/100',
        resolvedPath: '/storage/new_song.mp3',
        title: 'Brand New Song',
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
      };
      (database.collections.get as jest.Mock).mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      });

      (waitForNavigationReady as jest.Mock).mockResolvedValue(true);

      const result = await ExternalAudioService.handleOpenedAudioUrl('content://audio/100');
      expect(result).toBe(true);
      expect(playSingleTrackSpy).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Brand New Song', isExternal: true }),
        'external_file'
      );
      expect(navigationRef.navigate).toHaveBeenCalledWith('Player');
      expect(NativeScanner.clearLaunchAudioUri).toHaveBeenCalled();
    });

    it('returns false when an error is thrown', async () => {
      (NativeScanner.resolveAudioUriInfo as jest.Mock).mockRejectedValue(new Error('Native error'));
      const result = await ExternalAudioService.handleOpenedAudioUrl('content://audio/error');
      expect(result).toBe(false);
    });
  });

  describe('subscribeToAudioFileOpened', () => {
    it('sets up listener and executes callback when event has uri', () => {
      let listenerCallback: any;
      (NativeScanner.addAudioFileOpenedListener as jest.Mock).mockImplementation((cb: any) => {
        listenerCallback = cb;
        return { remove: jest.fn() };
      });

      const callback = jest.fn();
      const sub = ExternalAudioService.subscribeToAudioFileOpened(callback);

      listenerCallback({ uri: 'content://audio/opened' });
      expect(callback).toHaveBeenCalledWith('content://audio/opened');

      // Calling with null or empty uri doesn't fire callback
      listenerCallback(null);
      expect(callback).toHaveBeenCalledTimes(1);

      expect(sub).toBeDefined();
    });

    it('handles subscription failure gracefully', () => {
      (NativeScanner.addAudioFileOpenedListener as jest.Mock).mockImplementation(() => {
        throw new Error('Not supported');
      });

      const sub = ExternalAudioService.subscribeToAudioFileOpened(jest.fn());
      expect(sub).toBeDefined();
      expect(typeof sub.remove).toBe('function');
      sub.remove();
    });
  });
});
