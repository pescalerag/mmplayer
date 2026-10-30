import TrackPlayer, { Event, State } from 'react-native-track-player';
jest.mock('../services/AndroidAutoService', () => ({ startAndroidAutoService: jest.fn() }));
// Presence has its own lifecycle tests; this suite isolates playback listeners.
jest.mock('../services/DiscordPresenceService', () => ({ startDiscordPresence: jest.fn() }));
jest.mock('../services/playerBootstrap', () => ({ ensurePlaybackReady: jest.fn().mockResolvedValue(undefined) }));
import { PlaybackService, PlaybackTimeTracker } from '../services/PlaybackService';
import { HistoryService } from '../services/HistoryService';
import { usePlayerStore } from '../store/usePlayerStore';
import { database } from '../database';
import { useCastStore } from '../store/useCastStore';
import { LocalCastPlaybackService } from '../services/LocalCastPlaybackService';
import { PlaybackListenService } from '../services/PlaybackListenService';
import PlaybackHistory from '../database/models/PlaybackHistory';
import { useMultipleQueuesStore } from '../store/useMultipleQueuesStore';

jest.mock('react-native-track-player', () => ({
  __esModule: true,
  Event: { PlaybackActiveTrackChanged: 'track-changed', PlaybackState: 'state', PlaybackQueueEnded: 'queue-ended', PlaybackProgressUpdated: 'progress',
    RemoteNext: 'remote-next', RemotePrevious: 'remote-previous', RemoteJumpForward: 'remote-forward', RemoteJumpBackward: 'remote-backward' },
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
    skip: jest.fn(), seekTo: jest.fn(), pause: jest.fn(), skipToPrevious: jest.fn(),
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
    skipToNext: jest.fn().mockResolvedValue(undefined),
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

it('allows playback to change during lyrics sync without reverting or seeking the edited song', async () => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  const state = usePlayerStore.getState();
  state.isSyncingLyrics = true;
  (state as any).activeTrack = { id: 'synced' };
  (TrackPlayer.getQueue as jest.Mock).mockResolvedValue([{ id: 'synced' }]);
  await PlaybackService();
  const listener = (TrackPlayer.addEventListener as jest.Mock).mock.calls.find(([type]) => type === Event.PlaybackActiveTrackChanged)![1];
  await listener({ track: { id: 'wrong' }, index: 1 });
  expect(TrackPlayer.skip).not.toHaveBeenCalled();
  expect(TrackPlayer.seekTo).not.toHaveBeenCalled();
  expect(TrackPlayer.pause).not.toHaveBeenCalled();
  expect(state.setActiveTrackById).toHaveBeenCalledWith('wrong', undefined);
  PlaybackTimeTracker.onStateNotPlaying();
  jest.clearAllTimers(); jest.useRealTimers();
  state.isSyncingLyrics = false; log.mockRestore();
});

it.each([Event.RemoteNext, Event.RemotePrevious, Event.RemoteJumpForward, Event.RemoteJumpBackward])('allows explicit transport commands during lyrics sync: %s', async event => {
  jest.clearAllMocks();
  useMultipleQueuesStore.setState({ isSwitching: false });
  const state = usePlayerStore.getState();
  state.isSyncingLyrics = true;
  (TrackPlayer.getProgress as jest.Mock).mockResolvedValueOnce({ position: 0, duration: 180 });
  try {
    await PlaybackService();
    const handler = (TrackPlayer.addEventListener as jest.Mock).mock.calls.find(([type]) => type === event)![1];
    await handler();
    if (event === Event.RemoteNext || event === Event.RemoteJumpForward) expect(state.skipToNext).toHaveBeenCalledTimes(1);
    else expect(TrackPlayer.skipToPrevious).toHaveBeenCalledTimes(1);
  } finally {
    state.isSyncingLyrics = false;
    (TrackPlayer.getProgress as jest.Mock).mockReset().mockResolvedValue({ position: 100, duration: 180 });
  }
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

describe('playback event boundary cases', () => {
  const listener = (type: Event) => (TrackPlayer.addEventListener as jest.Mock).mock.calls.find(([event]) => event === type)![1];

  beforeEach(() => {
    jest.useFakeTimers(); jest.clearAllMocks();
    const current = PlaybackTimeTracker.getCurrentTrackId();
    if (current) PlaybackTimeTracker.clearAccumulated(current);
    useCastStore.setState({ isLocalCastActive: false, isServerRunning: false, isChromecastConnected: false });
    usePlayerStore.getState().isSyncingLyrics = false;
    (TrackPlayer.getPlaybackState as jest.Mock).mockResolvedValue({ state: State.Paused });
    (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValue(0);
    (TrackPlayer.getTrack as jest.Mock).mockResolvedValue({ id: 'boundary' });
    (TrackPlayer.getQueue as jest.Mock).mockResolvedValue([]);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    useMultipleQueuesStore.setState({ activeId: 0, isSwitching: false, slots: Array.from({ length: 5 }, (_, id) => ({ id, name: '', session: null })) });
    const current = PlaybackTimeTracker.getCurrentTrackId();
    if (current) PlaybackTimeTracker.clearAccumulated(current);
    usePlayerStore.getState().isSyncingLyrics = false;
    useCastStore.setState({ isLocalCastActive: false });
    jest.clearAllTimers(); jest.restoreAllMocks(); jest.useRealTimers();
  });

  it('suspends listens without writing statistics during a queue change or closing an inactive listen', async () => {
    const save = jest.spyOn(PlaybackListenService, 'save').mockResolvedValue(undefined);
    PlaybackTimeTracker.setAccumulatedSeconds('suspended-entry', 65);
    await PlaybackService();
    useMultipleQueuesStore.setState({ isSwitching: true });
    await listener(Event.PlaybackActiveTrackChanged)({ lastTrack: { id: 'suspended-entry' }, track: { id: 'boundary' }, index: 0 });
    expect(save).not.toHaveBeenCalled();
    expect(PlaybackTimeTracker.getAccumulatedSeconds('suspended-entry')).toBe(65);
    useMultipleQueuesStore.setState({ activeId: 1, isSwitching: false, slots: [
      { id: 0, name: '', session: { queue: [{ id: 'suspended-entry' }], index: 0 } as any },
      { id: 1, name: '', session: null },
    ] });
    await listener(Event.PlaybackActiveTrackChanged)({ lastTrack: { id: 'suspended-entry' }, track: { id: 'boundary' }, index: 0 });
    expect(save).not.toHaveBeenCalled();
    expect(PlaybackTimeTracker.getAccumulatedSeconds('suspended-entry')).toBe(65);
  });

  it('does not complete a restored listen on an initial native activation event', async () => {
    const save = jest.spyOn(PlaybackListenService, 'save').mockResolvedValue(undefined);
    PlaybackTimeTracker.setAccumulatedSeconds('boundary', 100);
    await PlaybackService();
    await listener(Event.PlaybackActiveTrackChanged)({ track: { id: 'boundary' }, index: 0 });
    expect(save).not.toHaveBeenCalled();
    expect(PlaybackTimeTracker.getAccumulatedSeconds('boundary')).toBe(100);
  });

  it.each([null, { id: 'boundary' }])('allows a track change when lyrics sync has no conflicting track: %j', async activeTrack => {
    const state = usePlayerStore.getState();
    state.isSyncingLyrics = true;
    (state as any).activeTrack = activeTrack;
    const saved = jest.spyOn(PlaybackListenService, 'save').mockResolvedValue(undefined);
    await PlaybackService();
    await listener(Event.PlaybackActiveTrackChanged)({ track: { id: 'boundary' }, index: 0 });
    await settle();
    expect(TrackPlayer.skip).not.toHaveBeenCalled();
    expect(state.setActiveTrackById).toHaveBeenCalledWith('boundary', undefined);
    expect(saved).not.toHaveBeenCalled();
  });

  it('updates playback normally when the lyrics synchronization target has left the queue', async () => {
    usePlayerStore.getState().isSyncingLyrics = true;
    (usePlayerStore.getState() as any).activeTrack = { id: 'missing' };
    await PlaybackService();
    await listener(Event.PlaybackActiveTrackChanged)({ track: { id: 'boundary' }, index: 0 });
    expect(TrackPlayer.skip).not.toHaveBeenCalled();
    expect(TrackPlayer.seekTo).not.toHaveBeenCalled();
    expect(usePlayerStore.getState().setActiveTrackById).toHaveBeenCalledWith('boundary', undefined);
  });

  it('finishes an empty queue without creating a listen record', async () => {
    const saved = jest.spyOn(PlaybackListenService, 'save').mockResolvedValue(undefined);
    await PlaybackService();
    await listener(Event.PlaybackQueueEnded)();
    expect(saved).not.toHaveBeenCalled();
    expect(usePlayerStore.getState().playRandomQueueOnEnd).toHaveBeenCalledTimes(1);
  });

  it.each([
    [undefined, { id: 'boundary' }, false],
    [null, { id: 'boundary' }, false],
    [0, null, false],
    [0, {}, false],
    [0, { id: 'boundary' }, true],
  ])('starts the native timer only for a valid active track (%s, %j)', async (index, track, expected) => {
    (TrackPlayer.getPlaybackState as jest.Mock).mockResolvedValue({ state: State.Playing });
    (TrackPlayer.getActiveTrackIndex as jest.Mock).mockResolvedValue(index);
    (TrackPlayer.getTrack as jest.Mock).mockResolvedValue(track);
    await PlaybackService();
    await listener(Event.PlaybackState)({ state: State.Playing });
    expect(PlaybackTimeTracker.isTimerRunning()).toBe(expected);
  });

  it.each([
    [179, 180, 0, true],
    [179, 0, 0, false],
    [0, 180, 0, false],
    [30, 180, 0, false],
    [179, 180, 3, false],
    [179, 180, 179, false],
  ])('does not treat seeks or LocalCast playback as a completed native repeat (%s, %s, %s, %s)', async (previous, duration, next, cast) => {
    const saved = jest.spyOn(PlaybackListenService, 'save').mockResolvedValue(undefined);
    useCastStore.setState({ isLocalCastActive: cast });
    PlaybackTimeTracker.setAccumulatedSeconds('boundary', 100);
    await PlaybackService();
    const progress = listener(Event.PlaybackProgressUpdated);
    await progress({ position: previous, duration });
    await progress({ position: next, duration });
    expect(saved).not.toHaveBeenCalled();
    expect(PlaybackTimeTracker.getAccumulatedSeconds('boundary')).toBe(100);
  });
});


it('commits a crossfade listen once at its native boundary while the incoming clock keeps running', async () => {
  jest.useFakeTimers().setSystemTime(100000);
  jest.clearAllMocks();
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  const history = jest.spyOn(HistoryService, 'logToDatabase').mockResolvedValue(undefined);
  (database.get as jest.Mock).mockReturnValue({ find: jest.fn().mockResolvedValue({ duration: 180 }) });
  (TrackPlayer.getPlaybackState as jest.Mock).mockResolvedValue({ state: State.Playing });
  useCastStore.setState({ isLocalCastActive: false, isServerRunning: false, isChromecastConnected: false } as any);
  useMultipleQueuesStore.setState({ isSwitching: false });
  usePlayerStore.getState().isSyncingLyrics = false;
  PlaybackTimeTracker.reset();
  PlaybackTimeTracker.setAccumulatedSeconds('crossfade-old', 90);
  PlaybackTimeTracker.onStatePlaying('crossfade-old');
  jest.advanceTimersByTime(6000);
  const occurredAt = Date.now();
  jest.advanceTimersByTime(500);
  await PlaybackService();
  const listener = (TrackPlayer.addEventListener as jest.Mock).mock.calls.find(([type]) => type === Event.PlaybackActiveTrackChanged)![1];
  const event = { crossfade: true, transitionId: 'statistics-crossfade', occurredAt,
    track: { id: 'crossfade-new' }, lastTrack: { id: 'crossfade-old' }, index: 1, lastIndex: 0 };
  await listener(event);
  expect(history).toHaveBeenCalledWith('crossfade-old', 96, 'queue');
  expect(PlaybackTimeTracker.getAccumulatedSeconds('crossfade-new')).toBe(0.5);
  await listener(event);
  expect(history).toHaveBeenCalledTimes(1);
  expect(PlaybackTimeTracker.getAccumulatedSeconds('crossfade-old')).toBe(0);
  expect(PlaybackTimeTracker.getCurrentTrackId()).toBe('crossfade-new');
  PlaybackTimeTracker.reset();
  history.mockRestore(); errors.mockRestore(); jest.clearAllTimers(); jest.useRealTimers();
});


it('keeps both logical listens when a second crossfade arrives before the first history write finishes', async () => {
  jest.useFakeTimers().setSystemTime(200000);
  jest.clearAllMocks();
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  const history = jest.spyOn(PlaybackListenService, 'save');
  let finishFirst!: () => void;
  const pendingFirst = new Promise<void>(resolve => { finishFirst = resolve; });
  history.mockImplementation(async id => { if (id === 'rapid-a') await pendingFirst; });
  useCastStore.setState({ isLocalCastActive: false, isServerRunning: false, isChromecastConnected: false } as any);
  useMultipleQueuesStore.setState({ isSwitching: false });
  usePlayerStore.getState().isSyncingLyrics = false;
  (TrackPlayer.getPlaybackState as jest.Mock).mockResolvedValue({ state: State.Playing });
  PlaybackTimeTracker.reset();
  PlaybackTimeTracker.setAccumulatedSeconds('rapid-a', 90);
  PlaybackTimeTracker.onStatePlaying('rapid-a');
  await PlaybackService();
  const listener = (TrackPlayer.addEventListener as jest.Mock).mock.calls.find(([type]) => type === Event.PlaybackActiveTrackChanged)![1];
  const first = listener({ crossfade: true, transitionId: 'rapid-a-b', occurredAt: Date.now(),
    track: { id: 'rapid-b' }, lastTrack: { id: 'rapid-a' }, index: 1, lastIndex: 0 });
  jest.advanceTimersByTime(3000);
  await listener({ crossfade: true, transitionId: 'rapid-b-c', occurredAt: Date.now(),
    track: { id: 'rapid-c' }, lastTrack: { id: 'rapid-b' }, index: 2, lastIndex: 1 });
  finishFirst();
  await first;
  expect(history).toHaveBeenCalledWith('rapid-a', 90, true);
  expect(history).toHaveBeenCalledWith('rapid-b', 3, true);
  expect(PlaybackTimeTracker.getCurrentTrackId()).toBe('rapid-c');
  PlaybackTimeTracker.reset(); history.mockRestore(); errors.mockRestore();
  jest.clearAllTimers(); jest.useRealTimers();
});
