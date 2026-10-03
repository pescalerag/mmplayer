import TrackPlayer, { RepeatMode } from 'react-native-track-player';
import { createMMKV } from 'react-native-mmkv';
import { usePlayerStore } from '../store/usePlayerStore';
import { ShuffleService } from '../services/ShuffleService';
import { database } from '../database';
import Track from '../database/models/Track';
import Album from '../database/models/Album';

describe('Player Store Features & Shuffle Helpers', () => {
  const createTestTrack = (id: string, overrides: any = {}) => {
    const track: any = {
      id,
      title: `Title ${id}`,
      fileUrl: `file:///music/${id}.mp3`,
      duration: 180,
      isExcludedFromShuffle: false,
      prepareUpdate: jest.fn().mockImplementation((cb: (t: any) => void) => {
        cb(track);
        return track;
      }),
      update: jest.fn().mockImplementation(async (cb: (t: any) => void) => {
        cb(track);
        return track;
      }),
      setExcludeFromShuffle: jest.fn().mockImplementation(async function (this: any, val: boolean) {
        this.isExcludedFromShuffle = val;
      }),
      album: {
        fetch: jest.fn().mockResolvedValue({ id: 'alb-1', title: 'Album 1', coverUrl: 'cover.jpg' }),
      },
      artist: {
        fetch: jest.fn().mockResolvedValue({ id: 'art-1', name: 'Artist 1' }),
      },
      queryCollaborators: {
        fetch: jest.fn().mockResolvedValue([]),
      },
      ...overrides,
    };
    return track as Track;
  };

  const createTestAlbum = (id: string) => {
    const album: any = {
      id,
      title: `Album ${id}`,
      isExcludedFromShuffle: false,
      prepareUpdate: jest.fn().mockImplementation((cb: (a: any) => void) => {
        cb(album);
        return album;
      }),
      setExcludeFromShuffle: jest.fn().mockImplementation(async function (this: any, val: boolean) {
        this.isExcludedFromShuffle = val;
      }),
    };
    return album as Album;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ShuffleService batch exclusion methods', () => {
    it('batchSetTracksExclusion updates multiple tracks', async () => {
      const track1 = createTestTrack('t1');
      const track2 = createTestTrack('t2');

      await ShuffleService.batchSetTracksExclusion([track1, track2], true);

      expect(database.write).toHaveBeenCalled();
      expect(database.batch).toHaveBeenCalled();
      expect(track1.isExcludedFromShuffle).toBe(true);
      expect(track2.isExcludedFromShuffle).toBe(true);
    });

    it('batchSetAlbumsExclusion updates multiple albums', async () => {
      const album1 = createTestAlbum('a1');
      const album2 = createTestAlbum('a2');

      await ShuffleService.batchSetAlbumsExclusion([album1, album2], true);

      expect(database.write).toHaveBeenCalled();
      expect(database.batch).toHaveBeenCalled();
      expect(album1.isExcludedFromShuffle).toBe(true);
      expect(album2.isExcludedFromShuffle).toBe(true);
    });

    it('includeTrack sets exclusion to false', async () => {
      const track = createTestTrack('t1', { isExcludedFromShuffle: true });
      await ShuffleService.includeTrack(track);
      expect(track.setExcludeFromShuffle).toHaveBeenCalledWith(false);
    });
  });

  describe('updateQueueStatus and adjacent track resolution', () => {
    it('handles empty queue', async () => {
      (TrackPlayer.getQueue as jest.Mock).mockResolvedValue([]);
      (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValue(-1);

      await usePlayerStore.getState().updateQueueStatus();

      const state = usePlayerStore.getState();
      expect(state.hasPrevious).toBe(false);
      expect(state.hasNext).toBe(false);
      expect(state.prevTrack).toBeNull();
      expect(state.nextTrack).toBeNull();
    });

    it('resolves previous and next tracks in middle of queue', async () => {
      const queue = [
        { id: 'track0-inst0' },
        { id: 'track1-inst1' },
        { id: 'track2-inst2' },
      ];
      (TrackPlayer.getQueue as jest.Mock).mockResolvedValue(queue);
      (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValue(1);
      (TrackPlayer.getRepeatMode as jest.Mock).mockResolvedValue(RepeatMode.Off);

      const mockTrack0 = createTestTrack('track0');
      const mockTrack2 = createTestTrack('track2');

      (database.get as jest.Mock).mockReturnValue({
        find: jest.fn().mockImplementation((id: string) => {
          if (id === 'track0') return Promise.resolve(mockTrack0);
          if (id === 'track2') return Promise.resolve(mockTrack2);
          return Promise.resolve(null);
        }),
      });

      await usePlayerStore.getState().updateQueueStatus();

      const state = usePlayerStore.getState();
      expect(state.hasPrevious).toBe(true);
      expect(state.hasNext).toBe(true);
      expect(state.prevTrack?.id).toBe('track0');
      expect(state.nextTrack?.id).toBe('track2');
    });

    it('wraps around to last track when index is 0 and repeatMode is looping', async () => {
      const queue = [
        { id: 'track0-inst0' },
        { id: 'track1-inst1' },
      ];
      (TrackPlayer.getQueue as jest.Mock).mockResolvedValue(queue);
      (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValue(0);
      (TrackPlayer.getRepeatMode as jest.Mock).mockResolvedValue(RepeatMode.Queue);

      const mockTrack1 = createTestTrack('track1');
      (database.get as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue(mockTrack1),
      });

      await usePlayerStore.getState().updateQueueStatus();

      const state = usePlayerStore.getState();
      expect(state.hasPrevious).toBe(true);
      expect(state.hasNext).toBe(true);
      expect(state.prevTrack?.id).toBe('track1');
    });
  });

  describe('Playback State Persistence and Restoration', () => {
    it('restores playback state from storage', async () => {
      const savedState = {
        queue: [
          { id: 'saved1-123', url: 'file:///saved.mp3', title: 'Saved 1' },
        ],
        index: 0,
        playbackContext: 'context-saved',
        isShuffleEnabled: false,
        shuffleOriginalQueue: [],
        userQueueSize: 0,
        playbackSpeed: 1.0,
        playbackPitch: 1.0,
      };

      const mockTrack = createTestTrack('saved1');
      (database.get as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue(mockTrack),
      });

      const mmkvInstance = createMMKV() as any;
      mmkvInstance.getString.mockReturnValue(JSON.stringify(savedState));
      mmkvInstance.getNumber.mockReturnValue(45);

      await usePlayerStore.getState().restorePlaybackState();

      expect(TrackPlayer.reset).toHaveBeenCalled();
      expect(TrackPlayer.add).toHaveBeenCalled();
      expect(TrackPlayer.skip).toHaveBeenCalledWith(0);
      expect(TrackPlayer.pause).toHaveBeenCalled();
    });
  });

  describe('handleRelocatedTracks', () => {
    it('does nothing when no tracks in queue or active track are relocated', async () => {
      (TrackPlayer.getQueue as jest.Mock).mockResolvedValue([{ id: 'unrelated1' }]);
      usePlayerStore.setState({ activeTrack: createTestTrack('unrelatedactive') });

      await usePlayerStore.getState().handleRelocatedTracks([]);
      expect(TrackPlayer.pause).not.toHaveBeenCalled();
    });

    it('clears player when active track itself is relocated', async () => {
      const activeTrack = createTestTrack('relocactive');
      usePlayerStore.setState({ activeTrack });
      (TrackPlayer.getQueue as jest.Mock).mockResolvedValue([{ id: 'relocactive-inst' }]);

      const clearSpy = jest.spyOn(usePlayerStore.getState(), 'clearPlayer').mockResolvedValue(undefined);

      await usePlayerStore.getState().handleRelocatedTracks(['relocactive']);

      expect(TrackPlayer.pause).toHaveBeenCalled();
      expect(clearSpy).toHaveBeenCalled();
    });
  });

  describe('checkAndPauseIfTracksActiveOrQueued', () => {
    it('returns false for empty input', async () => {
      const result = await usePlayerStore.getState().checkAndPauseIfTracksActiveOrQueued([]);
      expect(result).toBe(false);
    });

    it('pauses playback when active track matches', async () => {
      usePlayerStore.setState({ activeTrack: createTestTrack('targettrack') });
      const result = await usePlayerStore.getState().checkAndPauseIfTracksActiveOrQueued(['targettrack']);
      expect(result).toBe(true);
      expect(TrackPlayer.pause).toHaveBeenCalled();
    });

    it('pauses playback when queued track matches', async () => {
      usePlayerStore.setState({ activeTrack: null });
      (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue(null);
      (TrackPlayer.getQueue as jest.Mock).mockResolvedValue([{ id: 'queuedtarget-inst' }]);

      const result = await usePlayerStore.getState().checkAndPauseIfTracksActiveOrQueued(['queuedtarget']);
      expect(result).toBe(true);
      expect(TrackPlayer.pause).toHaveBeenCalled();
    });
  });

  describe('updateTrackMetadata', () => {
    it('updates metadata in queue and recents', async () => {
      const track = createTestTrack('metatrack');
      (database.get as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue(track),
      });

      (TrackPlayer.getQueue as jest.Mock).mockResolvedValue([
        { id: 'metatrack-inst', url: 'file:///music/metatrack.mp3' },
      ]);

      usePlayerStore.setState({
        recentMedia: [
          {
            id: 'metatrack',
            type: 'track',
            title: 'Old Title',
            subtitle: 'Old Artist',
            imageUrl: null,
            timestamp: Date.now(),
          },
        ],
      });

      await usePlayerStore.getState().updateTrackMetadata('metatrack');

      expect(TrackPlayer.updateMetadataForTrack).toHaveBeenCalled();
      const updatedRecent = usePlayerStore.getState().recentMedia;
      expect(updatedRecent[0].title).toBe('Title metatrack');
    });
  });

  describe('handleRelocatedTracks when non-active tracks are relocated', () => {
    it('updates relocated queue tracks and shuffle queue without clearing player', async () => {
      const activeTrack = createTestTrack('activeStillHere');
      const mockUpdatedModel = createTestTrack('reloc1');

      usePlayerStore.setState({
        activeTrack,
        shuffleOriginalQueue: [{ id: 'reloc1-inst', url: 'old.mp3' } as any],
      });

      (TrackPlayer.getQueue as jest.Mock).mockResolvedValue([
        { id: 'reloc1-inst', url: 'old.mp3' },
      ]);

      (database.get as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue(mockUpdatedModel),
      });

      await usePlayerStore.getState().handleRelocatedTracks(['reloc1']);

      expect(TrackPlayer.remove).toHaveBeenCalled();
      expect(TrackPlayer.add).toHaveBeenCalled();
    });
  });

  describe('Speed, Pitch and Vinyl Mode', () => {
    it('applies playback speed and sets rate on TrackPlayer', async () => {
      await usePlayerStore.getState().setPlaybackSpeed(1.25);
      expect(usePlayerStore.getState().playbackSpeed).toBe(1.25);
      expect(TrackPlayer.setRate).toHaveBeenCalledWith(1.25);
    });

    it('applies playback pitch when vinyl mode is disabled', async () => {
      await usePlayerStore.getState().setVinylModeEnabled(false);
      expect(usePlayerStore.getState().isVinylModeEnabled).toBe(false);

      await usePlayerStore.getState().setPlaybackPitch(1.1);
      expect(usePlayerStore.getState().playbackPitch).toBe(1.1);
    });

    it('syncs pitch with speed when vinyl mode is re-enabled', async () => {
      await usePlayerStore.getState().setVinylModeEnabled(true);
      expect(usePlayerStore.getState().isVinylModeEnabled).toBe(true);

      await usePlayerStore.getState().setPlaybackSpeed(0.9);
      expect(usePlayerStore.getState().playbackPitch).toBe(0.9);
    });
  });

  describe('UI & Lyrics flags', () => {
    it('toggles lyrics fetching and syncing flags', () => {
      const { setIsSyncingLyrics, setIsFetchingLyrics, decrementUserQueue } = usePlayerStore.getState();

      setIsSyncingLyrics(true);
      expect(usePlayerStore.getState().isSyncingLyrics).toBe(true);
      setIsSyncingLyrics(false);
      expect(usePlayerStore.getState().isSyncingLyrics).toBe(false);

      setIsFetchingLyrics(true);
      expect(usePlayerStore.getState().isFetchingLyrics).toBe(true);
      setIsFetchingLyrics(false);
      expect(usePlayerStore.getState().isFetchingLyrics).toBe(false);

      usePlayerStore.setState({ userQueueSize: 3 });
      decrementUserQueue();
      expect(usePlayerStore.getState().userQueueSize).toBe(2);
      decrementUserQueue();
      decrementUserQueue();
      decrementUserQueue();
      expect(usePlayerStore.getState().userQueueSize).toBe(0);
    });
  });

  describe('Queue clearing helpers', () => {
    it('clearUserQueue removes manual tracks after active index', async () => {
      (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValue(0);
      (TrackPlayer.getQueue as jest.Mock).mockResolvedValue([
        { id: 'track0', isManual: false },
        { id: 'track1', isManual: true },
        { id: 'track2', isManual: false },
        { id: 'track3', isManual: true },
      ]);
      await usePlayerStore.getState().clearUserQueue();
      expect(TrackPlayer.remove).toHaveBeenCalledWith([3, 1]);
      expect(usePlayerStore.getState().userQueueSize).toBe(0);
    });

    it('clearContextQueue removes non-manual tracks after active index', async () => {
      (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValue(0);
      (TrackPlayer.getQueue as jest.Mock).mockResolvedValue([
        { id: 'track0', isManual: false },
        { id: 'track1', isManual: true },
        { id: 'track2', isManual: false },
      ]);
      await usePlayerStore.getState().clearContextQueue();
      expect(TrackPlayer.remove).toHaveBeenCalledWith([2]);
    });
  });

  describe('Shuffled queue loading and chunking', () => {
    it('startShuffled loads initial chunk and background chunks', async () => {
      const tracks = Array.from({ length: 55 }, (_, i) => createTestTrack(`shuffletr${i}`));
      await usePlayerStore.getState().startShuffled(tracks, 'library');
      expect(TrackPlayer.reset).toHaveBeenCalled();
      expect(TrackPlayer.play).toHaveBeenCalled();
      expect(usePlayerStore.getState().isShuffleEnabled).toBe(true);
    });

    it('startShuffled with random_queue_end appends to existing queue', async () => {
      (TrackPlayer.getQueue as jest.Mock).mockResolvedValue([{ id: 'existing1' }]);
      const tracks = [createTestTrack('rnd1'), createTestTrack('rnd2')];
      await usePlayerStore.getState().startShuffled(tracks, 'random_queue_end');
      expect(TrackPlayer.skip).toHaveBeenCalledWith(1);
      expect(TrackPlayer.play).toHaveBeenCalled();
    });

    it('loadQueue with offset loads previous and next chunks', async () => {
      const tracks = Array.from({ length: 55 }, (_, i) => createTestTrack(`qtr${i}`));
      await usePlayerStore.getState().loadQueue(tracks, 2, 'album');
      expect(TrackPlayer.play).toHaveBeenCalled();
      expect(usePlayerStore.getState().activeTrack?.id).toBe('qtr2');
    });
  });

  describe('syncWithTrackPlayer and setActiveTrackById', () => {
    it('syncWithTrackPlayer updates active track when track changes in TrackPlayer', async () => {
      const track = createTestTrack('syncedtrack');
      (TrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: 'syncedtrack-inst1' });
      (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValue(0);
      (TrackPlayer.getQueue as jest.Mock).mockResolvedValue([{ id: 'syncedtrack-inst1' }]);
      (database.get as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue(track),
      });

      await usePlayerStore.getState().syncWithTrackPlayer();
      expect(usePlayerStore.getState().activeTrack?.id).toBe('syncedtrack');
    });

    it('setActiveTrackById handles external and regular tracks', async () => {
      const track = createTestTrack('regtrack');
      (database.get as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue(track),
      });

      await usePlayerStore.getState().setActiveTrackById('regtrack', 'inst123');
      expect(usePlayerStore.getState().activeTrack?.id).toBe('regtrack');
      expect(usePlayerStore.getState().activeTrackInstanceId).toBe('inst123');

      // external track
      usePlayerStore.setState({ activeTrack: { id: 'ext_song', isExternal: true } as any });
      await usePlayerStore.getState().setActiveTrackById('ext_song', 'newinst');
      expect(usePlayerStore.getState().activeTrackInstanceId).toBe('newinst');
    });
  });

  describe('Recents refresh and metadata update for Album/Artist', () => {
    it('updateTrackMetadata updates album in recentMedia', async () => {
      const track = createTestTrack('albtrack', {
        album: { fetch: jest.fn().mockResolvedValue({ id: 'alb123', title: 'New Album Title', coverUrl: 'new_cover.jpg' }) }
      });
      (database.get as jest.Mock).mockReturnValue({
        find: jest.fn().mockResolvedValue(track),
      });
      (TrackPlayer.getQueue as jest.Mock).mockResolvedValue([]);

      usePlayerStore.setState({
        recentMedia: [
          { id: 'alb123', type: 'album', title: 'Old Alb', subtitle: '', imageUrl: null, timestamp: Date.now() },
        ],
      });

      await usePlayerStore.getState().updateTrackMetadata('albtrack');
      const recents = usePlayerStore.getState().recentMedia;
      expect(recents[0].title).toBe('New Album Title');
      expect(recents[0].imageUrl).toBe('new_cover.jpg');
    });

    it('refreshRecentsFromDatabase updates tracks, albums and artists', async () => {
      const mockTrack = createTestTrack('rtrack', {
        title: 'Fresh Track Title',
        album: { fetch: jest.fn().mockResolvedValue({ coverUrl: 'fresh_cover.jpg' }) },
        queryCollaborators: { fetch: jest.fn().mockResolvedValue([{ name: 'Artist Duo' }]) },
      });
      const mockAlbum = { id: 'ralbum', title: 'Fresh Album Title', coverUrl: 'fresh_alb.jpg', artist: { fetch: jest.fn().mockResolvedValue({ name: 'Alb Artist' }) } };
      const mockArtist = { id: 'rartist', name: 'Fresh Artist Name', imageUrl: 'fresh_artist.jpg' };

      (database.collections.get as jest.Mock).mockImplementation((col: string) => {
        if (col === 'tracks') return { find: jest.fn().mockResolvedValue(mockTrack) };
        if (col === 'albums') return { find: jest.fn().mockResolvedValue(mockAlbum) };
        if (col === 'artists') return { find: jest.fn().mockResolvedValue(mockArtist) };
        return { find: jest.fn().mockResolvedValue(null) };
      });

      usePlayerStore.setState({
        recentMedia: [
          { id: 'rtrack', type: 'track', title: 'Old T', subtitle: '', imageUrl: null, timestamp: 1 },
          { id: 'ralbum', type: 'album', title: 'Old A', subtitle: '', imageUrl: null, timestamp: 2 },
          { id: 'rartist', type: 'artist', title: 'Old Art', subtitle: '', imageUrl: null, timestamp: 3 },
        ],
      });

      await usePlayerStore.getState().refreshRecentsFromDatabase();
      const updated = usePlayerStore.getState().recentMedia;
      expect(updated[0].title).toBe('Fresh Track Title');
      expect(updated[1].title).toBe('Fresh Album Title');
      expect(updated[2].title).toBe('Fresh Artist Name');
    });
  });
});
