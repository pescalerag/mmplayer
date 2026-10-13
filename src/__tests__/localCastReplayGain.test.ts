import { runInNewContext } from 'node:vm';
import { calculateCastReplayGain, createLocalCastReplayGain, CastReplayGain } from '../services/LocalCastReplayGain';
import { castReplayGainMathSource, castReplayGainSource } from '../services/generated/LocalCastReplayGainSource';

const browserMath: typeof calculateCastReplayGain = runInNewContext(`(${castReplayGainMathSource})`);
const browserOutput: typeof createLocalCastReplayGain = runInNewContext(`(${castReplayGainSource})`);
const settings: CastReplayGain = { enabled: true, gainDb: -6, peak: 0.8, preampDb: 0, fallbackDb: -3 };

describe.each([
  ['original', calculateCastReplayGain, createLocalCastReplayGain],
  ['generated browser source', browserMath, browserOutput],
] as const)('LocalCast ReplayGain: %s', (_name, calculate, factory) => {
  it.each([
    [{ enabled: false, gainDb: 20, peak: 4 }, 1],
    [{}, 10 ** (-6 / 20)],
    [{ gainDb: 6, peak: 0.5 }, 10 ** (6 / 20)],
    [{ gainDb: 20, peak: 0.5 }, 2],
    [{ gainDb: 6, peak: null }, 1],
    [{ gainDb: -6, peak: null }, 10 ** (-6 / 20)],
    [{ gainDb: 6, peak: -1 }, 1],
    [{ gainDb: 6, peak: 0 }, 1],
    [{ gainDb: 0, peak: 1.2 }, 1 / 1.2],
    [{ gainDb: null, fallbackDb: -3 }, 10 ** (-3 / 20)],
    [{ gainDb: NaN, preampDb: Infinity, fallbackDb: NaN, peak: Infinity }, 1],
    [{ gainDb: -6, preampDb: 3 }, 10 ** (-3 / 20)],
    [{ gainDb: -200 }, 1e-6],
    [{ gainDb: 200, peak: 0.0001 }, 1000],
  ])('matches the native gain and peak rules for %j', (changes, expected) => {
    expect(calculate({ ...settings, ...changes })).toBeCloseTo(expected, 8);
  });
  function graph(state: AudioContextState = 'running') {
    const audio = { src: 'song.mp3', volume: 0.4, play: jest.fn().mockResolvedValue(undefined) };
    const gain = { gain: { setValueAtTime: jest.fn() }, connect: jest.fn() };
    const source = { connect: jest.fn() };
    const context = { state, currentTime: 10, destination: {}, createGain: jest.fn(() => gain), createMediaElementSource: jest.fn(() => source), resume: jest.fn(async () => { context.state = 'running'; }) };
    const create = jest.fn(() => context as unknown as AudioContext);
    const blocked = jest.fn();
    const output = factory(audio as unknown as HTMLAudioElement, calculate, create, blocked);
    return { audio, gain, source, context, create, blocked, output };
  }
  it('sets the first gain before playback, reuses one graph and preserves user volume', async () => {
    const { audio, gain, source, context, create, output } = graph();
    output.update(settings);
    expect(create).not.toHaveBeenCalled();
    await output.play();
    expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(calculate(settings), 10);
    expect(source.connect).toHaveBeenCalledWith(gain); expect(gain.connect).toHaveBeenCalledWith(context.destination);
    expect(gain.gain.setValueAtTime.mock.invocationCallOrder[0]).toBeLessThan(audio.play.mock.invocationCallOrder[0]);
    audio.src = 'next.mp3';
    output.update({ ...settings, gainDb: 6, peak: 0.5 });
    await output.play();
    expect(create).toHaveBeenCalledTimes(1); expect(audio.volume).toBe(0.4);
    expect(gain.gain.setValueAtTime).toHaveBeenLastCalledWith(10 ** (6 / 20), 10);
    output.update({ ...settings, enabled: false });
    expect(gain.gain.setValueAtTime).toHaveBeenLastCalledWith(1, 10);
  });
  it('resumes Web Audio before playback and reports a pending browser gesture', async () => {
    const { audio, context, blocked, output } = graph('suspended');
    let resume!: () => void;
    context.resume.mockImplementationOnce(() => new Promise<void>(done => { resume = () => { context.state = 'running'; done(); }; }));
    const play = output.play();
    expect(blocked).toHaveBeenCalledWith(expect.objectContaining({ name: 'NotAllowedError' }));
    expect(audio.play).not.toHaveBeenCalled();
    resume(); await play;
    expect(audio.play).toHaveBeenCalledTimes(1);
    context.state = 'interrupted' as AudioContextState;
    await output.play(); expect(context.resume).toHaveBeenCalledTimes(2);
  });
  it('boosts to 150%, preserves ReplayGain, and restores the chosen boost after mute or song changes', async () => {
    const { audio, gain, output } = graph();
    output.update(settings); output.setVolume(1.5);
    await output.play();
    expect(audio.volume).toBe(1);
    expect(gain.gain.setValueAtTime).toHaveBeenLastCalledWith(calculate(settings) * 1.5, 10);
    output.setVolume(0); expect(audio.volume).toBe(0);
    output.setVolume(1.5); expect(audio.volume).toBe(1);
    expect(gain.gain.setValueAtTime).toHaveBeenLastCalledWith(calculate(settings) * 1.5, 10);
    output.update({ ...settings, gainDb: 20, peak: 0.8 });
    expect(gain.gain.setValueAtTime).toHaveBeenLastCalledWith(1 / 0.8, 10);
    output.update({ ...settings, enabled: false, peak: 0.5 });
    expect(gain.gain.setValueAtTime).toHaveBeenLastCalledWith(1.5, 10);
    output.update({ ...settings, enabled: false, peak: null });
    expect(gain.gain.setValueAtTime).toHaveBeenLastCalledWith(1, 10);
  });
  it('keeps the 0–100% range unchanged and clamps invalid or excessive volume values', async () => {
    const { audio, gain, output } = graph();
    output.update(settings); await output.play();
    output.setVolume(0.5);
    expect(audio.volume).toBe(0.5);
    expect(gain.gain.setValueAtTime).toHaveBeenLastCalledWith(calculate(settings), 10);
    expect(output.setVolume(2)).toBe(1.5); expect(audio.volume).toBe(1);
    expect(output.setVolume(-1)).toBe(0); expect(audio.volume).toBe(0);
    expect(output.setVolume(NaN)).toBe(1); expect(audio.volume).toBe(1);
    expect(output.setVolume(Infinity)).toBe(1);
  });
  it('does not start a replaced or paused song while AudioContext is resuming', async () => {
    const { audio, context, output } = graph('suspended');
    let resume!: () => void;
    context.resume.mockImplementationOnce(() => new Promise<void>(done => { resume = done; }));
    const play = output.play(); audio.src = 'replacement.mp3'; resume(); await play;
    expect(audio.play).not.toHaveBeenCalled();
    context.state = 'running'; await output.play(() => false);
    expect(audio.play).not.toHaveBeenCalled();
  });
  it('propagates resume and playback errors to the existing autoplay handler', async () => {
    const { audio, context, output } = graph('suspended');
    context.resume.mockRejectedValueOnce(new Error('resume failed'));
    await expect(output.play()).rejects.toThrow('resume failed');
    expect(audio.play).not.toHaveBeenCalled();
    context.state = 'running'; audio.play.mockRejectedValueOnce(new Error('play blocked'));
    await expect(output.play()).rejects.toThrow('play blocked');
  });
});
