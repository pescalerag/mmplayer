import TrackPlayer from "./trackPlayer";
import type Track from "../../../../../src/database/models/Track";
import { database } from "./database";
import { useTimestampStore } from "../../../../../src/store/useTimestampStore";
import { useABRepeatStore } from "./abRepeat";
import { useCastStore } from "./castStore";
import {
  EMPTY_SKIP_CONFIG,
  hasAudibleABRange,
  normalizeSkipSegments,
  parseSkipConfig,
  SkipConfig,
} from "../../../../../src/utils/trackTimestamps";
import { usePlayerStore } from "./playerStore";
import { player } from "../player";

let started = false;
let observedId: string | null = null;
let generation = 0;
let stopObserving: (() => void) | undefined;
let lastPolicy = "";

export const TimestampService = {
  async initialize() {
    if (started) return;
    started = true;
    const configure = () => {
      const state = useTimestampStore.getState();
      const cast = useCastStore.getState();
      const ab = useABRepeatStore.getState();
      const preview = state.previewTrackId === state.trackId;
      const config = preview
        ? state.previewConfig ?? { enabled: false, segments: [] }
        : state.config;
      const blocked =
        Boolean(cast.isServerRunning) ||
        Boolean(cast.isLocalCastActive) ||
        Boolean(cast.isChromecastConnected) ||
        Boolean(usePlayerStore.getState().isSyncingLyrics) ||
        (preview && !state.previewConfig);
      const policy = JSON.stringify({
        trackId: state.trackId,
        config,
        blocked,
        pointA: preview ? -1 : ab.pointA ?? -1,
        pointB: preview ? -1 : ab.pointB ?? -1,
      });
      if (lastPolicy === policy) return;
      lastPolicy = policy;
      player.configureTimestamps(policy);
    };

    const resolveActiveId = (): string | null => {
      const playerTrackId = player.getSnapshot().track?.id;
      if (playerTrackId) return playerTrackId;
      return usePlayerStore.getState().activeTrack?.id ?? null;
    };

    const observe = async (id: string | null) => {
      if (observedId === id) return;
      observedId = id;
      const revision = ++generation;
      stopObserving?.();
      stopObserving = undefined;

      const storeTrack = usePlayerStore.getState().activeTrack;
      const playerTrack = player.getSnapshot().track;
      const immediateSource =
        storeTrack?.id === id
          ? storeTrack
          : playerTrack?.id === id
            ? playerTrack
            : null;
      const initialConfig = immediateSource
        ? parseSkipConfig(
            immediateSource.skipSegments,
            (immediateSource.duration || 0) * 1000,
          )
        : EMPTY_SKIP_CONFIG;
      useTimestampStore.setState({ trackId: id, config: initialConfig });
      if (!id) return;

      const model = await database
        .get<Track>("tracks")
        .find(id)
        .catch(() => null);
      if (!model || revision !== generation) return;
      const subscription = model.observe().subscribe((record) => {
        if (revision !== generation) return;
        const nextConfig = parseSkipConfig(
          record.skipSegments,
          record.duration * 1000,
        );
        if (
          JSON.stringify(nextConfig) !==
          JSON.stringify(useTimestampStore.getState().config)
        ) {
          useTimestampStore.setState({ config: nextConfig });
        }
      });
      stopObserving = () => subscription.unsubscribe();
    };

    useTimestampStore.subscribe(configure);
    useABRepeatStore.subscribe(configure);
    useCastStore.subscribe(configure);
    usePlayerStore.subscribe((state, previous) => {
      if (state.activeTrack?.id !== previous.activeTrack?.id) {
        void observe(resolveActiveId());
      }
      if (state.isSyncingLyrics !== previous.isSyncingLyrics) {
        configure();
      }
    });
    player.subscribe(() => {
      const id = resolveActiveId();
      if (id !== observedId) {
        void observe(id);
      } else if (id) {
        const snapTrack = player.getSnapshot().track;
        if (
          snapTrack?.id === id &&
          snapTrack.skipSegments &&
          useTimestampStore.getState().config.segments.length === 0
        ) {
          const parsed = parseSkipConfig(
            snapTrack.skipSegments,
            (snapTrack.duration || 0) * 1000,
          );
          if (parsed.segments.length > 0) {
            useTimestampStore.setState({ config: parsed });
          }
        }
      }
    });

    await observe(resolveActiveId());
    configure();
  },

  async save(track: Track, config: SkipConfig) {
    const segments = normalizeSkipSegments(
      config.segments,
      track.duration * 1000,
    );
    const ab = useABRepeatStore.getState();
    if (
      useTimestampStore.getState().trackId === track.id &&
      ab.pointA !== null &&
      ab.pointB !== null &&
      !hasAudibleABRange(ab.pointA, ab.pointB, { ...config, segments })
    ) {
      throw new Error("ab_range");
    }
    const value = JSON.stringify({ ...config, segments });
    await window.mmplayer.invoke("saveTimestamps", {
      trackId: track.id,
      value,
    });
    await usePlayerStore.getState().updateTrackMetadata(track.id);
    if (
      useTimestampStore.getState().trackId === track.id ||
      player.getSnapshot().track?.id === track.id
    ) {
      useTimestampStore.setState({
        trackId: track.id,
        config: { ...config, segments },
      });
    }
  },

  async markSeek(_position: number, _automatic = false) {},
  async finishSeek() {},
  async seekAutomatically(position: number) {
    await TrackPlayer.seekTo(position, true);
  },
  nativeHandlesAB() {
    return false;
  },
  async prepareEditorTrack(track: Track) {
    const active = await TrackPlayer.getActiveTrack();
    if (String(active?.id || "").split("-")[0] !== track.id) {
      await usePlayerStore
        .getState()
        .loadQueue([track], 0, `timestamps:${track.id}`, undefined, false);
    }
  },
};
