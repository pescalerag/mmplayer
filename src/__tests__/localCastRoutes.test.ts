import TrackPlayer from 'react-native-track-player';
import { BridgeServer } from 'react-native-http-bridge-refurbished';
import { LocalCastService } from '../services/LocalCastService';
import { LocalCastPlaybackService } from '../services/LocalCastPlaybackService';
import { useCastStore } from '../store/useCastStore';
import { database } from '../database';
import { usePlayerStore } from '../store/usePlayerStore';
import { LocalCastQueueService } from '../services/LocalCastQueueService';
import { setQueueSnapshot } from '../store/useQueueSnapshotStore';
import * as FileSystem from 'expo-file-system/legacy';
import { useSettingsStore } from '../store/useSettingsStore';
import i18n from '../constants/i18n';

jest.unmock('../services/LocalCastService');
jest.mock('../services/PlaybackService', () => ({ PlaybackTimeTracker: { addReportedSeconds: jest.fn(), onStateNotPlaying: jest.fn(), getAccumulatedSeconds: jest.fn(() => 100), clearAccumulated: jest.fn() } }));
jest.mock('../services/PlaybackListenService', () => ({ PlaybackListenService: { save: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../services/LocalCastQueueService', () => ({ LocalCastQueueService: { read: jest.fn(async () => ({ queueVersion: 'version', hasNext: true, shuffleOnQueueEnd: false })), advance: jest.fn(async () => true), validate: jest.fn(async () => false),
  cover: jest.fn((...args: unknown[]) => jest.requireActual('../services/LocalCastQueueService').LocalCastQueueService.cover(...args)),
} }));
jest.mock('../store/usePlayerStore', () => {
  const state = { isQueueLoading: false, activeTrack: { id: 'song', duration: 180, fileUrl: 'file:///song.mp3' } };
  return { usePlayerStore: { getState: () => state } };
});
jest.mock('react-native-http-bridge-refurbished', () => ({ BridgeServer: jest.fn(() => ({ use: jest.fn(), listen: jest.fn(), stop: jest.fn() })) }));

describe('LocalCast HTTP integration', () => {
  let handler: (req: object, res: object) => Promise<void>;
  beforeEach(async () => {
    jest.useFakeTimers(); jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValue(0);
    (TrackPlayer.getTrack as jest.Mock).mockResolvedValue({ id: 'song-instance', title: 'Song', artist: 'Artist', url: 'file:///song.mp3' });
    (TrackPlayer.getQueue as jest.Mock).mockResolvedValue([]);
    (TrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 0, duration: 180 });
    (database.get as jest.Mock).mockReturnValue({ find: jest.fn().mockResolvedValue({ lyricsLRC: '', album: { fetch: jest.fn().mockResolvedValue(null) } }) });
    const setCastPlayback = jest.fn((position: number, _playing: boolean | undefined, duration: number) => {
      useCastStore.setState({ castPosition: position, castDuration: duration });
    });
    useCastStore.setState({ isLocalCastActive: true, castPosition: 34, isCastPlaying: true, setCastPlayback, setCastPlaying: jest.fn() } as any);
    Object.assign(usePlayerStore.getState(), { isQueueLoading: false, activeTrack: { id: 'song', duration: 180, fileUrl: 'file:///song.mp3' } });
    await LocalCastService.start(8080);
    const instance = (BridgeServer as unknown as jest.Mock).mock.results.at(-1)!.value;
    handler = instance.use.mock.calls[0][0];
    LocalCastPlaybackService.begin(LocalCastService.createSessionId(), 'song-instance', 34, true);
  });
  afterEach(async () => { await LocalCastService.stop(); jest.clearAllTimers(); jest.restoreAllMocks(); jest.useRealTimers(); });
  async function request(url: string, type = 'GET') {
    const res = { json: jest.fn(), html: jest.fn(), send: jest.fn() };
    await handler({ url, type }, res);
    return res;
  }
  it('prepares the active album cover and sends its cached filename', async () => {
    (database.get as jest.Mock).mockReturnValue({ find: jest.fn().mockResolvedValue({ lyricsLRC: '[00:01]Song', album: { fetch: async () => ({ coverUrl: 'file:///cover.jpg' }) } }) });
    expect((await request('/api/state')).json).toHaveBeenCalledWith(expect.objectContaining({ coverFileName: 'cast_cover_song.jpg', lyricsLRC: '[00:01]Song' }), 200);
  });
  it('responds after the audio preparation timeout without inventing media metadata', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockImplementationOnce(() => new Promise(() => {}));
    const response = request('/api/state');
    await jest.advanceTimersByTimeAsync(5000);
    expect((await response).json).toHaveBeenCalledWith(expect.objectContaining({ mediaFileName: null, fileSize: 0, mimeType: 'audio/mpeg' }), 200);
  });
  it('serves tracks without audio URLs and state without an active cast session', async () => {
    (TrackPlayer.getTrack as jest.Mock).mockResolvedValueOnce({ id: 'noaudio-instance' });
    LocalCastPlaybackService.clear();
    expect((await request('/api/state')).json).toHaveBeenCalledWith(expect.objectContaining({ mediaFileName: null, fileSize: 0, position: 0, playbackToken: undefined, handoff: false }), 200);
  });
  it('keeps the native track when queue replacement has no matching entry or lookup fails', async () => {
    usePlayerStore.getState().isQueueLoading = true;
    (TrackPlayer.getTrack as jest.Mock).mockResolvedValue({ id: 'other-instance', url: 'file:///other.mp3' });
    expect((await request('/api/state')).json).toHaveBeenCalledWith(expect.objectContaining({ mediaFileName: 'cast_track_other.mp3' }), 200);
    (TrackPlayer.getQueue as jest.Mock).mockRejectedValueOnce(new Error('Queue unavailable'));
    expect((await request('/api/state')).json).toHaveBeenCalledWith(expect.objectContaining({ mediaFileName: 'cast_track_other.mp3' }), 200);
  });
  it('keeps the current native track when it already matches the expected loading item', async () => {
    usePlayerStore.getState().isQueueLoading = true;
    const response = await request('/api/state');
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ title: 'Song', mediaFileName: 'cast_track_song.mp3' }), 200);
  });
  it('exposes the play intent and clears it when the receiver requests playback', async () => {
    LocalCastService.setPlayIntent(true);
    expect(LocalCastService.getPlayIntent()).toBe(true);
    expect((await request('/api/state')).json).toHaveBeenCalledWith(expect.objectContaining({ playIntent: true }), 200);
    await request('/api/play', 'POST');
    expect(LocalCastService.getPlayIntent()).toBe(false);
    expect(TrackPlayer.play).toHaveBeenCalled();
  });
  it('suppresses seek echoes until the receiver seek grace period expires', async () => {
    const url = '/api/state?sessionId=' + LocalCastService.getSessionId();
    LocalCastService.emitSeek(9);
    await request('/api/seek?position=23', 'POST');
    LocalCastService.emitSeek(50);
    expect((await request(url)).json.mock.calls[0][0].command).toMatchObject({ type: 'SEEK', position: 9 });
    await jest.advanceTimersByTimeAsync(600);
    LocalCastService.emitSeek(50);
    expect((await request(url)).json.mock.calls[0][0].command).toMatchObject({ type: 'SEEK', position: 50 });
  });
  it('resolves a missing native identity while the expected queue item is loading', async () => {
    usePlayerStore.getState().isQueueLoading = true;
    (TrackPlayer.getTrack as jest.Mock).mockResolvedValue({});
    (TrackPlayer.getQueue as jest.Mock).mockResolvedValue([{ id: 'song-instance', url: 'file:///song.mp3' }]);
    expect((await request('/api/state')).json).toHaveBeenCalledWith(expect.objectContaining({ mediaFileName: 'cast_track_song.mp3' }), 200);
  });
  it('returns the Chromecast device while LocalCast is inactive', async () => {
    useCastStore.setState({ isLocalCastActive: false, isChromecastConnected: true, connectedDeviceName: 'Living room' });
    expect((await request('/api/state')).json).toHaveBeenCalledWith(expect.objectContaining({ title: 'Transmitiendo en Chromecast', artist: 'Living room', isStopped: true }), 200);
    useCastStore.setState({ isChromecastConnected: false, connectedDeviceName: null });
  });
  it('sends commands only to the matching session until their ID is acknowledged', async () => {
    const session = LocalCastService.getSessionId();
    LocalCastService.emitPlay();
    const first = await request('/api/state?sessionId=' + session);
    const command = first.json.mock.calls[0][0].command;
    expect(command).toMatchObject({ type: 'PLAY' });
    expect((await request('/api/state?sessionId=stale')).json.mock.calls[0][0].command).toBeNull();
    expect((await request('/api/state?sessionId=' + session + '&lastCmdId=' + command.id)).json.mock.calls[0][0].command).toBeNull();
  });
  it.each(['dark', undefined])('serves the VIP theme with the language fallback: %s', async theme => {
    const language = i18n.language;
    const settings = useSettingsStore.getState();
    try {
      i18n.language = '';
      useSettingsStore.setState({ userTier: 'VIP', localCastTheme: theme } as any);
      const response = await request('/');
      expect(response.html).toHaveBeenCalledWith(expect.stringContaining('lang="en"'), 200);
    } finally {
      i18n.language = language;
      useSettingsStore.setState({ userTier: settings.userTier, localCastTheme: settings.localCastTheme });
    }
  });
  it('synchronizes a theme selected after opening the receiver without retransmitting unchanged CSS', async () => {
    const { userTier, localCastTheme } = useSettingsStore.getState();
    try {
      useSettingsStore.setState({ userTier: 'VIP', localCastTheme: 'gold' });
      expect((await request('/')).html).toHaveBeenCalledWith(expect.stringContaining('--play-btn-hover-border: #FBBF24'), 200);
      expect((await request('/api/state?theme=default')).json).toHaveBeenCalledWith(expect.objectContaining({
        theme: 'gold', themeCss: expect.stringContaining('--play-btn-hover-border: #FBBF24'),
      }), 200);
      const unchanged = (await request('/api/state?theme=gold')).json.mock.calls[0][0];
      expect(unchanged.theme).toBe('gold');
      expect(unchanged).not.toHaveProperty('themeCss');
      useSettingsStore.setState({ localCastTheme: 'aurora' });
      expect((await request('/api/state?theme=gold')).json).toHaveBeenCalledWith(expect.objectContaining({
        theme: 'aurora', themeCss: expect.stringContaining('--play-btn-hover-border: #34D399'),
      }), 200);
      useSettingsStore.setState({ userTier: 'USER' });
      expect((await request('/api/state?theme=aurora')).json).toHaveBeenCalledWith(expect.objectContaining({
        theme: 'default', themeCss: expect.stringContaining('--play-btn-hover-border: #A78BFA'),
      }), 200);
    } finally {
      useSettingsStore.setState({ userTier, localCastTheme });
    }
  });

  it('updates the theme even while the receiver is idle', async () => {
    const { userTier, localCastTheme } = useSettingsStore.getState();
    try {
      useSettingsStore.setState({ userTier: 'VIP', localCastTheme: 'crimson' });
      useCastStore.setState({ isLocalCastActive: false });
      expect((await request('/api/state?theme=default')).json).toHaveBeenCalledWith(expect.objectContaining({
        isStopped: true, theme: 'crimson', themeCss: expect.any(String),
      }), 200);
    } finally {
      useSettingsStore.setState({ userTier, localCastTheme });
    }
  });

  it('defaults an omitted seek position to zero and reports handler failures', async () => {
    await request('/api/seek', 'POST');
    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(0);
    (TrackPlayer.play as jest.Mock).mockRejectedValueOnce(undefined);
    expect((await request('/api/play', 'POST')).json).toHaveBeenCalledWith({ error: 'Server error' }, 500);
    const response = { json: jest.fn(), html: jest.fn(), send: jest.fn() };
    await handler({ url: '/api/cover', type: '' }, response);
    expect(response.json).toHaveBeenCalledWith({ cover: null }, 200);
  });
  it('restarts an existing bridge server before listening again', async () => {
    const first = (BridgeServer as unknown as jest.Mock).mock.results.at(-1)!.value;
    first.stop.mockRejectedValueOnce(new Error('Already stopped'));
    await LocalCastService.start(8081);
    expect(first.stop).toHaveBeenCalledTimes(1);
    const next = (BridgeServer as unknown as jest.Mock).mock.results.at(-1)!.value;
    expect(next.listen).toHaveBeenCalledWith(8081);
  });
  it('sends the initial second and token, keeps them through loading, and accepts browser reports', async () => {
    const first = await request('/api/state');
    expect(first.json.mock.calls[0][0].sessionId).toBe(LocalCastService.getSessionId());
    expect(first.json).toHaveBeenCalledWith(expect.objectContaining({ position: 34, playbackToken: LocalCastPlaybackService.getState()?.token, mediaFileName: 'cast_track_song.mp3' }), 200);
    const state = LocalCastPlaybackService.getState()!;
    const report = { sessionId: state.id, token: state.token, position: 87, duration: 180, listened: 30, playing: true, sequence: 1 };
    const response = await request('/api/state?report=' + encodeURIComponent(JSON.stringify(report)));
    expect(useCastStore.getState().setCastPlayback).toHaveBeenCalledWith(87, undefined, 180);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ position: 87, playbackToken: state.token }), 200);
    expect(useCastStore.getState().castPosition).toBe(87);
  });
  it('requests a final stop report before marking the receiver stopped', async () => {
    const state = LocalCastPlaybackService.getState()!;
    const stop = LocalCastPlaybackService.requestStop();
    const response = await request('/api/state');
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ handoff: true }), 200);
    const report = { sessionId: state.id, token: state.token, position: 87, duration: 180, listened: 30, playing: false, sequence: 1 };
    await request('/api/report?stopped=true&report=' + encodeURIComponent(JSON.stringify(report)), 'POST');
    await expect(stop).resolves.toMatchObject({ position: 87 });
    useCastStore.setState({ isLocalCastActive: false } as any);
    const stopped = await request('/api/state');
    expect(stopped.json).toHaveBeenCalledWith(expect.objectContaining({ isStopped: true }), 200);
  });
  it('preserves client HTML and manual queue controls', async () => {
    expect((await request('/')).html).toHaveBeenCalled();
    expect((await request('/missing')).json).toHaveBeenCalledWith({ error: 'Not found' }, 404);
    await request('/api/next', 'POST');
    await request('/api/previous', 'POST');
    expect(LocalCastQueueService.advance).toHaveBeenCalled();
    expect(TrackPlayer.skipToPrevious).toHaveBeenCalled();
    await request('/api/play', 'POST');
    await request('/api/pause', 'POST');
    await request('/api/seek?position=87', 'POST');
    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(87);
    expect((await request('/api/cover')).json).toHaveBeenCalledWith({ cover: null }, 200);
    expect((await request('/favicon.ico')).send).toHaveBeenCalledWith(204, 'image/x-icon', '');
    expect((await request('/cast')).html).toHaveBeenCalled();
    expect((await request('/chromecast')).html).toHaveBeenCalled();
    const bad = await request('http://[');
    expect(bad.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }), 500);
  });
  it('preserves the initial seek through a temporary native-player lookup failure', async () => {
    (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValue(undefined);
    const response = await request('/api/state');
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ position: 34, playbackToken: LocalCastPlaybackService.getState()?.token }), 200);
  });
  it('rejects stale queue selections and plays an approved selection', async () => {
    const state = LocalCastPlaybackService.getState()!;
    const url = '/api/queue/select?index=1&id=song-instance&version=v1&report=' + encodeURIComponent(JSON.stringify({ sessionId: state.id, token: state.token, position: 100, duration: 180, listened: 60, playing: true, sequence: 1 }));
    expect((await request(url, 'POST')).json).toHaveBeenCalledWith({ success: false }, 409);
    (LocalCastQueueService.validate as jest.Mock).mockResolvedValueOnce(true);
    expect((await request(url, 'POST')).json).toHaveBeenCalledWith({ success: true }, 200);
    expect(TrackPlayer.skip).toHaveBeenCalledWith(1);
  });
  it('sends stored ReplayGain and peak before playback and updates settings without reloading metadata', async () => {
    const find = jest.fn().mockResolvedValue({ replayGain: -6, replayPeak: 0.8, lyricsLRC: '', album: { fetch: jest.fn().mockResolvedValue(null) } });
    (database.get as jest.Mock).mockReturnValue({ find });
    useSettingsStore.setState({ isNormalizationEnabled: true, preampLevel: 3, fallbackGainDB: -5 });
    expect((await request('/api/state')).json).toHaveBeenCalledWith(expect.objectContaining({
      replayGain: { enabled: true, gainDb: -6, peak: 0.8, preampDb: 3, fallbackDb: -5 },
    }), 200);
    useSettingsStore.setState({ isNormalizationEnabled: false, preampLevel: 0 });
    expect((await request('/api/state')).json).toHaveBeenCalledWith(expect.objectContaining({
      replayGain: { enabled: false, gainDb: -6, peak: 0.8, preampDb: 0, fallbackDb: -5 },
    }), 200);
    expect(find).toHaveBeenCalledTimes(1);
  });
  it('uses queue ReplayGain when DB metadata is absent and leaves missing gain and peak unknown', async () => {
    (TrackPlayer.getTrack as jest.Mock).mockResolvedValue({ id: 'native-instance', url: 'file:///native.mp3', replayGain: -4, replayPeak: 0.7 });
    expect((await request('/api/state')).json).toHaveBeenCalledWith(expect.objectContaining({ replayGain: expect.objectContaining({ gainDb: -4, peak: 0.7 }) }), 200);
    (TrackPlayer.getTrack as jest.Mock).mockResolvedValue({ id: 'unknown-instance', url: 'file:///unknown.mp3' });
    expect((await request('/api/state')).json).toHaveBeenCalledWith(expect.objectContaining({ replayGain: expect.objectContaining({ gainDb: null, peak: null }) }), 200);
  });
  it('keeps gain and peak if fetching album metadata fails and tolerates unidentified tracks', async () => {
    (database.get as jest.Mock).mockReturnValue({ find: jest.fn().mockResolvedValue({ replayGain: -2, replayPeak: 0.9, lyricsLRC: '', album: { fetch: jest.fn().mockRejectedValue(new Error('album unavailable')) } }) });
    (TrackPlayer.getTrack as jest.Mock).mockResolvedValue({ id: 'albumfailure-instance', url: 'file:///albumfailure.mp3' });
    expect((await request('/api/state')).json).toHaveBeenCalledWith(expect.objectContaining({ replayGain: expect.objectContaining({ gainDb: -2, peak: 0.9 }) }), 200);
    (TrackPlayer.getTrack as jest.Mock).mockResolvedValue({ id: '', url: 'file:///unidentified.mp3' });
    expect((await request('/api/state')).json).toHaveBeenCalledWith(expect.objectContaining({ replayGain: expect.objectContaining({ gainDb: null, peak: null }) }), 200);
  });
  it('copies Android content artwork to the shared static cache on demand and reuses it', async () => {
    setQueueSnapshot([{ id: 'queuecover-instance', url: 'song', artwork: 'content://media/external/audio/albumart/23?t=123' }], 0);
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({ exists: false });
    const response = await request('/api/queue/cover?index=0&id=queuecover-instance');
    expect(response.json).toHaveBeenCalledWith({ coverUrl: '/static/cast_cover_queuecover.jpg' }, 200);
    expect(FileSystem.copyAsync).toHaveBeenCalledWith({ from: 'content://media/external/audio/albumart/23', to: FileSystem.cacheDirectory + 'cast_cover_queuecover.jpg' });
    (FileSystem.copyAsync as jest.Mock).mockClear();
    expect((await request('/api/queue/cover?index=0&id=queuecover-instance')).json).toHaveBeenCalledWith({ coverUrl: '/static/cast_cover_queuecover.jpg' }, 200);
    expect(FileSystem.copyAsync).not.toHaveBeenCalled();
    expect((await request('/api/queue/cover')).json).toHaveBeenCalledWith({ coverUrl: null }, 200);
    expect((await request('/api/queue/cover?index=0&id=replaced')).json).toHaveBeenCalledWith({ coverUrl: null }, 200);
  });
  it('waits through empty queue transitions and keeps the previous metadata when available', async () => {
    (usePlayerStore.getState() as any).activeTrack = null;
    (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValue(undefined);
    expect((await request('/api/state')).json).toHaveBeenCalledWith(expect.objectContaining({ activeTrack: null }), 200);
    (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValue(0);
    await request('/api/state');
    (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValue(undefined);
    expect((await request('/api/state')).json).toHaveBeenCalledWith(expect.objectContaining({ title: 'Song', isTransitioning: true }), 200);
  });
  it('resolves the expected queue item during queue replacement and still serves missing metadata', async () => {
    usePlayerStore.getState().isQueueLoading = true;
    (TrackPlayer.getTrack as jest.Mock).mockResolvedValue({ id: 'old-instance', url: 'file:///old.mp3' });
    (TrackPlayer.getQueue as jest.Mock).mockResolvedValue([{ id: 'song-instance', title: 'Song', url: 'file:///song.mp3' }]);
    (database.get as jest.Mock).mockReturnValue({ find: jest.fn().mockRejectedValue(new Error('metadata missing')) });
    const response = await request('/api/state');
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ title: 'Song', mediaFileName: 'cast_track_song.mp3' }), 200);
  });
});
