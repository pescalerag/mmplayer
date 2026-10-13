export interface CastReplayGain {
  readonly enabled: boolean;
  readonly gainDb: number | null;
  readonly peak: number | null;
  readonly preampDb: number;
  readonly fallbackDb: number;
}

function finite(value: number | null, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

// Matches the native ReplayGainMath rules, including protection when peak is unknown.
export function calculateCastReplayGain(settings: CastReplayGain): number {
  if (!settings.enabled) return 1;
  const gain = finite(settings.gainDb, finite(settings.fallbackDb, 0));
  const preamp = finite(settings.preampDb, 0);
  const requested = 10 ** (Math.max(-120, Math.min(60, gain + preamp)) / 20);
  const peak = finite(settings.peak, 1);
  const safePeak = peak > 0 ? peak : 1;
  return Math.min(requested, 1 / safePeak);
}

// Self-contained factory: the browser source is generated rather than serialized by Hermes.
export function createLocalCastReplayGain(audio: HTMLAudioElement, calculate: (settings: CastReplayGain) => number,
  createContext: () => AudioContext, onBlocked: (error: Error) => void) {
  let context: AudioContext | null = null;
  let gainNode: GainNode | null = null;
  let multiplier = 1;
  let boost = 1;
  let safePeak = 1;
  function effectiveGain() {
    const amplified = multiplier * boost;
    return boost > 1 ? Math.min(amplified, 1 / safePeak) : amplified;
  }
  function applyGain() {
    if (gainNode && context) gainNode.gain.setValueAtTime(effectiveGain(), context.currentTime);
  }
  function initialize() {
    if (context) return context;
    context = createContext();
    gainNode = context.createGain();
    gainNode.gain.setValueAtTime(effectiveGain(), context.currentTime);
    context.createMediaElementSource(audio).connect(gainNode);
    gainNode.connect(context.destination);
    return context;
  }
  function update(settings: CastReplayGain) {
    multiplier = calculate(settings);
    safePeak = typeof settings.peak === 'number' && Number.isFinite(settings.peak) && settings.peak > 0 ? settings.peak : 1;
    applyGain();
  }
  function setVolume(value: number) {
    const volume = Math.max(0, Math.min(1.5, Number.isFinite(value) ? value : 1));
    audio.volume = Math.min(volume, 1);
    boost = Math.max(volume, 1);
    applyGain();
    return volume;
  }
  async function play(canPlay: () => boolean = () => true) {
    const source = audio.src;
    const ctx = initialize();
    if (ctx.state !== 'running') {
      const resume = ctx.resume();
      if (ctx.state === 'suspended') onBlocked(Object.assign(new Error('Audio requires a user gesture'), { name: 'NotAllowedError' }));
      await resume;
    }
    if (canPlay() && audio.src === source) await audio.play();
  }
  return { update, play, setVolume };
}
