import { emptyPlayer } from "@mmplayer/platform";
import type {
  LibraryTrack,
  PlayerPersistence,
  PlaybackSession,
} from "@mmplayer/platform";
import { shuffleArray } from "@mmplayer/core/shuffle";
import { SystemMediaSession } from "./systemMedia";
import {
  parseSkipConfig,
  resolveSkipPosition,
  shouldTriggerABLoop,
  type SkipConfig,
} from "@mmplayer/core/timestamps";

export const FADE_DURATION_MS = 400;
const FADE_STEPS = 16;
const FADE_STEP_MS = Math.round(FADE_DURATION_MS / FADE_STEPS);
export const EQUALIZER_FREQUENCIES_HZ = [60, 170, 350, 1000, 3500, 10000] as const;

export function calculateReplayGainMultiplier(
  enabled: boolean,
  gainDb: number | null | undefined,
  peak: number | null | undefined,
  preampDb: number,
  fallbackDb: number,
): number {
  if (!enabled) return 1.0;
  const validPeak =
    typeof peak === "number" && Number.isFinite(peak) && peak > 0 ? peak : null;
  if (typeof gainDb === "number" && Number.isFinite(gainDb)) {
    let db = gainDb + (Number.isFinite(preampDb) ? preampDb : 0);
    // Prevent unverified boosts when peak is absent, while preserving attenuation.
    if (validPeak === null && db > 0) db = 0;
    const linear = Math.pow(10, db / 20);
    return validPeak !== null ? Math.min(linear, 1.0 / validPeak) : linear;
  }
  const db = Number.isFinite(fallbackDb) ? fallbackDb : 0;
  const linear = Math.pow(10, db / 20);
  return validPeak !== null ? Math.min(linear, 1.0 / validPeak) : linear;
}

export function processReplayGainPcm16(
  samples: Int16Array | number[],
  multiplier: number,
): Int16Array {
  const out = new Int16Array(samples.length);
  if (multiplier === 1.0) {
    for (let i = 0; i < samples.length; i++) out[i] = samples[i];
    return out;
  }
  for (let i = 0; i < samples.length; i++) {
    const scaled = Math.round(samples[i] * multiplier);
    out[i] = Math.max(-32768, Math.min(32767, scaled));
  }
  return out;
}

export interface PlayerView {
  track: LibraryTrack | null;
  playing: boolean;
  fadingOut?: boolean;
  position: number;
  duration: number;
  volume: number;
  speed?: number;
  pitch?: number;
  vinylMode?: boolean;
  activeQueue: number;
  queues: PlaybackSession[];
  error: string | null;
  ab: { a: number; b: number | null } | null;
}

type QueueEntry = { trackId: string; id: string; isManual: boolean };

/** A single transport drives both player surfaces. Never create an audio element per panel. */
export class DesktopPlayer {
  private systemMedia?: SystemMediaSession;
  private transportKey = "";
  private audio = new Audio();
  private secondaryAudio = new Audio();
  private tracks = new Map<string, LibraryTrack>();
  private queueEntries = new WeakMap<PlaybackSession, QueueEntry[]>();
  private entryId = 0;
  private listeners = new Set<() => void>();
  private fadingListeners = new Set<(fading: boolean) => void>();
  private persistence = emptyPlayer();
  private view: PlayerView = {
    track: null,
    playing: false,
    fadingOut: false,
    position: 0,
    duration: 0,
    volume: 1,
    speed: 1,
    pitch: 1,
    vinylMode: false,
    activeQueue: 0,
    queues: this.persistence.queues,
    error: null,
    ab: null,
  };
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private lastTick = performance.now();
  private lastSavedAt = 0;
  private manuallyEnteredSegment: string | null = null;

  // WebAudio graph nodes
  private context: AudioContext | null = null;
  private primarySource: MediaElementAudioSourceNode | null = null;
  private secondarySource: MediaElementAudioSourceNode | null = null;
  private primaryDeckGain: GainNode | null = null;
  private secondaryDeckGain: GainNode | null = null;
  private replayGainNode: GainNode | null = null;
  private bassBoostNode: BiquadFilterNode | null = null;
  private bands: BiquadFilterNode[] = [];
  private pitchDelayA: DelayNode | null = null;
  private pitchDelayB: DelayNode | null = null;
  private pitchGainA: GainNode | null = null;
  private pitchGainB: GainNode | null = null;
  private pitchDryGain: GainNode | null = null;
  private pitchWetGain: GainNode | null = null;
  private pitchModTimer: ReturnType<typeof setInterval> | null = null;
  private pitchPhase = 0;
  private analyser: AnalyserNode | null = null;

  // Audio effects state
  private eqEnabled = false;
  private eqGains = [0, 0, 0, 0, 0, 0];
  private bassBoostStrength = 0;
  private replayGainEnabled = true;
  private replayGainPreamp = 0;
  private replayGainFallback = -5;
  private currentReplayGainMultiplier = 1;
  private playbackSpeedVal = 1;
  private playbackPitchVal = 1;
  private vinylModeVal = false;

  // Fade & Crossfade state
  private isFadingOutFlag = false;
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;
  private fadePauseResolve: (() => void) | null = null;
  private fadeEnvelope = 1;
  private fadeOperationId = 0;
  private fadeEnabledProvider: () => boolean = () => {
    try {
      const raw = globalThis.localStorage?.getItem("mmplayer-settings");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.state?.isFadeEnabled === "boolean") {
          return parsed.state.isFadeEnabled;
        }
      }
    } catch {
      // Ignore storage access errors in headless tests
    }
    return false;
  };
  private crossfadeSeconds = 0;
  private crossfadeAllowed = true;
  private isCrossfading = false;
  private crossfadeTargetIndex = -1;
  private crossfadeMixProgress = 0;

  private changing = 0;
  private operation = 0;
  private listens = new WeakMap<PlaybackSession, Promise<void>>();
  private onQueueEndShuffleHandler: (() => Promise<void>) | null = null;
  private shuffleExclusionChecker:
    | ((track: LibraryTrack) => boolean)
    | null = null;
  private timestampPolicy: {
    trackId: string | null;
    config: SkipConfig;
    blocked: boolean;
    pointA: number;
    pointB: number;
  } | null = null;

  constructor() {
    this.setupAudioElement(this.audio, true);
    this.setupAudioElement(this.secondaryAudio, false);

    if (typeof navigator !== "undefined" && "mediaSession" in navigator)
      this.systemMedia = new SystemMediaSession(navigator.mediaSession, {
        play: () => {
          void this.play();
        },
        pause: () => {
          void this.pause();
        },
        previoustrack: () => {
          void this.previous();
        },
        nexttrack: () => {
          void this.next();
        },
        seekto: (event) => {
          if (event.seekTime !== undefined) this.seek(event.seekTime);
        },
        seekbackward: (event) =>
          this.seek(this.audio.currentTime - (event.seekOffset ?? 10)),
        seekforward: (event) =>
          this.seek(this.audio.currentTime + (event.seekOffset ?? 10)),
        stop: () => {
          void this.pause(true);
          this.seek(0);
        },
      });
    if (typeof window !== "undefined" && window.mmplayer?.on) {
      window.mmplayer.on("transport", (action) => {
        if (action === "play") void this.play();
        else if (action === "pause") void this.pause();
        else if (action === "toggle") this.toggle();
        else if (action === "previous") void this.previous();
        else if (action === "next") void this.next();
        else {
          void this.pause(true);
          this.seek(0);
        }
      });
    }
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("pagehide", () => this.save());
    }
  }

  private setupAudioElement(element: HTMLAudioElement, isPrimary: boolean) {
    element.crossOrigin = "anonymous";
    element.preload = "auto";
    if (!isPrimary) return;
    element.addEventListener("play", () => {
      if (element !== this.audio) return;
      this.lastTick = performance.now();
      this.publish({ playing: !this.isFadingOutFlag, error: null });
    });
    element.addEventListener("pause", () => {
      if (element !== this.audio) return;
      this.setIsFadingOut(false);
      this.publish({ playing: false, fadingOut: false });
      this.save();
    });
    element.addEventListener("timeupdate", () => {
      if (element !== this.audio) return;
      this.tick();
    });
    element.addEventListener("loadedmetadata", () => {
      if (element !== this.audio) return;
      this.audio.currentTime = Math.min(
        this.queue.position,
        this.audio.duration || 0,
      );
      this.publish({
        duration: this.audio.duration,
        position: this.audio.currentTime,
      });
    });
    element.addEventListener("ended", () => {
      if (element !== this.audio) return;
      if (this.isCrossfading) {
        void this.completeCrossfade();
      } else {
        void this.next(true);
      }
    });
    element.addEventListener("error", () => {
      if (element !== this.audio) return;
      this.publish({
        playing: false,
        error: this.audio.error?.message || "Audio could not be decoded.",
      });
    });
  }

  setFadeEnabledProvider(provider: () => boolean) {
    this.fadeEnabledProvider = provider;
  }

  setOnQueueEndShuffleHandler(handler: (() => Promise<void>) | null) {
    this.onQueueEndShuffleHandler = handler;
  }

  setShuffleExclusionChecker(
    checker: ((track: LibraryTrack) => boolean) | null,
  ) {
    this.shuffleExclusionChecker = checker;
  }

  configureTimestamps(policyJson: string) {
    try {
      const parsed = JSON.parse(policyJson);
      this.timestampPolicy = {
        trackId: typeof parsed.trackId === "string" ? parsed.trackId : null,
        config: parsed.config ?? { enabled: false, segments: [] },
        blocked: Boolean(parsed.blocked),
        pointA: typeof parsed.pointA === "number" ? parsed.pointA : -1,
        pointB: typeof parsed.pointB === "number" ? parsed.pointB : -1,
      };
    } catch {
      this.timestampPolicy = null;
    }
  }

  private resolveActiveSkipConfig(track: LibraryTrack): {
    config: SkipConfig;
    blocked: boolean;
  } {
    if (
      this.timestampPolicy &&
      this.timestampPolicy.trackId === track.id
    ) {
      return {
        config: this.timestampPolicy.config,
        blocked: this.timestampPolicy.blocked,
      };
    }
    return {
      config: parseSkipConfig(track.skipSegments, (track.duration || 0) * 1000),
      blocked: false,
    };
  }

  setAB(a: number | null, b: number | null) {
    if (a === null) {
      this.publish({ ab: null });
    } else {
      this.publish({ ab: { a, b } });
    }
  }

  private isTrackExcludedFromShuffle(trackId: string): boolean {
    const track = this.tracks.get(trackId);
    if (!track) return false;
    if (track.isExcludedFromShuffle) return true;
    if (this.shuffleExclusionChecker && this.shuffleExclusionChecker(track))
      return true;
    return false;
  }

  getIsFadingOut = () => this.isFadingOutFlag;

  setIsFadingOut = (val: boolean) => {
    if (this.isFadingOutFlag !== val) {
      this.isFadingOutFlag = val;
      this.fadingListeners.forEach((listener) => {
        try {
          listener(val);
        } catch {
          // Ignore listener error
        }
      });
      this.publish({
        fadingOut: val,
        playing: val ? false : !this.audio.paused,
      });
    }
  };

  subscribeFadingOut = (listener: (fading: boolean) => void) => {
    this.fadingListeners.add(listener);
    return () => {
      this.fadingListeners.delete(listener);
    };
  };

  private clearFadeTimer() {
    if (this.fadeTimer !== null) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
    if (this.fadePauseResolve !== null) {
      const resolve = this.fadePauseResolve;
      this.fadePauseResolve = null;
      resolve();
    }
  }

  private scheduleFadeTimer(cb: () => void, ms: number, keepAlive = false) {
    const t = setTimeout(cb, ms);
    if (!keepAlive) {
      (t as unknown as { unref?: () => void })?.unref?.();
    }
    this.fadeTimer = t;
  }

  private get queue() {
    return this.persistence.queues[this.persistence.activeQueue];
  }
  getSnapshot = () => this.view;
  getActiveId = () => this.view.track?.id ?? null;
  getAnalyser = () => {
    this.ensureAudioGraph();
    return this.analyser;
  };
  getAudioSettingsSnapshot = () => ({
    eqEnabled: this.eqEnabled,
    eqGains: [...this.eqGains],
    bassBoostStrength: this.bassBoostStrength,
    replayGainEnabled: this.replayGainEnabled,
    replayGainPreamp: this.replayGainPreamp,
    replayGainFallback: this.replayGainFallback,
    replayGainMultiplier: this.currentReplayGainMultiplier,
    speed: this.playbackSpeedVal,
    pitch: this.playbackPitchVal,
    vinylMode: this.vinylModeVal,
    crossfadeSeconds: this.crossfadeSeconds,
    crossfadeAllowed: this.crossfadeAllowed,
    isCrossfading: this.isCrossfading,
  });

  private entries(queue = this.queue): QueueEntry[] {
    const previous = this.queueEntries.get(queue) || [];
    if (
      previous.length === queue.trackIds.length &&
      previous.every((entry, index) => entry.trackId === queue.trackIds[index])
    )
      return previous;
    const pools = new Map<string, QueueEntry[]>();
    for (const entry of previous) {
      const pool = pools.get(entry.trackId) || [];
      pool.push(entry);
      pools.set(entry.trackId, pool);
    }
    const entries = queue.trackIds.map(
      (trackId) =>
        pools.get(trackId)?.shift() || {
          trackId,
          id: `desktop-queue-${++this.entryId}`,
          isManual: queue.manualTrackIds.includes(trackId),
        },
    );
    this.queueEntries.set(queue, entries);
    return entries;
  }

  getQueueTracks() {
    return this.entries().map((entry) => {
      const track = this.tracks.get(entry.trackId);
      return {
        ...track,
        id: entry.id,
        libraryId: entry.trackId,
        isManual: entry.isManual,
        url: track?.fileUrl || "",
        artwork: track?.cover || undefined,
      };
    });
  }

  async skipTo(index: number, position = 0) {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= this.queue.trackIds.length
    )
      return;
    const operation = ++this.operation;
    this.cancelCrossfade();
    await this.flushListen();
    if (operation !== this.operation) return;
    this.queue.index = index;
    this.queue.position = Math.max(0, Number.isFinite(position) ? position : 0);
    this.queue.accumulatedTime = 0;
    this.loadCurrent();
    this.save();
  }

  removeQueueEntries(indices: number[]) {
    const removed = new Set(
      indices.filter(
        (index) => index >= 0 && index < this.queue.trackIds.length,
      ),
    );
    if (!removed.size) return;
    this.cancelCrossfade();
    const current = this.queue.index;
    const entries = this.entries().filter(
      (_entry, index) => !removed.has(index),
    );
    this.queueEntries.set(this.queue, entries);
    this.queue.trackIds = entries.map((entry) => entry.trackId);
    this.queue.manualTrackIds = entries
      .filter((entry) => entry.isManual)
      .map((entry) => entry.trackId);
    this.queue.index = Math.max(
      0,
      Math.min(
        entries.length - 1,
        current - [...removed].filter((index) => index < current).length,
      ),
    );
    if (removed.has(current)) {
      this.queue.position = 0;
      this.loadCurrent();
    } else this.publish();
    this.save();
  }

  moveQueueEntry(from: number, to: number) {
    if (
      from <= this.queue.index ||
      to <= this.queue.index ||
      from >= this.queue.trackIds.length ||
      to >= this.queue.trackIds.length
    )
      return;
    this.cancelCrossfade();
    const entries = this.entries();
    const [entry] = entries.splice(from, 1);
    entries.splice(to, 0, entry);
    this.queueEntries.set(this.queue, entries);
    this.queue.trackIds = entries.map((entry) => entry.trackId);
    this.publish();
    this.save();
  }

  insertQueueEntries(
    tracks: { id: string; libraryId?: string; isManual?: boolean }[],
    at: number,
  ) {
    this.cancelCrossfade();
    const entries = this.entries();
    const hadActiveTrack = Boolean(this.view.track);
    const inserted = tracks.map((track) => {
      const trackId = track.libraryId || track.id;
      if (!this.tracks.has(trackId)) {
        const raw = track as Record<string, unknown>;
        this.tracks.set(trackId, {
          id: trackId,
          title: typeof raw.title === "string" ? raw.title : trackId,
          artist: typeof raw.artist === "string" ? raw.artist : "",
          album: typeof raw.album === "string" ? raw.album : "",
          albumId: typeof raw.albumId === "string" ? raw.albumId : "",
          artistId: typeof raw.artistId === "string" ? raw.artistId : "",
          genre: typeof raw.genre === "string" ? raw.genre : null,
          duration: typeof raw.duration === "number" ? raw.duration : 0,
          trackNumber: typeof raw.trackNumber === "number" ? raw.trackNumber : null,
          discNumber: typeof raw.discNumber === "number" ? raw.discNumber : null,
          year: typeof raw.year === "number" ? raw.year : null,
          isFavorite: Boolean(raw.isFavorite),
          lyricsLRC: typeof raw.lyricsLRC === "string" ? raw.lyricsLRC : null,
          skipSegments: typeof raw.skipSegments === "string" ? raw.skipSegments : null,
          fileUrl: typeof raw.fileUrl === "string" ? raw.fileUrl : typeof raw.url === "string" ? raw.url : "",
          cover: typeof raw.artwork === "string" ? raw.artwork : typeof raw.cover === "string" ? raw.cover : null,
          rating: typeof raw.rating === "number" ? raw.rating : null,
          available: raw.available !== false,
          replayGain: typeof raw.replayGain === "number" ? raw.replayGain : null,
          replayPeak: typeof raw.replayPeak === "number" ? raw.replayPeak : null,
          isExcludedFromShuffle: Boolean(raw.isExcludedFromShuffle),
        });
      }
      return {
        trackId,
        id: track.libraryId ? track.id : `desktop-queue-${++this.entryId}`,
        isManual: track.isManual === true,
      };
    });
    let insertIndex: number;
    if (at === -2) {
      insertIndex = this.view.track ? this.queue.index + 1 : 0;
    } else if (at === -3) {
      if (this.view.track) {
        let manualOffset = 0;
        for (let i = this.queue.index + 1; i < entries.length; i++) {
          if (entries[i].isManual) manualOffset++;
          else break;
        }
        insertIndex = this.queue.index + 1 + manualOffset;
      } else {
        insertIndex = entries.length;
      }
    } else {
      insertIndex = Math.max(0, Math.min(at, entries.length));
    }
    entries.splice(insertIndex, 0, ...inserted);
    if (
      at !== -2 &&
      at !== -3 &&
      insertIndex <= this.queue.index &&
      this.view.track
    )
      this.queue.index += inserted.length;
    this.queueEntries.set(this.queue, entries);
    this.queue.trackIds = entries.map((entry) => entry.trackId);
    this.queue.manualTrackIds = entries
      .filter((entry) => entry.isManual)
      .map((entry) => entry.trackId);
    if (!hadActiveTrack && this.queue.trackIds.length > 0) {
      this.loadCurrent();
    } else {
      this.publish();
    }
    this.save();
  }

  async resetAllQueues() {
    const operation = ++this.operation;
    this.cancelCrossfade();
    await this.pause(true);
    await this.flushListen();
    if (operation !== this.operation) return;
    const reset = emptyPlayer();
    this.persistence.queues = reset.queues;
    this.persistence.activeQueue = 0;
    this.queueEntries = new WeakMap();
    this.loadCurrent();
    this.save();
  }

  subscribe = (callback: () => void) => {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  };

  private publish(patch: Partial<PlayerView> = {}) {
    this.view = {
      ...this.view,
      ...patch,
      speed: this.playbackSpeedVal,
      pitch: this.playbackPitchVal,
      vinylMode: this.vinylModeVal,
      activeQueue: this.persistence.activeQueue,
      queues: this.persistence.queues.map((queue) => ({ ...queue })),
    };
    this.listeners.forEach((callback) => callback());
    this.systemMedia?.update(this.view, this.audio.playbackRate || 1);
    const state = {
      playing: this.view.playing,
      available: !!this.view.track?.available,
      title: this.view.track?.title ?? "",
      artist: this.view.track?.artist ?? "",
    };
    const key = JSON.stringify(state);
    if (key !== this.transportKey) {
      this.transportKey = key;
      if (typeof window !== "undefined" && window.mmplayer?.invoke) {
        void window.mmplayer
          .invoke("transportState", state)
          .catch(console.error);
      }
    }
  }

  initialize(persistence: PlayerPersistence, tracks: LibraryTrack[]) {
    this.persistence = persistence;
    this.fadeEnvelope = 1;
    this.setTracks(tracks);
    this.loadCurrent();
    this.applyEffectiveVolumes();
    this.publish({ volume: persistence.volume });
  }

  setTracks(tracks: LibraryTrack[]) {
    this.tracks = new Map(tracks.map((track) => [track.id, track]));
    if (this.view.track) {
      const updated = this.tracks.get(this.view.track.id) || this.view.track;
      this.publish({ track: updated });
      this.updateTrackReplayGain(updated);
    }
  }

  private updateTrackReplayGain(track: LibraryTrack | null) {
    this.currentReplayGainMultiplier = calculateReplayGainMultiplier(
      this.replayGainEnabled,
      track?.replayGain,
      track?.replayPeak,
      this.replayGainPreamp,
      this.replayGainFallback,
    );
    this.applyEffectiveVolumes();
  }

  private applyEffectiveVolumes() {
    const userVol = Math.max(0, Math.min(1, this.persistence.volume));
    const baseVol = userVol * this.fadeEnvelope;
    const primaryMix = this.isCrossfading
      ? Math.max(0, 1 - this.crossfadeMixProgress)
      : 1;
    const secondaryMix = this.isCrossfading
      ? Math.min(1, this.crossfadeMixProgress)
      : 0;

    if (this.context && this.replayGainNode && this.primaryDeckGain) {
      this.audio.volume = Math.max(0, Math.min(1, baseVol));
      this.secondaryAudio.volume = Math.max(0, Math.min(1, baseVol));
      const now = this.context.currentTime || 0;
      this.primaryDeckGain.gain.setTargetAtTime(primaryMix, now, 0.015);
      this.secondaryDeckGain?.gain.setTargetAtTime(secondaryMix, now, 0.015);
      this.replayGainNode.gain.setTargetAtTime(
        this.currentReplayGainMultiplier,
        now,
        0.015,
      );
    } else {
      // Fallback when WebAudio context is not instantiated (or in headless tests)
      this.audio.volume = Math.max(
        0,
        Math.min(1, baseVol * primaryMix * Math.min(1, this.currentReplayGainMultiplier)),
      );
      this.secondaryAudio.volume = Math.max(
        0,
        Math.min(1, baseVol * secondaryMix),
      );
    }
  }

  private applySpeedAndPitchToElement(element: HTMLAudioElement) {
    if (this.vinylModeVal) {
      (element as any).preservesPitch = false;
      (element as any).mozPreservesPitch = false;
      (element as any).webkitPreservesPitch = false;
      element.playbackRate = this.playbackSpeedVal;
      this.updatePitchShifterNode(1);
    } else {
      (element as any).preservesPitch = true;
      (element as any).mozPreservesPitch = true;
      (element as any).webkitPreservesPitch = true;
      element.playbackRate = this.playbackSpeedVal;
      if (Math.abs(this.playbackPitchVal - 1) > 0.001) {
        this.ensureAudioGraph();
      }
      this.updatePitchShifterNode(this.playbackPitchVal);
    }
  }

  private loadCurrent() {
    this.cancelCrossfade();
    this.clearFadeTimer();
    this.setIsFadingOut(false);
    this.fadeEnvelope = 1;
    const track =
      this.tracks.get(this.queue.trackIds[this.queue.index]) || null;
    this.audio.pause();
    this.manuallyEnteredSegment = null;
    if (track?.available) {
      this.audio.src = track.fileUrl;
      this.applySpeedAndPitchToElement(this.audio);
    } else {
      this.audio.removeAttribute("src");
      this.audio.load();
    }
    this.updateTrackReplayGain(track);
    this.publish({
      track,
      playing: false,
      fadingOut: false,
      position: this.queue.position,
      duration: track?.duration || 0,
      ab: null,
      error: track && !track.available ? "The file is unavailable." : null,
    });
  }

  async start(tracks: LibraryTrack[], index: number, autoplay = true) {
    if (!tracks.length) return;
    const operation = ++this.operation;
    try {
      await this.flushListen();
    } catch (error) {
      this.publish({ error: String(error) });
      return;
    }
    if (operation !== this.operation) return;
    for (const track of tracks) {
      this.tracks.set(track.id, track);
    }
    this.queueEntries.delete(this.queue);
    Object.assign(this.queue, {
      trackIds: tracks.map((track) => track.id),
      index: Math.max(0, Math.min(tracks.length - 1, index)),
      position: 0,
      manualTrackIds: [],
      accumulatedTime: 0,
      shuffle: false,
      shuffleOriginalTrackIds: [],
    });
    this.loadCurrent();
    if (autoplay) await this.play(true);
    this.save();
  }

  async startShuffled(
    tracks: LibraryTrack[],
    originalTracks?: LibraryTrack[],
    appendOnEnd = false,
  ) {
    if (!tracks.length) return;
    for (const track of tracks) {
      this.tracks.set(track.id, track);
    }
    if (originalTracks) {
      for (const track of originalTracks) {
        this.tracks.set(track.id, track);
      }
    }
    const eligible = tracks.filter(
      (track) => !this.isTrackExcludedFromShuffle(track.id),
    );
    const pool = eligible.length > 0 ? eligible : tracks;
    const shuffled = shuffleArray(pool);
    const originalIds = (originalTracks ?? tracks).map((t) => t.id);

    if (appendOnEnd) {
      const operation = ++this.operation;
      this.cancelCrossfade();
      try {
        await this.flushListen();
      } catch (error) {
        this.publish({ error: String(error) });
        return;
      }
      if (operation !== this.operation) return;
      this.queueEntries.delete(this.queue);
      Object.assign(this.queue, {
        trackIds: shuffled.map((track) => track.id),
        index: 0,
        position: 0,
        manualTrackIds: [],
        accumulatedTime: 0,
        shuffle: true,
        shuffleOriginalTrackIds: originalIds,
      });
      this.loadCurrent();
      await this.play(true);
      this.save();
      return;
    }

    const operation = ++this.operation;
    try {
      await this.flushListen();
    } catch (error) {
      this.publish({ error: String(error) });
      return;
    }
    if (operation !== this.operation) return;
    this.queueEntries.delete(this.queue);
    Object.assign(this.queue, {
      trackIds: shuffled.map((track) => track.id),
      index: 0,
      position: 0,
      manualTrackIds: [],
      accumulatedTime: 0,
      shuffle: true,
      shuffleOriginalTrackIds: originalIds,
    });
    this.loadCurrent();
    await this.play(true);
    this.save();
  }

  async setTransportPlaying(
    playing: boolean,
    targetVolume: number,
    durationMs: number,
  ): Promise<void> {
    if (Number.isFinite(targetVolume) && targetVolume >= 0) {
      this.persistence.volume = Math.max(0, Math.min(1, targetVolume));
    }
    if (playing) {
      await this.playInternal(durationMs);
    } else {
      await this.pauseInternal(durationMs);
    }
  }

  async play(bypassFade?: boolean) {
    const useFade = !bypassFade && this.fadeEnabledProvider();
    await this.playInternal(useFade ? FADE_DURATION_MS : 0);
  }

  private async playInternal(durationMs: number) {
    if (!this.view.track?.available) return;
    const opId = ++this.fadeOperationId;
    this.clearFadeTimer();
    const wasFadingOut = this.isFadingOutFlag;
    this.setIsFadingOut(false);

    try {
      await this.context?.resume();
      const wasPaused = this.audio.paused;
      if (durationMs <= 0) {
        this.fadeEnvelope = 1;
        this.applyEffectiveVolumes();
        if (wasPaused) await this.audio.play();
        this.publish({ playing: true, error: null });
        return;
      }

      const startEnv = wasPaused ? 0 : wasFadingOut ? this.fadeEnvelope : 1;
      this.fadeEnvelope = startEnv;
      this.applyEffectiveVolumes();
      if (wasPaused) await this.audio.play();
      if (opId !== this.fadeOperationId) return;
      this.publish({ playing: true, error: null });

      if (startEnv >= 0.99) {
        this.fadeEnvelope = 1;
        this.applyEffectiveVolumes();
        return;
      }

      const startedAt = Date.now();
      const step = () => {
        if (opId !== this.fadeOperationId) return;
        const elapsed = Date.now() - startedAt;
        const fraction = Math.min(1, elapsed / durationMs);
        this.fadeEnvelope = startEnv + (1 - startEnv) * fraction;
        this.applyEffectiveVolumes();
        if (fraction < 1) {
          this.scheduleFadeTimer(
            step,
            Math.max(1, Math.min(FADE_STEP_MS, durationMs - elapsed)),
          );
        } else {
          this.fadeEnvelope = 1;
          this.applyEffectiveVolumes();
          this.fadeTimer = null;
        }
      };
      this.scheduleFadeTimer(step, FADE_STEP_MS);
    } catch (error) {
      this.publish({ error: String(error), playing: false });
    }
  }

  pause(bypassFade?: boolean): Promise<void> {
    const useFade = !bypassFade && this.fadeEnabledProvider();
    return this.pauseInternal(useFade ? FADE_DURATION_MS : 0);
  }

  private async pauseInternal(durationMs: number): Promise<void> {
    const opId = ++this.fadeOperationId;
    this.clearFadeTimer();

    if (this.isCrossfading) {
      this.secondaryAudio.pause();
    }

    if (durationMs <= 0 || this.audio.paused) {
      this.setIsFadingOut(false);
      this.fadeEnvelope = 1;
      this.audio.pause();
      this.applyEffectiveVolumes();
      return;
    }

    // If user tapped pause again while already fading out, pause immediately
    if (this.isFadingOutFlag) {
      this.setIsFadingOut(false);
      this.fadeEnvelope = 1;
      this.audio.pause();
      this.applyEffectiveVolumes();
      return;
    }

    const startEnv = this.fadeEnvelope;
    this.setIsFadingOut(true);
    const startedAt = Date.now();

    return new Promise<void>((resolve) => {
      this.fadePauseResolve = resolve;
      const finishResolve = () => {
        if (this.fadePauseResolve === resolve) {
          this.fadePauseResolve = null;
        }
        resolve();
      };
      const step = () => {
        if (opId !== this.fadeOperationId) {
          finishResolve();
          return;
        }
        const elapsed = Date.now() - startedAt;
        const fraction = Math.min(1, elapsed / durationMs);
        this.fadeEnvelope = Math.max(0, startEnv * (1 - fraction));
        this.applyEffectiveVolumes();
        if (fraction < 1 && this.fadeEnvelope > 0.001) {
          this.scheduleFadeTimer(
            step,
            Math.max(1, Math.min(FADE_STEP_MS, durationMs - elapsed)),
            true,
          );
        } else {
          this.fadeTimer = null;
          this.audio.pause();
          this.setIsFadingOut(false);
          this.fadeEnvelope = 1;
          this.applyEffectiveVolumes();
          finishResolve();
        }
      };
      this.scheduleFadeTimer(step, FADE_STEP_MS, true);
    });
  }

  toggle() {
    if (this.audio.paused || this.isFadingOutFlag) void this.play();
    else void this.pause();
  }

  seek(position: number, automatic = false) {
    if (!this.view.track || !Number.isFinite(position)) return;
    this.cancelCrossfade();
    const value = Math.max(
      0,
      Math.min(position, this.audio.duration || this.view.duration),
    );
    const { config } = this.resolveActiveSkipConfig(this.view.track);
    if (automatic) {
      this.manuallyEnteredSegment = null;
    } else {
      this.manuallyEnteredSegment =
        config.segments.find(
          (segment) =>
            value * 1000 >= segment.startMs && value * 1000 < segment.endMs,
        )?.id || null;
    }
    this.audio.currentTime = value;
    this.queue.position = value;
    this.lastTick = performance.now();
    this.publish({ position: value });
    this.save();
  }

  private resolveNextIndexForCrossfade(): number {
    if (this.queue.repeat === "one") return -1;
    if (this.queue.index + 1 < this.queue.trackIds.length) {
      return this.queue.index + 1;
    }
    if (this.queue.repeat === "all" && this.queue.trackIds.length > 1) {
      return 0;
    }
    return -1;
  }

  private cancelCrossfade() {
    if (!this.isCrossfading) return;
    this.isCrossfading = false;
    this.crossfadeTargetIndex = -1;
    this.crossfadeMixProgress = 0;
    this.secondaryAudio.pause();
    this.secondaryAudio.removeAttribute("src");
    this.secondaryAudio.load();
    this.applyEffectiveVolumes();
  }

  private startCrossfadeIfNeeded(position: number, duration: number) {
    if (this.isCrossfading) {
      if (!this.crossfadeAllowed) {
        this.cancelCrossfade();
        return;
      }
      const remaining = Math.max(0, duration - position);
      const total = Math.max(1, this.crossfadeSeconds || 1);
      this.crossfadeMixProgress = Math.max(
        0,
        Math.min(1, 1 - remaining / total),
      );
      this.applyEffectiveVolumes();
      if (remaining <= 0.08) {
        void this.completeCrossfade();
      }
      return;
    }

    if (
      this.crossfadeSeconds <= 0 ||
      !this.crossfadeAllowed ||
      this.audio.paused ||
      this.isFadingOutFlag ||
      this.view.ab !== null ||
      duration <= this.crossfadeSeconds + 1
    ) {
      return;
    }

    const remaining = duration - position;
    if (remaining > this.crossfadeSeconds || remaining <= 0.15) return;

    const nextIdx = this.resolveNextIndexForCrossfade();
    if (nextIdx < 0) return;
    const nextTrackId = this.queue.trackIds[nextIdx];
    const nextTrack = this.tracks.get(nextTrackId);
    if (!nextTrack?.available) return;

    this.isCrossfading = true;
    this.crossfadeTargetIndex = nextIdx;
    this.crossfadeMixProgress = Math.max(
      0,
      Math.min(1, 1 - remaining / this.crossfadeSeconds),
    );
    this.secondaryAudio.src = nextTrack.fileUrl;
    this.secondaryAudio.currentTime = 0;
    this.applySpeedAndPitchToElement(this.secondaryAudio);
    this.applyEffectiveVolumes();
    void this.secondaryAudio.play().catch(() => {
      this.cancelCrossfade();
    });
  }

  private async completeCrossfade() {
    if (!this.isCrossfading || this.changing) return;
    this.changing++;
    const targetIndex = this.crossfadeTargetIndex;
    const operation = ++this.operation;
    try {
      await this.flushListen();
      if (operation !== this.operation) return;

      const nextPos = this.secondaryAudio.currentTime || 0;
      this.isCrossfading = false;
      this.crossfadeTargetIndex = -1;
      this.crossfadeMixProgress = 0;

      // Swap decks or transfer playback state cleanly to primary deck
      this.queue.index = targetIndex;
      this.queue.position = nextPos;
      this.queue.accumulatedTime = 0;
      const track =
        this.tracks.get(this.queue.trackIds[this.queue.index]) || null;
      this.secondaryAudio.pause();
      this.secondaryAudio.removeAttribute("src");
      this.secondaryAudio.load();

      if (track?.available) {
        this.audio.src = track.fileUrl;
        this.audio.currentTime = nextPos;
        this.applySpeedAndPitchToElement(this.audio);
        this.updateTrackReplayGain(track);
        this.applyEffectiveVolumes();
        await this.audio.play();
        this.publish({
          track,
          playing: true,
          position: nextPos,
          duration: track.duration || 0,
          ab: null,
          error: null,
        });
      } else {
        this.loadCurrent();
      }
      this.save();
    } catch (error) {
      this.publish({ error: String(error) });
    } finally {
      this.changing--;
    }
  }

  public tick() {
    const now = performance.now();
    if (!this.audio.paused && !this.audio.seeking && this.audio.readyState >= 3)
      this.queue.accumulatedTime += Math.min(
        1,
        Math.max(0, (now - this.lastTick) / 1000),
      );
    this.lastTick = now;
    const track = this.view.track;
    let position = this.audio.currentTime;
    const duration = this.audio.duration || track?.duration || 0;
    if (track) {
      const { config, blocked } = this.resolveActiveSkipConfig(track);
      const segment = config.segments.find(
        (segment) =>
          position * 1000 >= segment.startMs && position * 1000 < segment.endMs,
      );
      if (
        this.manuallyEnteredSegment &&
        segment?.id !== this.manuallyEnteredSegment
      )
        this.manuallyEnteredSegment = null;
      if (!this.audio.paused && !this.manuallyEnteredSegment && !blocked)
        position = resolveSkipPosition(position * 1000, config) / 1000;
      const loopTarget = shouldTriggerABLoop(
        position,
        this.view.ab?.a ?? null,
        this.view.ab?.b ?? null,
      );
      if (loopTarget !== null && !blocked) {
        position = loopTarget;
      }
      if (Math.abs(position - this.audio.currentTime) > 0.01)
        this.audio.currentTime = position;
      this.startCrossfadeIfNeeded(position, duration);
    }
    this.queue.position = position;
    this.publish({ position });
    if (now - this.lastSavedAt > 5000) {
      this.lastSavedAt = now;
      this.save();
    }
  }

  private flushListen(): Promise<void> {
    const queue = this.queue,
      existing = this.listens.get(queue);
    if (existing) return existing;
    const id = queue.trackIds[queue.index],
      seconds = queue.accumulatedTime;
    if (!id || seconds <= 0 || typeof window === "undefined" || !window.mmplayer?.invoke)
      return Promise.resolve();
    const request = window.mmplayer
      .invoke("listen", { trackId: id, seconds })
      .then(() => {
        queue.accumulatedTime = Math.max(0, queue.accumulatedTime - seconds);
      })
      .finally(() => this.listens.delete(queue));
    this.listens.set(queue, request);
    return request;
  }

  async next(ended = false) {
    if (this.changing) return;
    this.changing++;
    const operation = ++this.operation;
    try {
      this.cancelCrossfade();
      const continuePlaying =
        (!this.audio.paused && !this.isFadingOutFlag) || ended;
      await this.flushListen();
      if (operation !== this.operation) return;
      if (ended && this.queue.repeat === "one") this.queue.position = 0;
      else if (this.queue.index + 1 < this.queue.trackIds.length) {
        this.queue.index++;
        this.queue.position = 0;
      } else if (
        this.queue.repeat === "all" &&
        this.queue.trackIds.length > 1
      ) {
        this.queue.index = 0;
        this.queue.position = 0;
      } else if (
        this.queue.repeat === "off" &&
        this.queue.shuffleOnEnd &&
        this.onQueueEndShuffleHandler
      ) {
        this.changing--;
        try {
          await this.onQueueEndShuffleHandler();
        } finally {
          this.changing++;
        }
        return;
      } else {
        await this.pause(true);
        this.save();
        return;
      }
      this.loadCurrent();
      if (continuePlaying) await this.play(true);
      this.save();
    } catch (error) {
      this.publish({ error: String(error) });
    } finally {
      this.changing--;
    }
  }

  async previous() {
    if (this.audio.currentTime > 3) {
      this.seek(0);
      return;
    }
    const operation = ++this.operation;
    this.cancelCrossfade();
    try {
      await this.flushListen();
    } catch (error) {
      this.publish({ error: String(error) });
      return;
    }
    if (operation !== this.operation) return;
    const playing = !this.audio.paused && !this.isFadingOutFlag;
    this.queue.index = Math.max(0, this.queue.index - 1);
    this.queue.position = 0;
    this.loadCurrent();
    if (playing) await this.play(true);
    this.save();
  }

  switchQueue(index: number) {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index > 4 ||
      index === this.persistence.activeQueue
    )
      return;
    ++this.operation;
    this.cancelCrossfade();
    this.clearFadeTimer();
    this.setIsFadingOut(false);
    this.queue.position = this.audio.currentTime;
    this.audio.pause();
    // Suspending a queue does not finalize its listen or count it twice.
    this.persistence.activeQueue = index;
    this.loadCurrent();
    this.save();
  }

  add(
    tracks: LibraryTrack[],
    next: boolean | "after-manual" | "context" = false,
    queueId = this.persistence.activeQueue,
  ) {
    const queue = this.persistence.queues[queueId];
    if (!queue || !tracks.length) return;
    for (const track of tracks) {
      this.tracks.set(track.id, track);
    }
    const ids = tracks.map((track) => track.id);
    const entries = this.entries(queue);
    const isManual = next !== "context";
    let insertIndex: number;
    if (next === true) {
      insertIndex = queue.trackIds.length > 0 ? queue.index + 1 : 0;
    } else if (next === "after-manual") {
      if (queue.trackIds.length > 0) {
        let manualOffset = 0;
        for (let i = queue.index + 1; i < entries.length; i++) {
          if (entries[i].isManual) manualOffset++;
          else break;
        }
        insertIndex = queue.index + 1 + manualOffset;
      } else {
        insertIndex = 0;
      }
    } else {
      insertIndex = entries.length;
    }
    entries.splice(
      insertIndex,
      0,
      ...ids.map((trackId) => ({
        trackId,
        id: `desktop-queue-${++this.entryId}`,
        isManual,
      })),
    );
    this.queueEntries.set(queue, entries);
    queue.trackIds = entries.map((e) => e.trackId);
    queue.manualTrackIds = entries
      .filter((e) => e.isManual)
      .map((e) => e.trackId);
    if (queueId === this.persistence.activeQueue && !this.view.track)
      this.loadCurrent();
    this.publish();
    this.save();
  }

  renameQueue(name: string) {
    if (name.trim()) this.queue.name = name.trim().slice(0, 60);
    this.publish();
    this.save();
  }

  renameQueueAt(index: number, name: string) {
    const target = this.persistence.queues[index];
    if (!target) return;
    target.name = name.trim().slice(0, 60);
    this.publish();
    this.save();
  }

  setShuffleOnEnd(value: boolean) {
    this.queue.shuffleOnEnd = Boolean(value);
    this.publish();
    this.save();
  }

  removeTracks(trackIds: string[]) {
    if (!trackIds.length) return;
    const removedSet = new Set(trackIds);
    let reloadActive = false;
    this.persistence.queues.forEach((q, qIdx) => {
      const currentId = q.trackIds[q.index];
      let removedBeforeCurrent = 0;
      for (let i = 0; i < q.index; i++) {
        if (removedSet.has(q.trackIds[i])) removedBeforeCurrent++;
      }
      q.trackIds = q.trackIds.filter((id) => !removedSet.has(id));
      q.manualTrackIds = q.manualTrackIds.filter((id) => !removedSet.has(id));
      q.index = Math.max(
        0,
        Math.min(q.trackIds.length - 1, q.index - removedBeforeCurrent),
      );
      if (
        qIdx === this.persistence.activeQueue &&
        currentId &&
        removedSet.has(currentId)
      ) {
        q.position = 0;
        reloadActive = true;
      }
    });
    for (const id of trackIds) this.tracks.delete(id);
    if (reloadActive) this.loadCurrent();
    else this.publish();
    this.save();
  }

  clearQueue(mode: "all" | "manual" | "context") {
    this.cancelCrossfade();
    if (mode === "all") {
      void this.pause(true);
      this.queue.trackIds = [];
      this.queue.manualTrackIds = [];
      this.queue.index = 0;
      this.queue.position = 0;
      this.loadCurrent();
    } else if (mode === "manual") {
      const entries = this.entries().filter(
        (entry, idx) => idx <= this.queue.index || !entry.isManual,
      );
      this.queueEntries.set(this.queue, entries);
      this.queue.trackIds = entries.map((e) => e.trackId);
      this.queue.manualTrackIds = [];
      this.publish();
    } else if (mode === "context") {
      const entries = this.entries().filter(
        (entry, idx) => idx <= this.queue.index || entry.isManual,
      );
      this.queueEntries.set(this.queue, entries);
      this.queue.trackIds = entries.map((e) => e.trackId);
      this.publish();
    }
    this.save();
  }

  shuffle() {
    const entries = this.entries();
    if (entries.length <= 1) {
      this.queue.shuffle = !this.queue.shuffle;
      this.queue.shuffleOriginalTrackIds = [];
      this.publish();
      this.save();
      return;
    }

    const currentIndex = Math.max(
      0,
      Math.min(this.queue.index, entries.length - 1),
    );
    const currentEntry = entries[currentIndex];

    if (!this.queue.shuffle) {
      this.queue.shuffleOriginalTrackIds = [...this.queue.trackIds];
      const otherEntries = entries.filter((_, index) => index !== currentIndex);
      const eligibleEntries = otherEntries.filter(
        (entry) => !this.isTrackExcludedFromShuffle(entry.trackId),
      );
      const poolToShuffle =
        eligibleEntries.length > 0 ? eligibleEntries : otherEntries;
      const shuffledOthers = shuffleArray(poolToShuffle);
      const nextEntries = [currentEntry, ...shuffledOthers].filter(Boolean);
      this.queueEntries.set(this.queue, nextEntries);
      this.queue.trackIds = nextEntries.map((entry) => entry.trackId);
      this.queue.manualTrackIds = nextEntries
        .filter((entry) => entry.isManual)
        .map((entry) => entry.trackId);
      this.queue.index = 0;
      this.queue.shuffle = true;
    } else {
      const originalIds = this.queue.shuffleOriginalTrackIds || [];
      if (originalIds.length > 0) {
        const pools = new Map<string, QueueEntry[]>();
        for (const entry of entries) {
          if (entry === currentEntry) continue;
          const pool = pools.get(entry.trackId) || [];
          pool.push(entry);
          pools.set(entry.trackId, pool);
        }
        const originalIdx = originalIds.findIndex(
          (id) => id === currentEntry?.trackId,
        );
        const restoreIdx = Math.max(0, originalIdx);
        const upcomingOriginal = originalIds.slice(restoreIdx + 1);
        const previousOriginal = originalIds.slice(0, restoreIdx);
        const orderedOtherIds = [...upcomingOriginal, ...previousOriginal];
        const restoredOthers = orderedOtherIds.map(
          (trackId) =>
            pools.get(trackId)?.shift() || {
              trackId,
              id: `desktop-queue-${++this.entryId}`,
              isManual: this.queue.manualTrackIds.includes(trackId),
            },
        );
        const nextEntries = [currentEntry, ...restoredOthers].filter(Boolean);
        this.queueEntries.set(this.queue, nextEntries);
        this.queue.trackIds = nextEntries.map((entry) => entry.trackId);
        this.queue.manualTrackIds = nextEntries
          .filter((entry) => entry.isManual)
          .map((entry) => entry.trackId);
        this.queue.index = 0;
      }
      this.queue.shuffle = false;
      this.queue.shuffleOriginalTrackIds = [];
    }
    this.publish();
    this.save();
  }

  repeat() {
    this.queue.repeat =
      this.queue.repeat === "off"
        ? "all"
        : this.queue.repeat === "all"
          ? "one"
          : "off";
    this.publish();
    this.save();
  }

  volume(value: number) {
    const clamped = Math.max(0, Math.min(1, value));
    this.persistence.volume = clamped;
    this.applyEffectiveVolumes();
    this.publish({ volume: clamped });
    this.save();
  }

  getVolume(): number {
    return this.persistence.volume;
  }

  speed(value: number) {
    if (Number.isFinite(value) && value >= 0.5 && value <= 2) {
      this.playbackSpeedVal = value;
      if (this.vinylModeVal) {
        this.playbackPitchVal = value;
      }
      this.applySpeedAndPitchToElement(this.audio);
      this.applySpeedAndPitchToElement(this.secondaryAudio);
      this.publish({ speed: this.playbackSpeedVal, pitch: this.playbackPitchVal });
      this.systemMedia?.update(this.view, value);
    }
  }

  pitch(value: number) {
    if (Number.isFinite(value) && value >= 0.5 && value <= 2) {
      this.playbackPitchVal = value;
      if (!this.vinylModeVal) {
        this.applySpeedAndPitchToElement(this.audio);
        this.applySpeedAndPitchToElement(this.secondaryAudio);
      }
      this.publish({ pitch: this.playbackPitchVal });
    }
  }

  vinylMode(enabled: boolean) {
    this.vinylModeVal = Boolean(enabled);
    if (this.vinylModeVal) {
      this.playbackPitchVal = this.playbackSpeedVal;
    }
    this.applySpeedAndPitchToElement(this.audio);
    this.applySpeedAndPitchToElement(this.secondaryAudio);
    this.publish({
      vinylMode: this.vinylModeVal,
      pitch: this.playbackPitchVal,
    });
  }

  ab() {
    if (!this.view.ab)
      this.publish({ ab: { a: this.audio.currentTime, b: null } });
    else if (this.view.ab.b === null && this.audio.currentTime > this.view.ab.a)
      this.publish({ ab: { a: this.view.ab.a, b: this.audio.currentTime } });
    else this.publish({ ab: null });
  }

  private ensureAudioGraph() {
    if (this.context || typeof AudioContext === "undefined") return;
    try {
      this.context = new AudioContext();
      this.primarySource = this.context.createMediaElementSource(this.audio);
      this.secondarySource = this.context.createMediaElementSource(
        this.secondaryAudio,
      );
      this.primaryDeckGain = this.context.createGain();
      this.secondaryDeckGain = this.context.createGain();
      this.primaryDeckGain.gain.value = 1;
      this.secondaryDeckGain.gain.value = 0;

      this.primarySource.connect(this.primaryDeckGain);
      this.secondarySource.connect(this.secondaryDeckGain);

      this.replayGainNode = this.context.createGain();
      this.replayGainNode.gain.value = this.currentReplayGainMultiplier;
      this.primaryDeckGain.connect(this.replayGainNode);
      this.secondaryDeckGain.connect(this.replayGainNode);

      // Bass boost low-shelf filter around 100 Hz
      this.bassBoostNode = this.context.createBiquadFilter();
      this.bassBoostNode.type = "lowshelf";
      this.bassBoostNode.frequency.value = 100;
      this.bassBoostNode.gain.value = this.eqEnabled
        ? (this.bassBoostStrength / 1000) * 12
        : 0;
      this.replayGainNode.connect(this.bassBoostNode);

      let previous: AudioNode = this.bassBoostNode;
      this.bands = EQUALIZER_FREQUENCIES_HZ.map((frequency, index) => {
        const filter = this.context!.createBiquadFilter();
        filter.type = "peaking";
        filter.frequency.value = frequency;
        filter.Q.value = 1;
        filter.gain.value = this.eqEnabled
          ? Math.max(-15, Math.min(15, this.eqGains[index] || 0))
          : 0;
        previous.connect(filter);
        previous = filter;
        return filter;
      });

      // Dual-grain crossfading delay line for independent pitch shifting
      const postEq = previous;
      this.pitchDryGain = this.context.createGain();
      this.pitchWetGain = this.context.createGain();
      this.pitchDryGain.gain.value = 1;
      this.pitchWetGain.gain.value = 0;

      this.pitchDelayA = this.context.createDelay(0.2);
      this.pitchDelayB = this.context.createDelay(0.2);
      this.pitchGainA = this.context.createGain();
      this.pitchGainB = this.context.createGain();
      this.pitchGainA.gain.value = 0;
      this.pitchGainB.gain.value = 0;

      postEq.connect(this.pitchDryGain);
      postEq.connect(this.pitchDelayA);
      postEq.connect(this.pitchDelayB);
      this.pitchDelayA.connect(this.pitchGainA);
      this.pitchDelayB.connect(this.pitchGainB);
      this.pitchGainA.connect(this.pitchWetGain);
      this.pitchGainB.connect(this.pitchWetGain);

      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.8;

      this.pitchDryGain.connect(this.analyser);
      this.pitchWetGain.connect(this.analyser);
      this.analyser.connect(this.context.destination);

      this.updatePitchShifterNode(
        this.vinylModeVal ? 1 : this.playbackPitchVal,
      );
    } catch {
      this.context = null;
    }
  }

  private updatePitchShifterNode(pitchFactor: number) {
    if (
      !this.context ||
      !this.pitchDryGain ||
      !this.pitchWetGain ||
      !this.pitchDelayA ||
      !this.pitchDelayB ||
      !this.pitchGainA ||
      !this.pitchGainB
    ) {
      return;
    }
    const active = Math.abs(pitchFactor - 1) > 0.001;
    const now = this.context.currentTime || 0;
    if (!active) {
      if (this.pitchModTimer) {
        clearInterval(this.pitchModTimer);
        this.pitchModTimer = null;
      }
      this.pitchDryGain.gain.setTargetAtTime(1, now, 0.015);
      this.pitchWetGain.gain.setTargetAtTime(0, now, 0.015);
      return;
    }

    this.pitchDryGain.gain.setTargetAtTime(0, now, 0.015);
    this.pitchWetGain.gain.setTargetAtTime(1, now, 0.015);

    if (!this.pitchModTimer) {
      const windowSec = 0.06; // 60ms grain window
      const tickSec = 0.015;
      const timer = setInterval(() => {
        if (
          !this.context ||
          !this.pitchDelayA ||
          !this.pitchDelayB ||
          !this.pitchGainA ||
          !this.pitchGainB
        )
          return;
        const slope = 1 - (this.vinylModeVal ? 1 : this.playbackPitchVal);
        this.pitchPhase =
          (((this.pitchPhase + (slope * tickSec) / windowSec) % 1) + 1) % 1;
        const phaseA = this.pitchPhase;
        const phaseB = (this.pitchPhase + 0.5) % 1;
        const delayA = phaseA * windowSec;
        const delayB = phaseB * windowSec;
        const gainA = Math.sin(Math.PI * phaseA);
        const gainB = Math.sin(Math.PI * phaseB);
        const t = this.context.currentTime || 0;
        this.pitchDelayA.delayTime.setTargetAtTime(delayA, t, 0.008);
        this.pitchDelayB.delayTime.setTargetAtTime(delayB, t, 0.008);
        this.pitchGainA.gain.setTargetAtTime(gainA, t, 0.008);
        this.pitchGainB.gain.setTargetAtTime(gainB, t, 0.008);
      }, 15);
      (timer as unknown as { unref?: () => void })?.unref?.();
      this.pitchModTimer = timer;
    }
  }

  equalizer(gains: number[], enabled: boolean) {
    this.eqEnabled = Boolean(enabled);
    this.eqGains = EQUALIZER_FREQUENCIES_HZ.map((_, i) =>
      Math.max(-15, Math.min(15, Number(gains[i]) || 0)),
    );
    this.ensureAudioGraph();
    if (!this.context) return;
    const now = this.context.currentTime || 0;
    this.bands.forEach((band, index) =>
      band.gain.setTargetAtTime(
        this.eqEnabled ? this.eqGains[index] : 0,
        now,
        0.02,
      ),
    );
    if (this.bassBoostNode) {
      this.bassBoostNode.gain.setTargetAtTime(
        this.eqEnabled ? (this.bassBoostStrength / 1000) * 12 : 0,
        now,
        0.02,
      );
    }
    void this.context.resume?.();
  }

  bassBoost(strength: number) {
    const clamped = Math.max(
      0,
      Math.min(1000, Number.isFinite(strength) ? Math.round(strength) : 0),
    );
    this.bassBoostStrength = clamped;
    this.ensureAudioGraph();
    if (this.context && this.bassBoostNode) {
      this.bassBoostNode.gain.setTargetAtTime(
        this.eqEnabled ? (this.bassBoostStrength / 1000) * 12 : 0,
        this.context.currentTime || 0,
        0.02,
      );
    }
  }

  setReplayGainSettings(
    enabled: boolean,
    preampDb: number,
    fallbackDb: number,
  ) {
    this.replayGainEnabled = Boolean(enabled);
    this.replayGainPreamp = Number.isFinite(preampDb) ? preampDb : 0;
    this.replayGainFallback = Number.isFinite(fallbackDb) ? fallbackDb : -5;
    this.updateTrackReplayGain(this.view.track);
  }

  setCrossfadeSettings(seconds: number, allowed: boolean) {
    this.crossfadeSeconds = Number.isFinite(seconds)
      ? Math.max(0, Math.min(12, Math.round(seconds)))
      : 0;
    this.crossfadeAllowed = Boolean(allowed);
    if (!this.crossfadeAllowed && this.isCrossfading) {
      this.cancelCrossfade();
    }
  }

  private save() {
    if (typeof window === "undefined" || !window.mmplayer?.invoke) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    const data = structuredClone(this.persistence);
    const t = setTimeout(() => {
      void window.mmplayer
        .invoke("savePlayer", data)
        .catch((error) => this.publish({ error: String(error) }));
    }, 150);
    (t as unknown as { unref?: () => void })?.unref?.();
    this.saveTimer = t;
  }

  async saveNow() {
    if (typeof window === "undefined" || !window.mmplayer?.invoke) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    if (this.view.track) this.queue.position = this.audio.currentTime;
    await window.mmplayer.invoke(
      "savePlayer",
      structuredClone(this.persistence),
    );
  }
}

export const player = new DesktopPlayer();
