import TrackPlayer from 'react-native-track-player';
import { handleCastReportRoute, LocalCastPlaybackService } from '../services/LocalCastPlaybackService';
import { useCastStore } from '../store/useCastStore';
import { PlaybackTimeTracker } from '../services/PlaybackService';
import { PlaybackListenService } from '../services/PlaybackListenService';
import { LocalCastQueueService } from '../services/LocalCastQueueService';

jest.mock('../services/PlaybackService', () => ({ PlaybackTimeTracker: { addReportedSeconds: jest.fn(), onStateNotPlaying: jest.fn(), getAccumulatedSeconds: jest.fn(() => 100), clearAccumulated: jest.fn() } }));
jest.mock('../services/PlaybackListenService', () => ({ PlaybackListenService: { save: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../services/LocalCastQueueService', () => ({ LocalCastQueueService: { advance: jest.fn(), validate: jest.fn() } }));

describe('LocalCast receiver reports', () => {
  const params = (overrides: object = {}) => new URLSearchParams({ report: JSON.stringify({ sessionId: 'session', token: 'session:0', position: 87, duration: 180, listened: 30, playing: true, sequence: 1, ...overrides }), token: 'session:0' });
  beforeEach(() => {
    jest.clearAllMocks(); LocalCastPlaybackService.clear();
    (LocalCastQueueService.advance as jest.Mock).mockResolvedValue(true);
    (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValue(0);
    (TrackPlayer.getTrack as jest.Mock).mockResolvedValue({ id: 'track' });
    Object.assign(useCastStore.getState(), { setCastPlayback: jest.fn(), setCastPlaying: jest.fn() });
  });
  afterEach(() => LocalCastPlaybackService.clear());
  it('saves the reported listen on disconnect while keeping it available for mobile continuation', async () => {
    await LocalCastPlaybackService.saveListen();
    expect(PlaybackListenService.save).not.toHaveBeenCalled();
    LocalCastPlaybackService.begin('session', 'native-track', 34, true);
    await LocalCastPlaybackService.saveListen();
    expect(PlaybackListenService.save).toHaveBeenCalledWith('native-track', 100, false);
    expect(PlaybackTimeTracker.clearAccumulated).not.toHaveBeenCalled();
    await LocalCastPlaybackService.saveListen(true);
    expect(PlaybackListenService.save).toHaveBeenLastCalledWith('native-track', 100, true);
    expect(PlaybackTimeTracker.clearAccumulated).toHaveBeenCalledWith('native-track');
  });
  it('ignores missing and malformed reports, and adds only newly reported listening time', () => {
    expect(LocalCastPlaybackService.receive(params())).toBe(false);
    LocalCastPlaybackService.begin('session', 'native-track', 34, true);
    expect(LocalCastPlaybackService.receive(new URLSearchParams())).toBe(false);
    expect(LocalCastPlaybackService.receive(new URLSearchParams({ report: '{' }))).toBe(false);
    expect(LocalCastPlaybackService.receive(params({ token: 'old' }))).toBe(false);
    expect(LocalCastPlaybackService.receive(params())).toBe(true);
    expect(LocalCastPlaybackService.receive(params())).toBe(false);
    expect(PlaybackTimeTracker.addReportedSeconds).toHaveBeenCalledWith('native-track', 30);
    expect(useCastStore.getState().setCastPlayback).toHaveBeenCalledWith(87, undefined, 180);
    expect(LocalCastPlaybackService.receive(params({ sequence: 2, listened: 35 }))).toBe(true);
    expect(PlaybackTimeTracker.addReportedSeconds).toHaveBeenLastCalledWith('native-track', 5);
    LocalCastPlaybackService.selectTrack('next');
    expect(LocalCastPlaybackService.getState()?.state.position).toBe(0);
  });
  it('waits for the final report and cancels pending transfers when the session is replaced', async () => {
    expect(await LocalCastPlaybackService.requestStop()).toBeNull();
    expect(LocalCastPlaybackService.finish('old')).toBe(false);
    LocalCastPlaybackService.begin('session', 'track', 34, true);
    const stop = LocalCastPlaybackService.requestStop();
    const final = params(); final.set('stopped', 'true');
    expect(LocalCastPlaybackService.receive(final)).toBe(true);
    await expect(stop).resolves.toMatchObject({ position: 87 });
    LocalCastPlaybackService.begin('second', 'track', 0, false);
    const pending = LocalCastPlaybackService.requestStop();
    LocalCastPlaybackService.begin('third', 'track', 0, true);
    await expect(pending).resolves.toBeNull();
  });
  it('handles only report routes and advances once for a valid end event', async () => {
    const respond = jest.fn();
    expect(await handleCastReportRoute('GET', '/api/report', params(), respond)).toBe(false);
    expect(await handleCastReportRoute('POST', '/other', params(), respond)).toBe(false);
    LocalCastPlaybackService.begin('session', 'track', 0, true);
    await handleCastReportRoute('POST', '/api/report', params(), respond);
    expect(TrackPlayer.skipToNext).not.toHaveBeenCalled();
    const missingToken = params({ sequence: 2 }); missingToken.delete('token');
    await handleCastReportRoute('POST', '/api/ended', missingToken, respond);
    await handleCastReportRoute('POST', '/api/ended', params({ sequence: 3 }), respond);
    await handleCastReportRoute('POST', '/api/ended', params({ sequence: 4 }), respond);
    expect(LocalCastQueueService.advance).toHaveBeenCalledTimes(1);
    expect(TrackPlayer.play).toHaveBeenCalledTimes(1);
    expect(respond).toHaveBeenCalledWith({ accepted: true });
  });
  it('keeps playback stopped when the queue has no next item', async () => {
    LocalCastPlaybackService.begin('session', 'track', 0, true);
    (LocalCastQueueService.advance as jest.Mock).mockResolvedValueOnce(false);
    await handleCastReportRoute('POST', '/api/ended', params(), jest.fn());
    expect(useCastStore.getState().setCastPlaying).toHaveBeenCalledWith(false);
  });
  it('rejects selection without a live session, during stopping, or after the queue changes', async () => {
    expect(await LocalCastPlaybackService.selectQueueItem(new URLSearchParams())).toBe(false);
    expect(await LocalCastPlaybackService.advance()).toBe(false);
    LocalCastPlaybackService.begin('session', 'track', 0, true);
    (LocalCastQueueService.validate as jest.Mock).mockResolvedValue(false);
    expect(await LocalCastPlaybackService.selectQueueItem(new URLSearchParams())).toBe(false);
    expect(LocalCastQueueService.validate).toHaveBeenCalledWith('session', '', NaN, '');
    const stopped = LocalCastPlaybackService.requestStop();
    expect(await LocalCastPlaybackService.selectQueueItem(params())).toBe(false);
    expect(await LocalCastPlaybackService.advance()).toBe(false);
    LocalCastPlaybackService.clear(); await stopped;
  });
  it('selects a valid row, saves the old listen, and starts the selected song from zero', async () => {
    LocalCastPlaybackService.begin('session', 'old', 34, true);
    (LocalCastQueueService.validate as jest.Mock).mockResolvedValue(true);
    const selection = params(); selection.set('index', '3'); selection.set('id', 'track'); selection.set('version', 'v1');
    expect(await LocalCastPlaybackService.selectQueueItem(selection)).toBe(true);
    expect(TrackPlayer.skip).toHaveBeenCalledWith(3);
    expect(PlaybackListenService.save).toHaveBeenCalledWith('old', 100, true);
    expect(TrackPlayer.play).toHaveBeenCalledTimes(1);
    expect(useCastStore.getState().setCastPlayback).toHaveBeenLastCalledWith(0, undefined, 0);
    expect(LocalCastPlaybackService.getState()?.activeTrackId).toBe('track');
  });
  it('starts a fresh playback token when the same track intentionally repeats', async () => {
    LocalCastPlaybackService.begin('session', 'track', 0, true);
    await LocalCastPlaybackService.advance(true);
    expect(LocalCastPlaybackService.getState()?.token).toBe('session:1');
    expect(useCastStore.getState().setCastPlayback).toHaveBeenCalledWith(0, undefined, 0);
  });
  it('does not replace a newer track transition or reset an unresolved native track', async () => {
    LocalCastPlaybackService.begin('session', 'track', 0, true);
    LocalCastPlaybackService.selectTrack('new');
    await LocalCastPlaybackService.syncTransition('session:0');
    expect(LocalCastPlaybackService.getState()?.token).toBe('session:1');
    (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValue(undefined);
    await LocalCastPlaybackService.syncTransition('session:1');
    LocalCastPlaybackService.clear();
    (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValue(0);
    await LocalCastPlaybackService.syncTransition(undefined);
    expect(TrackPlayer.play).not.toHaveBeenCalled();
  });
  it('keeps the browser paused when advancing fails', async () => {
    LocalCastPlaybackService.begin('session', 'track', 0, true);
    (LocalCastQueueService.advance as jest.Mock).mockRejectedValueOnce(new Error('native failure'));
    expect(await LocalCastPlaybackService.advance()).toBe(false);
    expect(useCastStore.getState().setCastPlaying).toHaveBeenCalledWith(false);
    expect(TrackPlayer.play).not.toHaveBeenCalled();
  });
});
