import { useSyncExternalStore } from "react";
import { player } from "../player";

export enum State {
  None = "none",
  Ready = "ready",
  Playing = "playing",
  Paused = "paused",
  Buffering = "buffering",
  Loading = "loading",
  Stopped = "stopped",
  Ended = "ended",
  Error = "error",
}

export enum RepeatMode {
  Off,
  Track,
  Queue,
}

export function setIsFadingOut(val: boolean, _nativeManaged = false) {
  player.setIsFadingOut(val);
}

export function getIsFadingOut(): boolean {
  return player.getIsFadingOut();
}

export function setShouldStopFadingOut(_val: boolean) {}
export function getShouldStopFadingOut() {
  return false;
}

export const usePlaybackState = () => ({
  state: useSyncExternalStore(player.subscribe, () => {
    const snap = player.getSnapshot();
    return snap.playing && !snap.fadingOut;
  })
    ? State.Playing
    : State.Paused,
});

export const useProgress = () => {
  const view = useSyncExternalStore(player.subscribe, player.getSnapshot);
  return {
    position: view.position,
    duration: view.duration,
    buffered: view.duration,
  };
};

export const Event = {
  PlaybackState: "state",
  PlaybackActiveTrackChanged: "track",
  PlaybackProgressUpdated: "progress",
};

const getTrack = () => {
  const track = player.getSnapshot().track;
  return track
    ? { ...track, url: track.fileUrl, artwork: track.cover }
    : undefined;
};

export default {
  addEventListener: (event: string, callback: (value: any) => void) => {
    const trackSignature = () => {
      const state = player.getSnapshot();
      const queue = state.queues[state.activeQueue];
      return JSON.stringify([
        state.activeQueue,
        queue.index,
        queue.trackIds,
        queue.manualTrackIds,
      ]);
    };
    const stateSignature = () => {
      const state = player.getSnapshot();
      return state.playing && !state.fadingOut ? State.Playing : State.Paused;
    };
    let prevTrackSig = trackSignature();
    let prevStateSig = stateSignature();
    const stop = player.subscribe(() => {
      const state = player.getSnapshot();
      const queue = state.queues[state.activeQueue];
      if (event === Event.PlaybackActiveTrackChanged) {
        const nextTrackSig = trackSignature();
        if (prevTrackSig === nextTrackSig) return;
        prevTrackSig = nextTrackSig;
        callback({
          track: player.getQueueTracks()[queue.index],
          index: queue.index,
        });
        return;
      }
      if (event === Event.PlaybackState) {
        const nextStateSig = stateSignature();
        if (prevStateSig === nextStateSig) return;
        prevStateSig = nextStateSig;
        callback({ state: nextStateSig });
        return;
      }
      callback({
        track: player.getQueueTracks()[queue.index],
        position: state.position,
        duration: state.duration,
      });
    });
    return { remove: stop };
  },
  getActiveTrack: async () => getTrack(),
  getActiveTrackIndex: async () =>
    player.getSnapshot().queues[player.getSnapshot().activeQueue].index,
  getTrack: async (index: number) => player.getQueueTracks()[index],
  getQueue: async () => player.getQueueTracks(),
  setQueue: async (tracks: any[]) => {
    player.clearQueue("all");
    player.insertQueueEntries(tracks, 0);
  },
  skip: (index: number, initialPosition?: number) =>
    player.skipTo(index, initialPosition ?? 0),
  remove: async (indices: number | number[]) =>
    player.removeQueueEntries(Array.isArray(indices) ? indices : [indices]),
  removeUpcomingTracks: async () => {
    const snap = player.getSnapshot();
    const queue = snap.queues[snap.activeQueue];
    const upcoming = Array.from(
      { length: Math.max(0, queue.trackIds.length - (queue.index + 1)) },
      (_, i) => queue.index + 1 + i,
    );
    if (upcoming.length > 0) player.removeQueueEntries(upcoming);
  },
  move: async (from: number, to: number) => player.moveQueueEntry(from, to),
  add: async (tracks: any[], at?: number) =>
    player.insertQueueEntries(
      Array.isArray(tracks) ? tracks : [tracks],
      at ?? player.getQueueTracks().length,
    ),
  getPlaybackState: async () => ({
    state:
      player.getSnapshot().playing && !player.getIsFadingOut()
        ? State.Playing
        : State.Paused,
  }),
  getRepeatMode: async () =>
    ({ off: RepeatMode.Off, one: RepeatMode.Track, all: RepeatMode.Queue })[
      player.getSnapshot().queues[player.getSnapshot().activeQueue].repeat
    ],
  setRepeatMode: async (mode: RepeatMode) => {
    const desired = {
      [RepeatMode.Off]: "off",
      [RepeatMode.Track]: "one",
      [RepeatMode.Queue]: "all",
    }[mode];
    for (
      let i = 0;
      i < 3 &&
      player.getSnapshot().queues[player.getSnapshot().activeQueue].repeat !==
        desired;
      i++
    )
      player.repeat();
  },
  play: (bypassFade?: boolean) => player.play(bypassFade),
  pause: async (bypassFade?: boolean) => player.pause(bypassFade),
  stop: async () => {
    await player.pause(true);
    player.seek(0);
  },
  reset: async () => player.clearQueue("all"),
  setVolume: async (vol: number) => player.volume(vol),
  getVolume: async () => player.getVolume(),
  setRate: async (rate: number) => player.speed(rate),
  setPitch: async (pitch: number) => player.pitch(pitch),
  seekTo: async (position: number, automatic = false) =>
    player.seek(position, automatic),
  getProgress: async () => ({
    position: player.getSnapshot().position,
    duration: player.getSnapshot().duration,
    buffered: player.getSnapshot().duration,
  }),
  skipToNext: () => player.next(),
  skipToPrevious: () => player.previous(),
  updateMetadataForTrack: async () => {},
  updateNowPlayingMetadata: async () => {},
};
