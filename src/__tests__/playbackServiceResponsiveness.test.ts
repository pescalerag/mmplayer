import TrackPlayer, { Event, State } from 'react-native-track-player';
import { PlaybackService, PlaybackTimeTracker } from '../services/PlaybackService';
import { HistoryService } from '../services/HistoryService';
import { usePlayerStore } from '../store/usePlayerStore';
import { database } from '../database';
import { useCastStore } from '../store/useCastStore';
import { LocalCastPlaybackService } from '../services/LocalCastPlaybackService';
import { PlaybackListenService } from '../services/PlaybackListenService';
import PlaybackHistory from '../database/models/PlaybackHistory';

jest.mock('react-native-track-player', () => ({
  __esModule: true,
  Event: { PlaybackActiveTrackChanged: 'track-changed', PlaybackState: 'state', PlaybackQueueEnded: 'queue-ended', PlaybackProgressUpdated: 'progress' },
  State: { Playing: 'playing', Paused: 'paused' },
  default: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    getActiveTrack: jest.fn().mockResolvedValue({ id: 'new' }),
    getPlaybackState: jest.fn().mockResolvedValue({ state: 'playing' }),
    getActiveTrackIndex: jest.fn().mockResolvedValue(1),
    getTrack: jest.fn().mockResolvedValue({ id: 'old' }),
    setVolume: jest.fn(),
    getProgress: jest.fn().mockResolvedValue({ position: 100, duration: 180 }),
    getQueue: jest.fn().mockResolvedValue([]),
    skip: jest.fn(), seekTo: jest.fn(), pause: jest.fn(),
  },
}));
jest.mock('../services/NotificationFavoritesService', () => ({ startNotificationFavoritesSync: jest.fn() }));
jest.mock('../../modules/native-audio-scanner', () => ({ updateWidget: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../store/usePlayerStore', () => {
  const state = {
    isSyncingLyrics: false, userQueueSize: 0,
    setActiveTrackById: jest.fn().mockResolvedValue(undefined),
    updateQueueStatus: jest.fn().mockResolvedValue(undefined),
    playRandomQueueOnEnd: jest.fn().mockResolvedValue(undefined),
  };
  return { consumeUserQueueTransition: jest.fn(), usePlayerStore: { getState: () => state, setState: jest.fn() } };
});

it.each([
  [10, 180, false, 10],
  [300, 180, true, 180],
  [650, 0, true, 600],
  [30, -1, true, 30],
])('applies the existing history threshold and duration cap to reported listens (%s seconds)', async (seconds, duration, expected, capped) => {
  jest.useFakeTimers(); jest.clearAllMocks();
  const logging = jest.spyOn(console, 'log').mockImplementation(() => {});
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  const history = jest.spyOn(HistoryService, 'logToDatabase').mockResolvedValue(undefined);
  const find = duration < 0 ? jest.fn().mockRejectedValue(new Error('deleted')) : jest.fn().mockResolvedValue({ duration });
  (database.get as jest.Mock).mockReturnValue({ find });
  useCastStore.setState({ isLocalCastActive: true, isServerRunning: false } as any);
  PlaybackTimeTracker.clearAccumulated('old');
  PlaybackTimeTracker.addReportedSeconds('old', seconds);
  await PlaybackService();
  const listener = (TrackPlayer.addEventListener as jest.Mock).mock.calls.find(([type]) => type === Event.PlaybackActiveTrackChanged)![1];
  await listener({ track: { id: 'new' }, lastTrack: { id: 'old' }, index: 1, lastIndex: 0 });
  expect(history).toHaveBeenCalledTimes(expected ? 1 : 0);
  if (expected) expect(history).toHaveBeenCalledWith('old', capped, 'queue');
  expect(PlaybackTimeTracker.getAccumulatedSeconds('old')).toBe(0);
  useCastStore.setState({ isLocalCastActive: false } as any);
  history.mockRestore(); logging.mockRestore(); warning.mockRestore(); errors.mockRestore();
  jest.clearAllTimers(); jest.useRealTimers();
});

it('preserves the lyrics synchronization guard without persisting or advancing the wrong song', async () => {
  jest.clearAllMocks();
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  const state = usePlayerStore.getState();
  state.isSyncingLyrics = true;
  (state as any).activeTrack = { id: 'synced' };
  (TrackPlayer.getQueue as jest.Mock).mockResolvedValue([{ id: 'synced' }]);
  await PlaybackService();
  const listener = (TrackPlayer.addEventListener as jest.Mock).mock.calls.find(([type]) => type === Event.PlaybackActiveTrackChanged)![1];
  await listener({ track: { id: 'wrong' }, index: 1 });
  expect(TrackPlayer.skip).toHaveBeenCalledWith(0);
  expect(TrackPlayer.seekTo).toHaveBeenCalledWith(0);
  expect(TrackPlayer.pause).toHaveBeenCalled();
  state.isSyncingLyrics = false; log.mockRestore();
});

it('adds reported browser listening to the existing listen and saves it once on track change', async () => {
  jest.useFakeTimers();
  const logging = jest.spyOn(console, 'log').mockImplementation(() => {});
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  const history = jest.spyOn(HistoryService, 'logToDatabase').mockResolvedValue(undefined);
  (database.get as jest.Mock).mockReturnValue({ find: jest.fn().mockResolvedValue({ duration: 180 }) });
  useCastStore.setState({ isLocalCastActive: true, isServerRunning: true, setCastPlayback: jest.fn() } as any);
  PlaybackTimeTracker.setAccumulatedSeconds('old', 30);
  LocalCastPlaybackService.begin('session', 'old', 34, true);
  const report = new URLSearchParams({ report: JSON.stringify({ sessionId: 'session', token: 'session:0', position: 100, duration: 180, listened: 70, playing: true, sequence: 1 }) });
  expect(LocalCastPlaybackService.receive(report)).toBe(true);
  expect(LocalCastPlaybackService.receive(report)).toBe(false);
  expect(PlaybackTimeTracker.getAccumulatedSeconds('old')).toBe(100);
  await PlaybackService();
  const calls = (TrackPlayer.addEventListener as jest.Mock).mock.calls;
  const stateListener = calls.find(([type]) => type === Event.PlaybackState)![1];
  await stateListener({ state: State.Playing });
  expect(PlaybackTimeTracker.isTimerRunning()).toBe(false);
  const changing = calls.find(([type]) => type === Event.PlaybackActiveTrackChanged)![1];
  await changing({ track: { id: 'new' }, lastTrack: { id: 'old' }, index: 1, lastIndex: 0 });
  expect(history).toHaveBeenCalledTimes(1);
  expect(history).toHaveBeenCalledWith('old', 100, 'queue');
  expect(PlaybackTimeTracker.isTimerRunning()).toBe(false);
  expect(LocalCastPlaybackService.getState()?.activeTrackId).toBe('new');
  useCastStore.setState({ isLocalCastActive: false, isServerRunning: false } as any);
  LocalCastPlaybackService.clear();
  history.mockRestore(); logging.mockRestore(); errors.mockRestore();
  jest.clearAllTimers(); jest.useRealTimers();
});

const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

it('updates the LocalCast checkpoint when the same song finishes on the phone without another playback', async () => {
  jest.clearAllMocks();
  const record = { id: 'saved-listen' } as PlaybackHistory;
  const history = jest.spyOn(HistoryService, 'logToDatabase').mockResolvedValue(record);
  (database.get as jest.Mock).mockReturnValue({ find: jest.fn().mockResolvedValue({ duration: 180 }) });
  PlaybackTimeTracker.setAccumulatedSeconds('continued', 100);
  await PlaybackListenService.save('continued', 100);
  PlaybackTimeTracker.addReportedSeconds('continued', 50);
  await PlaybackService();
  const ended = (TrackPlayer.addEventListener as jest.Mock).mock.calls.find(([type]) => type === Event.PlaybackQueueEnded)![1];
  await ended();
  expect(history.mock.calls).toEqual([['continued', 100, 'queue'], ['continued', 150, 'queue', record]]);
  expect(PlaybackTimeTracker.getAccumulatedSeconds('continued')).toBe(0);
  expect(usePlayerStore.getState().playRandomQueueOnEnd).toHaveBeenCalled();
  history.mockRestore();
});

it.each([
  [undefined, 'looped', false],
  [0, undefined, false],
  [0, 'other', false],
  [0, 'looped', true],
])('finishes the checkpoint on a native repeat only for the actual active song (%s, %s)', async (index, id, saves) => {
  jest.clearAllMocks();
  const history = jest.spyOn(HistoryService, 'logToDatabase').mockResolvedValue(undefined);
  (database.get as jest.Mock).mockReturnValue({ find: jest.fn().mockResolvedValue({ duration: 180 }) });
  (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValue(index);
  (TrackPlayer.getTrack as jest.Mock).mockResolvedValue(id ? { id } : null);
  useCastStore.setState({ isLocalCastActive: false } as any);
  PlaybackTimeTracker.setAccumulatedSeconds('looped', 100);
  await PlaybackService();
  const progress = (TrackPlayer.addEventListener as jest.Mock).mock.calls.find(([type]) => type === Event.PlaybackProgressUpdated)![1];
  await progress({ position: 179, duration: 180 });
  await progress({ position: 0, duration: 180 });
  expect(history).toHaveBeenCalledTimes(saves ? 1 : 0);
  PlaybackTimeTracker.clearAccumulated('looped');
  history.mockRestore();
});

it('updates the displayed song while history persistence is still pending', async () => {
  jest.useFakeTimers();
  let finishHistory!: () => void;
  const history = jest.spyOn(HistoryService, 'logToDatabase').mockImplementation(() => new Promise<undefined>(resolve => { finishHistory = () => resolve(undefined); }));
  const logging = jest.spyOn(console, 'log').mockImplementation(() => {});
  (database.get as jest.Mock).mockReturnValue({ find: jest.fn().mockResolvedValue({ duration: 180 }) });
  await PlaybackService();
  const listener = (TrackPlayer.addEventListener as jest.Mock).mock.calls.find(([type]) => type === Event.PlaybackActiveTrackChanged)![1];
  PlaybackTimeTracker.setAccumulatedSeconds('old', 120);
  const changing = listener({ track: { id: 'new' }, lastTrack: { id: 'old' }, index: 1, lastIndex: 0 });
  await settle();
  expect(history).toHaveBeenCalled();
  expect(usePlayerStore.getState().setActiveTrackById).toHaveBeenCalledWith('new', undefined);
  expect(usePlayerStore.getState().updateQueueStatus).toHaveBeenCalledWith(1);
  expect((await TrackPlayer.getPlaybackState()).state).toBe(State.Playing);
  finishHistory();
  await changing;
  history.mockRestore();
  logging.mockRestore();
  jest.clearAllTimers();
  jest.useRealTimers();
});
