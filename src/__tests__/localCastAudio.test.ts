import { createLocalCastAudio } from '../services/LocalCastAudio';
import { runInNewContext } from 'node:vm';
import { localCastAudioSource } from '../services/generated/LocalCastAudioSource';

const browserFactory: typeof createLocalCastAudio = runInNewContext(`(${localCastAudioSource})`);

function createAudio() {
  const handlers: Record<string, () => void> = {};
  const audio = { currentTime: 0, duration: 180, playbackRate: 1, paused: true, ended: false, seeking: false, src: '',
    play: jest.fn(async () => { audio.paused = false; }), pause: jest.fn(() => { audio.paused = true; }), load: jest.fn(), removeAttribute: jest.fn(() => { audio.src = ''; }),
    addEventListener: jest.fn((name, callback) => { handlers[name] = callback; }),
  };
  return { audio, emit: (name: string) => handlers[name]() };
}

describe.each([
  ['original implementation', createLocalCastAudio],
  ['generated browser source', browserFactory],
] as const)('browser LocalCast audio: %s', (_name, createLocalCastAudio) => {
  const state = { sessionId: 'session', playbackToken: 'one', mediaFileName: 'track.mp3', position: 34, isPlaying: true };
  let time: number;
  beforeEach(() => { time = 0; });
  it('waits for metadata and applies the initial second before starting audio', () => {
    const { audio, emit } = createAudio();
    const player = createLocalCastAudio(audio as unknown as HTMLAudioElement, jest.fn(), jest.fn(), () => time);
    expect(player.isReady(null)).toBe(false);
    player.sync(state);
    expect(player.isReady('one')).toBe(false);
    expect(audio.play).not.toHaveBeenCalled(); expect(player.report().token).toBeUndefined();
    emit('loadedmetadata');
    expect(player.isReady('one')).toBe(true);
    expect(player.isReady('old')).toBe(false);
    expect(audio.currentTime).toBe(34); expect(audio.play).toHaveBeenCalledTimes(1);
    player.sync({ ...state, position: 0 }); expect(audio.currentTime).toBe(34);
    expect(player.report().token).toBe('one');
  });
  it('counts actual playback and excludes seeking, idle time and buffering', () => {
    const { audio, emit } = createAudio();
    const player = createLocalCastAudio(audio as unknown as HTMLAudioElement, jest.fn(), jest.fn(), () => time);
    player.sync(state); emit('loadedmetadata'); emit('playing');
    time = 1000; audio.currentTime = 35; emit('timeupdate');
    player.seek(87); emit('seeking'); emit('seeked');
    time = 2000; audio.currentTime = 88; emit('timeupdate');
    player.sync({ ...state, isPlaying: false });
    time = 6000;
    expect(player.report().listened).toBe(2);
    player.sync(state); emit('playing');
    time = 7000; audio.currentTime = 89; emit('timeupdate');
    expect(player.report().listened).toBe(3);
    audio.currentTime = 150; emit('timeupdate');
    expect(player.report().listened).toBe(3);
  });
  it('returns the last position and state, stops and empties the cached source immediately', () => {
    const { audio, emit } = createAudio();
    const player = createLocalCastAudio(audio as unknown as HTMLAudioElement, jest.fn(), jest.fn(), () => time);
    emit('loadedmetadata'); player.sync(state); emit('loadedmetadata');
    player.seek(87);
    const final = player.stop();
    expect(final).toMatchObject({ position: 87, playing: true, token: 'one' });
    expect(audio.paused).toBe(true); expect(audio.src).toBe('');
    expect(audio.load).toHaveBeenCalledTimes(3);
    expect(player.report().token).toBeUndefined();
  });
  it('stays paused when handed over paused and deduplicates end events for each track', () => {
    const { audio, emit } = createAudio(); const ended = jest.fn();
    const player = createLocalCastAudio(audio as unknown as HTMLAudioElement, ended, jest.fn(), () => time);
    emit('ended'); player.sync({ ...state, isPlaying: false }); emit('ended'); emit('loadedmetadata');
    expect(audio.play).not.toHaveBeenCalled(); emit('ended'); expect(ended).not.toHaveBeenCalled();
    audio.ended = true; emit('ended'); emit('ended'); expect(ended).toHaveBeenCalledTimes(1);
    player.sync({ ...state, playbackToken: 'two', position: 0 }); emit('loadedmetadata'); emit('ended');
    expect(ended).toHaveBeenCalledTimes(2);
  });
  it('stops after five seconds without a successful poll and reloads if contact resumes', () => {
    const { audio, emit } = createAudio();
    const player = createLocalCastAudio(audio as unknown as HTMLAudioElement, jest.fn(), jest.fn(), () => time);
    player.checkConnection(); player.sync(state); emit('loadedmetadata');
    time = 4999; player.checkConnection(); expect(audio.src).not.toBe('');
    time = 5000; player.checkConnection(); expect(audio.src).toBe('');
    player.sync(state); expect(audio.src).not.toBe('');
  });
  it('preserves cumulative reports when the same song reconnects after a network timeout', () => {
    const { audio, emit } = createAudio();
    const player = createLocalCastAudio(audio as unknown as HTMLAudioElement, jest.fn(), jest.fn(), () => time);
    player.sync(state); emit('loadedmetadata');
    time = 1000; audio.currentTime = 35; emit('timeupdate');
    const before = player.report();
    time = 6000; player.checkConnection();
    player.sync(Object.assign({}, state, { position: 35 })); emit('loadedmetadata');
    const after = player.report();
    expect(after.listened).toBe(before.listened);
    expect(after.sequence).toBeGreaterThan(before.sequence);
    expect(after.token).toBe(before.token);
  });
  it('reports play failures and does not report infinite media duration', async () => {
    const { audio, emit } = createAudio(); const error = jest.fn();
    audio.play.mockRejectedValueOnce(new Error('autoplay blocked'));
    const player = createLocalCastAudio(audio as unknown as HTMLAudioElement, jest.fn(), error);
    player.sync(state); emit('loadedmetadata'); await Promise.resolve();
    expect(error).toHaveBeenCalledWith(expect.any(Error));
    audio.duration = Infinity; expect(player.report().duration).toBe(0);
  });
  it('keeps listening totals across a decode retry and accepts seeks while metadata is loading', () => {
    const { audio, emit } = createAudio();
    const player = createLocalCastAudio(audio as unknown as HTMLAudioElement, jest.fn(), jest.fn(), () => time);
    player.retry(); player.sync(state); player.seek(87); emit('loadedmetadata');
    expect(audio.currentTime).toBe(87);
    time = 1000; audio.currentTime = 88; emit('timeupdate');
    const before = player.report(); player.retry(); emit('loadedmetadata');
    const after = player.report();
    expect(after.listened).toBe(before.listened);
    expect(after.sequence).toBeGreaterThan(before.sequence);
    expect(audio.currentTime).toBe(88);
  });
  it('deduplicates pending Web Audio starts and rejects starts after a pause or song change', async () => {
    const { audio, emit } = createAudio();
    let finish!: () => void;
    let allowed!: () => boolean;
    const play = jest.fn((canPlay: () => boolean) => { allowed = canPlay; return new Promise<void>(done => { finish = done; }); });
    const player = createLocalCastAudio(audio as unknown as HTMLAudioElement, jest.fn(), jest.fn(), () => time, play);
    player.sync(state); emit('loadedmetadata'); player.sync(state);
    expect(play).toHaveBeenCalledTimes(1); expect(allowed()).toBe(true);
    player.sync({ ...state, isPlaying: false }); expect(allowed()).toBe(false);
    player.sync({ ...state, playbackToken: 'replacement' }); emit('loadedmetadata');
    expect(allowed()).toBe(false);
    finish(); for (let step = 0; step < 5; step++) await Promise.resolve();
    player.sync({ ...state, playbackToken: 'replacement' });
    expect(play).toHaveBeenCalledTimes(2); expect(allowed()).toBe(true);
    audio.ended = true; emit('ended'); expect(allowed()).toBe(false);
    finish(); for (let step = 0; step < 5; step++) await Promise.resolve();
    player.stop(); expect(allowed()).toBe(false);
  });
});
