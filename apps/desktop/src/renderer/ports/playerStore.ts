import { LyricsSyncService } from "../../../../../src/services/LyricsSyncService";
import { create } from "zustand";
import { player } from "../player";
import { database } from "./database";
import { shuffleArray } from "@mmplayer/core/shuffle";
import TrackPlayer, { RepeatMode } from "./trackPlayer";
import {
  selectShuffleOnQueueEnd,
  useMultipleQueuesStore,
} from "./queues";
import { useSettingsStore } from "../../../../../src/store/useSettingsStore";
import { useToastStore } from "../../../../../src/store/useToastStore";
import { ShuffleService } from "../../../../../src/services/ShuffleService";
import i18n from "../../../../../src/constants/i18n";
import type Track from "../../../../../src/database/models/Track";
import type Album from "../../../../../src/database/models/Album";
import type Artist from "../../../../../src/database/models/Artist";
import type { LibraryTrack } from "@mmplayer/platform";

const queuesHandlingEnd = new Set<number>();
let lastConsumedQueueTransition: string | null = null;
let lastNativeQueueRevision = -1;

export function applyNativeManualQueueSize(
  size: number | undefined,
  revision: number | undefined,
) {
  if (
    size === undefined ||
    revision === undefined ||
    !Number.isFinite(size) ||
    !Number.isFinite(revision) ||
    revision < lastNativeQueueRevision ||
    useMultipleQueuesStore.getState().isSwitching
  )
    return;
  lastNativeQueueRevision = revision;
  usePlayerStore.setState({ userQueueSize: Math.max(0, size) });
}

export function consumeUserQueueTransition(event: {
  track?: { id?: string; isManual?: boolean };
  lastTrack?: { id?: string };
  index?: number;
  lastIndex?: number;
  crossfade?: boolean;
  transitionId?: string;
  queueRevision?: number;
  userQueueSize?: number;
}) {
  if (useMultipleQueuesStore.getState().isSwitching) return;
  if (
    event.queueRevision !== undefined &&
    event.userQueueSize !== undefined
  ) {
    applyNativeManualQueueSize(event.userQueueSize, event.queueRevision);
    return;
  }
  if (event.crossfade && event.transitionId) {
    if (lastConsumedQueueTransition === event.transitionId) return;
    lastConsumedQueueTransition = event.transitionId;
    if (event.track?.isManual) {
      usePlayerStore.setState((state: any) => ({
        userQueueSize: Math.max(0, state.userQueueSize - 1),
      }));
    }
    return;
  }
  if (
    event.index === undefined ||
    event.lastIndex === undefined ||
    event.index <= event.lastIndex
  )
    return;
  if (event.lastTrack?.id && event.lastTrack.id === event.track?.id) return;
  const transition = `${event.lastTrack?.id ?? ""}:${event.track?.id ?? ""}:${event.lastIndex}:${event.index}`;
  if (transition === lastConsumedQueueTransition) return;
  lastConsumedQueueTransition = transition;
  usePlayerStore.setState((state: any) => ({
    userQueueSize: Math.max(
      0,
      state.userQueueSize - (event.index! - event.lastIndex!),
    ),
  }));
}

function trackModelToLibraryTrack(track: Track | any): LibraryTrack {
  const raw = track as Record<string, any>;
  return {
    id: String(raw.id),
    title: typeof raw.title === "string" ? raw.title : String(raw.id),
    artist: typeof raw.artist === "string" ? raw.artist : "",
    artistId: typeof raw.artistId === "string" ? raw.artistId : "",
    album: typeof raw.album === "string" ? raw.album : "",
    albumId: typeof raw.albumId === "string" ? raw.albumId : "",
    duration: typeof raw.duration === "number" ? raw.duration : 0,
    cover: typeof raw.cover === "string" ? raw.cover : null,
    fileUrl:
      typeof raw.fileUrl === "string"
        ? raw.fileUrl
        : `mmplayer-media://track/${raw.id}`,
    available: raw.available !== false,
    isFavorite: Boolean(raw.isFavorite),
    rating: typeof raw.rating === "number" ? raw.rating : null,
    genre: typeof raw.genre === "string" ? raw.genre : null,
    year: typeof raw.year === "number" ? raw.year : null,
    lyricsLRC: typeof raw.lyricsLRC === "string" ? raw.lyricsLRC : null,
    skipSegments:
      typeof raw.skipSegments === "string" ? raw.skipSegments : null,
    trackNumber: typeof raw.trackNumber === "number" ? raw.trackNumber : null,
    discNumber: typeof raw.discNumber === "number" ? raw.discNumber : null,
    replayGain: typeof raw.replayGain === "number" ? raw.replayGain : null,
    replayPeak: typeof raw.replayPeak === "number" ? raw.replayPeak : null,
    isExcludedFromShuffle: Boolean(raw.isExcludedFromShuffle),
  };
}

async function resolveTracks(tracks: Track[]): Promise<LibraryTrack[]> {
  try {
    const snapshot = await window.mmplayer.invoke("library", undefined);
    if (snapshot?.tracks && Array.isArray(snapshot.tracks)) {
      player.setTracks(snapshot.tracks);
      const indexed = new Map(
        snapshot.tracks.map((track) => [track.id, track]),
      );
      return tracks.map(
        (track) => indexed.get(track.id) ?? trackModelToLibraryTrack(track),
      );
    }
  } catch {
    // Fallback when library invoke is mocked or unavailable
  }
  return tracks.map(trackModelToLibraryTrack);
}

const start = async (
  tracks: Track[],
  index: number,
  context = "",
  _instanceIds?: string[],
  autoplay = true,
) => {
  const safeIdx = Math.max(0, Math.min(tracks.length - 1, index));
  usePlayerStore.setState({
    playbackContext: context,
    activeTrack: tracks[safeIdx] ?? null,
    isShuffleEnabled: false,
    isShuffling: false,
    shuffleOriginalQueue: [],
    userQueueSize: 0,
  });
  await player.start(await resolveTracks(tracks), safeIdx, autoplay);
  await usePlayerStore.getState().refreshRecentsFromDatabase();
};

async function refreshRecentTrack(item: any): Promise<{ item: any; modified: boolean }> {
  try {
    const track = await database.collections.get<Track>("tracks").find(item.id);
    if (!track) return { item: null, modified: true };
    const album = await track.album?.fetch?.().catch(() => null);
    const collaborators = (await track.queryCollaborators?.fetch?.().catch(() => [])) as Artist[];
    let artistNames =
      collaborators && collaborators.length > 0
        ? collaborators.map((a) => a.name).join(", ")
        : "";
    if (!artistNames) {
      const primary = await track.artist?.fetch?.().catch(() => null);
      artistNames = primary?.name || item.subtitle || i18n.t("metadata.unknown_artist");
    }
    const imageUrl = album?.coverUrl ?? item.imageUrl ?? null;
    const hasChanged =
      item.title !== track.title ||
      item.subtitle !== artistNames ||
      item.imageUrl !== imageUrl;
    if (hasChanged) {
      return {
        item: {
          ...item,
          title: track.title,
          subtitle: artistNames,
          imageUrl,
        },
        modified: true,
      };
    }
    return { item, modified: false };
  } catch {
    return { item, modified: false };
  }
}

async function refreshRecentAlbum(item: any): Promise<{ item: any; modified: boolean }> {
  try {
    const album = await database.collections.get<Album>("albums").find(item.id);
    if (!album) return { item: null, modified: true };
    const artist = await album.artist?.fetch?.().catch(() => null);
    const artistName = artist?.name || item.subtitle || i18n.t("metadata.various_artists");
    const imageUrl = album.coverUrl ?? item.imageUrl ?? null;
    const hasChanged =
      item.title !== album.title ||
      item.subtitle !== artistName ||
      item.imageUrl !== imageUrl;
    if (hasChanged) {
      return {
        item: {
          ...item,
          title: album.title,
          subtitle: artistName,
          imageUrl,
        },
        modified: true,
      };
    }
    return { item, modified: false };
  } catch {
    return { item, modified: false };
  }
}

async function refreshRecentArtist(item: any): Promise<{ item: any; modified: boolean }> {
  try {
    const artist = await database.collections.get<Artist>("artists").find(item.id);
    if (!artist) return { item: null, modified: true };
    const imageUrl = artist.imageUrl ?? item.imageUrl ?? null;
    const hasChanged =
      item.title !== artist.name || item.imageUrl !== imageUrl;
    if (hasChanged) {
      return {
        item: {
          ...item,
          title: artist.name,
          imageUrl,
        },
        modified: true,
      };
    }
    return { item, modified: false };
  } catch {
    return { item, modified: false };
  }
}

let recentsLoadedFromStorage = false;

export const usePlayerStore = create<any>((set, get) => ({
  activeTrack: null,
  activeTrackInstanceId: null,
  playbackContext: "",
  recentMedia: [],
  recentPlaylists: [],
  isPlaying: false,
  isShuffling: false,
  isShuffleEnabled: false,
  shuffleOriginalQueue: [],
  playbackSpeed: 1,
  playbackPitch: 1,
  isVinylModeEnabled: false,
  queueVersion: 0,
  userQueueSize: 0,
  isQueueLoading: false,
  cancelQueueLoading: async () => {},
  windowVersion: 0,
  isFetchingLyrics: false,
  isSyncingLyrics: false,
  isRestoring: false,
  setIsFetchingLyrics: (value: boolean) => set({ isFetchingLyrics: value }),
  setIsSyncingLyrics: (value: boolean) => set({ isSyncingLyrics: value }),
  decrementUserQueue: () =>
    set((state: any) => ({
      userQueueSize: Math.max(0, (state.userQueueSize || 0) - 1),
    })),
  setPlaybackSpeed: async (speed: number) => {
    player.speed(speed);
    if (get().isVinylModeEnabled) {
      set({ playbackSpeed: speed, playbackPitch: speed });
    } else {
      set({ playbackSpeed: speed });
    }
  },
  setPlaybackPitch: async (pitch: number) => {
    if (get().isVinylModeEnabled) return;
    player.pitch(pitch);
    set({ playbackPitch: pitch });
  },
  setVinylModeEnabled: async (enabled: boolean) => {
    player.vinylMode(enabled);
    if (enabled) {
      set({ isVinylModeEnabled: true, playbackPitch: get().playbackSpeed });
    } else {
      set({ isVinylModeEnabled: false });
    }
  },
  applySpeedAndPitch: async () => {
    const { playbackSpeed, playbackPitch, isVinylModeEnabled } = get();
    player.vinylMode(isVinylModeEnabled);
    player.speed(playbackSpeed);
    if (!isVinylModeEnabled) {
      player.pitch(playbackPitch);
    }
  },
  hasNext: false,
  hasPrevious: false,
  prevTrack: null,
  nextTrack: null,
  setShuffleState: (enabled: boolean, queue: any[]) =>
    set({
      isShuffleEnabled: enabled,
      isShuffling: enabled,
      shuffleOriginalQueue: queue,
    }),
  toggleShuffle: async () => {
    if (!get().isShuffleEnabled) {
      const currentQueue = player.getQueueTracks();
      player.shuffle();
      set({
        isShuffleEnabled: true,
        isShuffling: true,
        shuffleOriginalQueue: currentQueue,
      });
    } else {
      player.shuffle();
      set({
        isShuffleEnabled: false,
        isShuffling: false,
        shuffleOriginalQueue: [],
      });
    }
    await synchronizePlayer();
  },
  playRandomQueueOnEnd: async () => {
    const queueAtStart = useMultipleQueuesStore.getState().activeId;
    const canAutoplay = () =>
      !useMultipleQueuesStore.getState().isSwitching &&
      useMultipleQueuesStore.getState().activeId === queueAtStart &&
      selectShuffleOnQueueEnd(useMultipleQueuesStore.getState());
    if (!canAutoplay()) return;

    if (queuesHandlingEnd.has(queueAtStart)) return;
    if (get().isQueueLoading) return;
    queuesHandlingEnd.add(queueAtStart);

    try {
      const repeatMode = await TrackPlayer.getRepeatMode();
      if (repeatMode !== RepeatMode.Off || !canAutoplay()) return;

      const availableTracks = await ShuffleService.getEligibleShuffleTracks();
      if (availableTracks.length === 0 || !canAutoplay()) return;

      useToastStore
        .getState()
        .showToast(
          i18n.t(
            "queue.random_autoplay_started",
            "Cola finalizada: iniciando reproducción aleatoria",
          ),
          "shuffle",
        );
      await get().startShuffled(availableTracks, "random_queue_end");
    } catch (e) {
      console.error("[usePlayerStore] Error in playRandomQueueOnEnd:", e);
    } finally {
      const resetTimer = setTimeout(() => {
        queuesHandlingEnd.delete(queueAtStart);
      }, 2000);
      (resetTimer as unknown as { unref?: () => void })?.unref?.();
    }
  },
  skipToNext: async () => {
    const shuffleOnQueueEnd = selectShuffleOnQueueEnd(
      useMultipleQueuesStore.getState(),
    );
    if (shuffleOnQueueEnd) {
      const index = await TrackPlayer.getActiveTrackIndex();
      if (index !== undefined && index !== null) {
        const nextTrack = await TrackPlayer.getTrack(index + 1);
        if (
          !nextTrack &&
          (await TrackPlayer.getRepeatMode()) === RepeatMode.Off
        ) {
          await get().playRandomQueueOnEnd();
          return;
        }
      }
    }
    await player.next();
  },
  updateQueueStatus: () => synchronizePlayer(),
  savePlaybackState: () => player.saveNow(),
  syncWithTrackPlayer: () => synchronizePlayer(),
  setActiveTrackById: async (trackId: string, instanceId?: string) => {
    const cleanId = trackId.split("-")[0];
    const instId =
      instanceId ||
      (trackId.includes("-") ? trackId.substring(cleanId.length + 1) : null);
    if (cleanId.startsWith("ext_")) {
      set({ activeTrackInstanceId: instId });
      return;
    }
    const track = await database
      .get<Track>("tracks")
      .find(cleanId)
      .catch(() => null);
    set({ activeTrack: track, activeTrackInstanceId: instId });
  },
  loadQueue: start,
  playSingleTrack: (track: Track, context = "") => start([track], 0, context),
  startShuffled: async (tracks: Track[], context = "") => {
    if (!tracks.length) return;
    const resolved = await resolveTracks(tracks);
    await player.startShuffled(
      resolved,
      resolved,
      context === "random_queue_end",
    );
    const snap = player.getSnapshot();
    const activeId = snap.track?.id;
    const activeModel =
      tracks.find((t) => t.id === activeId) ?? tracks[0] ?? null;
    set({
      playbackContext: context,
      activeTrack: activeModel,
      isShuffleEnabled: true,
      isShuffling: true,
      shuffleOriginalQueue: resolved.map((t) => ({
        ...t,
        url: t.fileUrl,
        artwork: t.cover || undefined,
      })),
      userQueueSize: 0,
      hasPrevious: false,
      hasNext:
        resolved.length > 1 ||
        selectShuffleOnQueueEnd(useMultipleQueuesStore.getState()),
    });
    await synchronizePlayer();
    await get().refreshRecentsFromDatabase();
  },
  addToQueue: async (tracks: Track[]) => {
    const { queueAddBehavior } = useSettingsStore.getState();
    const resolved = await resolveTracks(tracks);
    player.add(
      resolved,
      queueAddBehavior === "user_queue" ? "after-manual" : "context",
    );
  },
  addNext: async (tracks: Track[]) => {
    const resolved = await resolveTracks(tracks);
    player.add(resolved, true);
  },
  addToQueueNext: async (trackOrTracks: Track | Track[]) => {
    const list = Array.isArray(trackOrTracks) ? trackOrTracks : [trackOrTracks];
    const resolved = await resolveTracks(list);
    player.add(resolved, true);
  },
  addToQueueEnd: async (trackOrTracks: Track | Track[]) => {
    const list = Array.isArray(trackOrTracks) ? trackOrTracks : [trackOrTracks];
    const resolved = await resolveTracks(list);
    const { queueAddBehavior } = useSettingsStore.getState();
    player.add(
      resolved,
      queueAddBehavior === "user_queue" ? "after-manual" : "context",
    );
  },
  addMultipleToQueueNext: async (tracks: Track[]) => {
    const resolved = await resolveTracks(tracks);
    player.add(resolved, true);
  },
  addMultipleToQueueEnd: async (tracks: Track[]) => {
    const resolved = await resolveTracks(tracks);
    const { queueAddBehavior } = useSettingsStore.getState();
    player.add(
      resolved,
      queueAddBehavior === "user_queue" ? "after-manual" : "context",
    );
  },
  clearPlayer: async () => {
    player.clearQueue("all");
    set({
      activeTrack: null,
      activeTrackInstanceId: null,
      prevTrack: null,
      nextTrack: null,
      playbackContext: "",
      hasNext: false,
      hasPrevious: false,
      isShuffleEnabled: false,
      isShuffling: false,
      shuffleOriginalQueue: [],
      userQueueSize: 0,
    });
  },
  clearUserQueue: async () => {
    player.clearQueue("manual");
    set({ userQueueSize: 0 });
  },
  clearContextQueue: async () => {
    player.clearQueue("context");
  },
  handleDeletedEntities: async (
    deletedTracks: string[] = [],
    deletedAlbums: string[] = [],
    deletedArtists: string[] = [],
  ) => {
    if (deletedTracks.length > 0) player.removeTracks(deletedTracks);
    const removedIds = new Set([
      ...deletedTracks,
      ...deletedAlbums,
      ...deletedArtists,
    ]);
    if (removedIds.size > 0) {
      set({
        recentMedia: get().recentMedia.filter(
          (item: any) => !removedIds.has(item.id),
        ),
      });
      await get().saveRecentsState();
    }
  },
  updateTrackMetadata: async (trackId?: string) => {
    try {
      const snapshot = await window.mmplayer.invoke("library", undefined);
      if (snapshot?.tracks) player.setTracks(snapshot.tracks);
    } catch {
      // Ignore if invoke is mocked without library
    }
    if (trackId) {
      try {
        const track = await database.get<Track>("tracks").find(trackId);
        if (track) {
          const album = await track.album?.fetch?.().catch(() => null);
          const collaborators = (await track.queryCollaborators
            ?.fetch?.()
            .catch(() => [])) as Artist[];
          let artist =
            collaborators && collaborators.length > 0
              ? collaborators.map((a) => a.name).join(", ")
              : "";
          if (!artist) {
            const primary = await track.artist?.fetch?.().catch(() => null);
            artist = primary?.name || i18n.t("metadata.unknown_artist");
          }
          const title = track.title;
          const albumTitle = album?.title || i18n.t("metadata.unknown_album");
          const artwork = album?.coverUrl || null;
          let recentsModified = false;
          const updatedRecentMedia = get().recentMedia.map((item: any) => {
            if (item.type === "track" && item.id === trackId) {
              recentsModified = true;
              return { ...item, title, subtitle: artist, imageUrl: artwork };
            }
            if (item.type === "album" && album?.id && item.id === album.id) {
              recentsModified = true;
              return { ...item, title: albumTitle, imageUrl: artwork };
            }
            return item;
          });
          if (recentsModified) {
            set({ recentMedia: updatedRecentMedia });
            await get().saveRecentsState();
          }
        }
      } catch {
        // Ignore missing track model
      }
    }
    await synchronizePlayer();
  },
  checkAndPauseIfTracksActiveOrQueued: async (trackIds: string[]) => {
    if (!trackIds || trackIds.length === 0) return false;
    const setIds = new Set(trackIds);
    const snap = player.getSnapshot();
    const queue = snap.queues[snap.activeQueue];
    const activeStoreId = get().activeTrack?.id;
    if (
      (activeStoreId && setIds.has(activeStoreId)) ||
      (snap.track && setIds.has(snap.track.id)) ||
      queue.trackIds.some((id) => setIds.has(id.split("-")[0]))
    ) {
      await player.pause(true);
      return true;
    }
    return false;
  },
  handleRelocatedTracks: async (trackIds: string[]) => {
    if (!trackIds || trackIds.length === 0) return;
    const targetSet = new Set(trackIds);
    const activeId = get().activeTrack?.id ?? player.getSnapshot().track?.id;
    if (activeId && targetSet.has(activeId)) {
      await player.pause(true);
      await get().clearPlayer();
      return;
    }
    await synchronizePlayer();
  },
  togglePlay: () => player.toggle(),
  play: () => player.play(),
  pause: () => player.pause(),
  skipNext: () => get().skipToNext(),
  skipPrevious: () => player.previous(),
  addMediaToRecents: (item: any) => {
    const current = get().recentMedia || [];
    const filtered = current.filter(
      (value: any) => !(value.id === item.id && value.type === item.type),
    );
    const updated = [{ ...item, timestamp: Date.now() }, ...filtered].slice(
      0,
      6,
    );
    set({ recentMedia: updated });
    void get()
      .saveRecentsState()
      .catch((err: unknown) => console.error("Error saving recents:", err));
  },
  addPlaylistToRecents: (item: any) => {
    const current = get().recentPlaylists || [];
    const filtered = current.filter((value: any) => value.id !== item.id);
    const updated = [{ ...item, timestamp: Date.now() }, ...filtered].slice(
      0,
      10,
    );
    set({ recentPlaylists: updated });
    void get()
      .saveRecentsState()
      .catch((err: unknown) => console.error("Error saving recents:", err));
  },
  removePlaylistFromRecents: (id: string) => {
    const current = get().recentPlaylists || [];
    const updated = current.filter((item: any) => item.id !== id);
    if (updated.length !== current.length) {
      set({ recentPlaylists: updated });
      void get()
        .saveRecentsState()
        .catch((err: unknown) => console.error("Error saving recents:", err));
    }
  },
  updatePlaylistCoverInRecents: (id: string, coverUrl: string | null) => {
    const current = get().recentPlaylists || [];
    let modified = false;
    const updated = current.map((item: any) => {
      if (item.id === id && item.imageUrl !== coverUrl) {
        modified = true;
        return { ...item, imageUrl: coverUrl };
      }
      return item;
    });
    if (modified) {
      set({ recentPlaylists: updated });
      void get()
        .saveRecentsState()
        .catch((err: unknown) => console.error("Error saving recents:", err));
    }
  },
  updateMediaImageInRecents: (
    id: string,
    type: "track" | "album" | "artist",
    imageUrl: string | null,
  ) => {
    const current = get().recentMedia || [];
    let modified = false;
    const updated = current.map((item: any) => {
      if (item.id === id && item.type === type && item.imageUrl !== imageUrl) {
        modified = true;
        return { ...item, imageUrl };
      }
      return item;
    });
    if (modified) {
      set({ recentMedia: updated });
      void get()
        .saveRecentsState()
        .catch((err: unknown) => console.error("Error saving recents:", err));
    }
  },
  saveRecentsState: async () => {
    recentsLoadedFromStorage = true;
    await database.localStorage.set("desktop-recents", {
      media: get().recentMedia,
      playlists: get().recentPlaylists,
    });
  },
  restoreRecentsState: async () => {
    try {
      const saved = await database.localStorage.get<any>("desktop-recents");
      recentsLoadedFromStorage = true;
      if (saved) {
        set({
          recentMedia: Array.isArray(saved.media) ? saved.media : [],
          recentPlaylists: Array.isArray(saved.playlists)
            ? saved.playlists
            : [],
        });
      }
    } catch (error) {
      console.error("Error restoring desktop recents:", error);
    }
  },
  refreshRecentsFromDatabase: async () => {
    try {
      if (!recentsLoadedFromStorage && get().recentMedia.length === 0) {
        await get().restoreRecentsState();
      }
      const currentMedia = get().recentMedia || [];
      if (currentMedia.length === 0) return;

      const results = await Promise.all(
        currentMedia.map((item: any) => {
          if (item.type === "track") return refreshRecentTrack(item);
          if (item.type === "album") return refreshRecentAlbum(item);
          if (item.type === "artist") return refreshRecentArtist(item);
          return Promise.resolve({ item, modified: false });
        }),
      );

      let modified = false;
      const updatedMedia: any[] = [];
      for (const res of results) {
        if (res.modified) modified = true;
        if (res.item) updatedMedia.push(res.item);
      }

      if (modified) {
        set({ recentMedia: updatedMedia });
        await get().saveRecentsState();
      }
    } catch (error) {
      console.error("Error refreshing recents from database:", error);
    }
  },
}));

player.setOnQueueEndShuffleHandler(() =>
  usePlayerStore.getState().playRandomQueueOnEnd(),
);
player.setShuffleExclusionChecker((track) => {
  const excludedSongs = useSettingsStore.getState().excludedSongs || [];
  return excludedSongs.includes(track.fileUrl);
});

let revision = 0;
let queueSignature = "";
let lyricsPrefetchRevision = 0;
let lyricsPrefetchTimer: ReturnType<typeof setTimeout> | undefined;
function prefetchQueueLyrics(index: number, ids: string[]) {
  const request = ++lyricsPrefetchRevision;
  clearTimeout(lyricsPrefetchTimer);
  if (!ids.length) return;
  // Debounce burst changes (shuffle, inserting tracks, switching queues).
  lyricsPrefetchTimer = setTimeout(() => {
    void LyricsSyncService.prefetchForQueue(index, ids, () => request === lyricsPrefetchRevision).catch(error => console.warn("Lyrics prefetch failed:", error));
  }, 150);
}
async function synchronizePlayer() {
  const view = player.getSnapshot();
  const queue = view.queues[view.activeQueue];
  const signature = [view.activeQueue, queue.index, ...queue.trackIds].join(
    ":",
  );
  const changedQueue = signature !== queueSignature;
  queueSignature = signature;
  if (changedQueue) prefetchQueueLyrics(queue.index, [...queue.trackIds]);
  const isLooping = queue.repeat === "all";
  const hasPrev = queue.trackIds.length > 0 && (queue.index > 0 || isLooping);
  const hasNxt =
    queue.trackIds.length > 0 &&
    (queue.index < queue.trackIds.length - 1 ||
      isLooping ||
      queue.shuffleOnEnd);
  usePlayerStore.setState({
    ...(changedQueue
      ? {
          userQueueSize: player
            .getQueueTracks()
            .slice(queue.index + 1)
            .filter((track) => track.isManual).length,
        }
      : {}),
    isPlaying: view.playing,
    isShuffling: queue.shuffle,
    isShuffleEnabled: queue.shuffle,
    hasNext: hasNxt,
    hasPrevious: hasPrev,
    queueVersion:
      usePlayerStore.getState().queueVersion + (changedQueue ? 1 : 0),
  });
  if (
    !changedQueue &&
    usePlayerStore.getState().activeTrack?.id === view.track?.id
  )
    return;
  const request = ++revision;
  const model = (id: string | undefined) =>
    id
      ? database
          .get<Track>("tracks")
          .find(id)
          .catch(() => database.get<Track>("tracks").find(id.split("-")[0]).catch(() => null))
      : Promise.resolve(null);
  const prevIdx =
    queue.index > 0
      ? queue.index - 1
      : isLooping && queue.trackIds.length > 1
        ? queue.trackIds.length - 1
        : -1;
  const nextIdx =
    queue.index + 1 < queue.trackIds.length
      ? queue.index + 1
      : isLooping && queue.trackIds.length > 1
        ? 0
        : -1;
  const [activeTrack, prevTrack, nextTrack] = await Promise.all([
    model(view.track?.id),
    prevIdx >= 0 ? model(queue.trackIds[prevIdx]) : Promise.resolve(null),
    nextIdx >= 0 ? model(queue.trackIds[nextIdx]) : Promise.resolve(null),
  ]);
  if (request === revision)
    usePlayerStore.setState({ activeTrack, prevTrack, nextTrack });
}
player.subscribe(() => {
  void synchronizePlayer().catch(console.error);
});
