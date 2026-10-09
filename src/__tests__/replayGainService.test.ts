import { initializeReplayGain } from '../services/ReplayGainService';
import { setReplayGainSettings } from '../../modules/native-equalizer';
import { useSettingsStore } from '../store/useSettingsStore';
import { Platform } from 'react-native';
import { ScannerService } from '../services/ScannerService';
import { database } from '../database';
import { PermissionService } from '../services/PermissionService';
import { usePlayerStore } from '../store/usePlayerStore';
import { useSyncStore } from '../store/useSyncStore';
import { ArtistImageService } from '../services/ArtistImageService';
import { MediaAssetService } from '../services/MediaAssetService';
import * as NativeAudioScanner from '../../modules/native-audio-scanner';

jest.mock('../../modules/native-equalizer', () => ({
  setReplayGainSettings: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../modules/native-audio-scanner', () => ({
  getReplayGainMetadata: jest.fn(),
  getAudioFiles: jest.fn(),
  findAndScanUnindexedAudioFiles: jest.fn(),
  readMetadata: jest.fn(),
}));

describe('ReplayGain Service & Processing Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'android';
    useSettingsStore.setState({
      isNormalizationEnabled: false,
      preampLevel: 0,
      fallbackGainDB: -6,
    });
  });

  describe('1. ReplayGain Initialization and Settings Sync', () => {
    it('initializes ReplayGain and applies settings to native layer on Android', async () => {
      await initializeReplayGain();
      expect(setReplayGainSettings).toHaveBeenCalledWith(false, 0, -6);
    });

    it('does nothing on non-Android platforms', async () => {
      (Platform as any).OS = 'ios';
      (setReplayGainSettings as jest.Mock).mockClear();
      await initializeReplayGain();
      expect(setReplayGainSettings).not.toHaveBeenCalled();
    });

    it('updates native settings when normalization toggle changes', async () => {
      await initializeReplayGain();
      (setReplayGainSettings as jest.Mock).mockClear();

      useSettingsStore.getState().setNormalizationEnabled(true);
      // Wait for promise resolution
      await Promise.resolve();

      expect(setReplayGainSettings).toHaveBeenCalledWith(true, 0, -6);
    });

    it('updates native settings when preampLevel slider changes', async () => {
      await initializeReplayGain();
      (setReplayGainSettings as jest.Mock).mockClear();

      useSettingsStore.getState().setPreampLevel(3.5);
      await Promise.resolve();

      expect(setReplayGainSettings).toHaveBeenCalledWith(false, 3.5, -6);
    });

    it('updates native settings when fallbackGainDB changes', async () => {
      await initializeReplayGain();
      (setReplayGainSettings as jest.Mock).mockClear();

      useSettingsStore.getState().setFallbackGain(-9);
      await Promise.resolve();

      expect(setReplayGainSettings).toHaveBeenCalledWith(false, 0, -9);
    });
  });

  describe('2. ScannerService ReplayGain Deep Scan', () => {
    it('returns 0 when no tracks are missing ReplayGain', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
      };
      (database.collections.get as jest.Mock).mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      });

      const count = await ScannerService.runDeepReplayGainScan();
      expect(count).toBe(0);
    });

    it('scans and batches updates for tracks with gain and peak', async () => {
      const mockTrack = {
        fileUrl: 'file:///music/song.flac',
        replayGain: null,
        replayPeak: null,
        prepareUpdate: jest.fn().mockImplementation((updater) => {
          updater(mockTrack);
          return mockTrack;
        }),
      };

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockTrack]),
      };
      (database.collections.get as jest.Mock).mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      });

      (NativeAudioScanner.getReplayGainMetadata as jest.Mock).mockResolvedValue({
        gain: -4.5,
        peak: 0.89,
      });

      const count = await ScannerService.runDeepReplayGainScan();
      expect(count).toBe(1);
      expect(mockTrack.prepareUpdate).toHaveBeenCalled();
      expect(mockTrack.replayGain).toBe(-4.5);
      expect(mockTrack.replayPeak).toBe(0.89);
    });

    it('handles track scan error without failing the whole batch', async () => {
      const mockTrack = {
        fileUrl: 'file:///music/corrupt.mp3',
        replayGain: null,
        replayPeak: null,
        prepareUpdate: jest.fn(),
      };

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockTrack]),
      };
      (database.collections.get as jest.Mock).mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      });

      (NativeAudioScanner.getReplayGainMetadata as jest.Mock).mockRejectedValue(new Error('Corrupt tag'));

      const count = await ScannerService.runDeepReplayGainScan();
      expect(count).toBe(0);
      expect(mockTrack.prepareUpdate).not.toHaveBeenCalled();
    });
  });
});


describe('ReplayGain in ordinary library scans', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSyncStore.setState({ isScanning: false });
    useSettingsStore.setState({ excludedFolders: [], excludedSongs: [] });
    jest.spyOn(PermissionService, 'requestAudioPermission').mockResolvedValue('granted');
    jest.spyOn(usePlayerStore.getState(), 'refreshRecentsFromDatabase').mockResolvedValue(undefined);
    jest.spyOn(usePlayerStore.getState(), 'updateTrackMetadata').mockResolvedValue(undefined);
    jest.spyOn(ArtistImageService, 'processMissingArtistImages').mockResolvedValue(undefined);
    jest.spyOn(MediaAssetService, 'migrateLegacyCacheAssets').mockImplementation(() => {});
    jest.spyOn(MediaAssetService, 'runGarbageCollector').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it.each([
    { previousGain: -4, previousPeak: null, gain: -4, peak: 0.9 },
    { previousGain: -8, previousPeak: 0.8, gain: null, peak: null },
    { previousGain: null, previousPeak: null, gain: 3, peak: 0.4 },
  ])('backfills or clears tags on an unchanged M4A file: %j', async data => {
    const track: any = {
      id: 'm4a', fileUrl: 'file:///music/song.m4a', lastModified: 123, genre: null,
      replayGain: data.previousGain, replayPeak: data.previousPeak,
    };
    track.prepareUpdate = jest.fn(update => { update(track); return track; });
    const query = (records: any[]) => ({ fetch: jest.fn().mockResolvedValue(records) });
    (database.collections.get as jest.Mock).mockImplementation(name => ({
      query: jest.fn(() => query(name === 'tracks' ? [track] : [])),
    }));
    (NativeAudioScanner.getAudioFiles as jest.Mock).mockResolvedValue([{
      uri: track.fileUrl, lastModified: 123, replayGain: data.gain, replayPeak: data.peak,
    }]);
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    await ScannerService.syncLibrary(undefined, true);
    expect(errors).not.toHaveBeenCalled();
    expect(NativeAudioScanner.getAudioFiles).toHaveBeenCalledWith(true);
    expect(track.replayGain).toBe(data.gain);
    expect(track.replayPeak).toBe(data.peak);
    expect(track.prepareUpdate).toHaveBeenCalledTimes(1);
    expect(usePlayerStore.getState().updateTrackMetadata).toHaveBeenCalledWith('m4a');
  });
});
