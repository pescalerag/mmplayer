import { Collection } from "@nozbe/watermelondb";
import { createMMKV } from "react-native-mmkv";
import TrackPlayer, { RepeatMode, Track as TPTrack } from "react-native-track-player";
import { create } from "zustand";
import i18n from "../constants/i18n";
import { database } from "../database";
import Album from "../database/models/Album";
import Artist from "../database/models/Artist";
import Track from "../database/models/Track";
import { navigationRef } from '../navigation/navigationRef';
import { HistoryService } from "../services/HistoryService";
import { LocalCastService } from "../services/LocalCastService";
import { PlaybackTimeTracker } from "../services/PlaybackService";
import { ShuffleService } from "../services/ShuffleService";
import { shuffleArray } from "../utils/shuffle";
import { useCastStore } from "./useCastStore";
import { useSettingsStore } from "./useSettingsStore";
import { useToastStore } from "./useToastStore";
import { refreshPlaybackSnapshot } from "./usePlaybackSnapshotStore";
import { beginQueueSnapshotRead, publishNativeQueue } from "./useQueueSnapshotStore";

const storage = createMMKV();
const PERSISTENCE_KEY = "@player_persistence";
const RECENTS_KEY = "@player_recents";
let isHandlingQueueEnded = false;
let instanceCounter = 0;
let queueStatusRevision = 0;
let activeTrackRevision = 0;
let lastConsumedQueueTransition: string | null = null;

// The service and mounted UI receive the same native event. Consume manual
// entries once, and ignore index shifts caused by inserting the playing item.
export function consumeUserQueueTransition(event: { track?: TPTrack | { id?: string }; lastTrack?: TPTrack | { id?: string }; index?: number; lastIndex?: number }) {
  if (event.index === undefined || event.lastIndex === undefined || event.index <= event.lastIndex) return;
  if (event.lastTrack?.id && event.lastTrack.id === event.track?.id) return;
  const transition = `${event.lastTrack?.id ?? ''}:${event.track?.id ?? ''}:${event.lastIndex}:${event.index}`;
  if (transition === lastConsumedQueueTransition) return;
  lastConsumedQueueTransition = transition;
  usePlayerStore.setState(state => ({
    userQueueSize: Math.max(0, state.userQueueSize - (event.index! - event.lastIndex!)),
  }));
}

let isApplyingSpeedAndPitch = false;
let hasPendingSpeedPitchUpdate = false;
let lastAppliedSpeed: number | null = null;
let lastAppliedPitch: number | null = null;
let saveStateDebounceTimeout: any = null;

function scheduleDebouncedSavePlaybackState() {
  if (saveStateDebounceTimeout) {
    clearTimeout(saveStateDebounceTimeout);
  }
  saveStateDebounceTimeout = setTimeout(() => {
    saveStateDebounceTimeout = null;
    usePlayerStore.getState().savePlaybackState().catch((e) => {
      console.error("[usePlayerStore] Error en savePlaybackState diferido:", e);
    });
  }, 800);
  saveStateDebounceTimeout?.unref?.();
}

function resolveTargetSpeedAndPitch(state: { playbackSpeed: number; isVinylModeEnabled: boolean; playbackPitch: number }) {
  const speed = Number.isFinite(state.playbackSpeed) && state.playbackSpeed > 0
    ? state.playbackSpeed
    : 1.0;
  const rawPitch = state.isVinylModeEnabled ? speed : (state.playbackPitch ?? 1.0);
  const pitch = Number.isFinite(rawPitch) && rawPitch > 0
    ? rawPitch
    : 1.0;
  return { speed, pitch };
}

async function applyTargetSpeedAndPitch(speed: number, pitch: number) {
  if (speed !== lastAppliedSpeed) {
    lastAppliedSpeed = speed;
    await TrackPlayer.setRate(speed);
  }
  if (pitch !== lastAppliedPitch) {
    lastAppliedPitch = pitch;
    await (TrackPlayer as any).setPitch(pitch);
  }
}

function getAdjacentTrackIndex(currentIndex: number, offset: number, queueLength: number, isLooping: boolean): number {
  let targetIndex = currentIndex + offset;
  if (targetIndex < 0 && isLooping && queueLength > 1) {
    targetIndex = queueLength - 1;
  } else if (targetIndex >= queueLength && isLooping && queueLength > 1) {
    targetIndex = 0;
  }
  return targetIndex;
}

async function fetchTrackModelFromQueue(queue: any[], targetIndex: number, currentIndex: number): Promise<Track | null> {
  if (targetIndex < 0 || targetIndex >= queue.length || targetIndex === currentIndex) {
    return null;
  }
  const track = queue[targetIndex];
  if (!track?.id) {
    return null;
  }
  const cleanId = track.id.toString().split('-')[0];
  return database.get<Track>('tracks').find(cleanId).catch(() => null);
}

async function restorePlaybackPosition(position: number): Promise<void> {
  if (position <= 0) return;

  // Wait for metadata/duration to load (up to 3 seconds)
  const pollDuration = async (attemptsLeft: number): Promise<boolean> => {
    if (attemptsLeft <= 0) return false;
    const progress = await TrackPlayer.getProgress();
    if (progress.duration > 0) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
    return pollDuration(attemptsLeft - 1);
  };

  const loaded = await pollDuration(30);

  if (loaded) {
    await TrackPlayer.seekTo(position);
    console.log(`[Store] Restaurado minutaje a la posición: ${position}s`);
  } else {
    console.warn(`[Store] No se pudo restaurar el minutaje (posición: ${position}s) porque el track no cargó a tiempo.`);
  }
}

async function restoreActiveTrackModel(
  activeTPTrack: TPTrack | undefined,
  accumulatedTime: number
): Promise<{ trackModel: Track | null; activeTrackInstanceId: string | null }> {
  if (!activeTPTrack?.id) {
    return { trackModel: null, activeTrackInstanceId: null };
  }

  let trackModel: Track | null = null;
  let activeTrackInstanceId: string | null = null;

  try {
    const cleanId = activeTPTrack.id.split('-')[0];
    activeTrackInstanceId =
      (activeTPTrack as any).instanceId ||
      (activeTPTrack.id.includes('-') ? activeTPTrack.id.substring(cleanId.length + 1) : null);
    trackModel = await database.get<Track>("tracks").find(cleanId);

    if (accumulatedTime > 0) {
      PlaybackTimeTracker.setAccumulatedSeconds(activeTPTrack.id.toString(), accumulatedTime);
      console.log(`[Store] Restaurado tracker con ${accumulatedTime}s acumulados para track: ${activeTPTrack.id}`);
    }
  } catch (dbError) {
    console.warn("[Store] No se encontró el modelo en WatermelonDB:", dbError);
  }

  return { trackModel, activeTrackInstanceId };
}

async function updateRelocatedQueueTracks(queue: TPTrack[], relocatedIndices: number[]): Promise<void> {
  const updates = await Promise.all(
    relocatedIndices.map(async (index) => {
      const item = queue[index];
      if (!item?.id) return null;
      const originalId = (item.id as string).split('-')[0];
      const updatedModel = await database.get<Track>("tracks").find(originalId).catch(() => null);
      if (!updatedModel) return null;
      const newTPTrack = await mapToTPTrack(updatedModel, (item as any).instanceId);
      return { index, newTPTrack };
    })
  );

  // Actualizar en orden inverso para preservar índices
  const sortedUpdates = updates
    .filter((u): u is { index: number; newTPTrack: TPTrack } => u !== null)
    .sort((a, b) => b.index - a.index);

  const applyUpdates = async (i: number): Promise<void> => {
    if (i >= sortedUpdates.length) return;
    const { index, newTPTrack } = sortedUpdates[i];
    await TrackPlayer.remove(index);
    await TrackPlayer.add(newTPTrack, index);
    return applyUpdates(i + 1);
  };

  await applyUpdates(0);
}

async function updateRelocatedShuffleQueue(
  shuffleOriginalQueue: TPTrack[],
  relocatedTrackIds: string[]
): Promise<TPTrack[]> {
  if (shuffleOriginalQueue.length === 0) return shuffleOriginalQueue;
  const relocatedSet = new Set(relocatedTrackIds);
  return Promise.all(
    shuffleOriginalQueue.map(async (t) => {
      if (!t?.id) return t;
      const origId = (t.id as string).split('-')[0];
      if (relocatedSet.has(origId)) {
        const updatedModel = await database.get<Track>("tracks").find(origId).catch(() => null);
        if (updatedModel) {
          return await mapToTPTrack(updatedModel, (t as any).instanceId);
        }
      }
      return t;
    })
  );
}

async function mapToTPTrack(track: Track, instanceId?: string): Promise<TPTrack> {
  const album = await track.album?.fetch?.().catch(() => null);
  const artists = (await track.queryCollaborators?.fetch?.().catch(() => [])) as Artist[];
  let artistNames =
    artists && artists.length > 0
      ? artists.map((a) => a.name).join(", ")
      : "";

  if (!artistNames) {
    const primaryArtist = await track.artist?.fetch?.().catch(() => null);
    artistNames = primaryArtist?.name || (track as any)?.artistName || "Artista desconocido";
  }

  const uniqueSuffix = instanceId || `${Date.now()}-${++instanceCounter}`;

  return {
    id: `${track.id}-${uniqueSuffix}`,
    url: track.fileUrl,
    title: track.title,
    artist: artistNames,
    album: album?.title || (track as any)?.albumTitle || "Álbum desconocido",
    artwork: album?.coverUrl || (track as any)?.coverUrl || undefined,
    duration: track.duration,
    instanceId: instanceId || uniqueSuffix,
    replayGain: track.replayGain ?? null,
    replayPeak: track.replayPeak ?? null,
  };
}

interface PlayerState {
  activeTrack: Track | null;
  activeTrackInstanceId: string | null;
  prevTrack: Track | null;
  nextTrack: Track | null;
  playbackContext: string | null;
  hasNext: boolean;
  hasPrevious: boolean;
  isShuffleEnabled: boolean;
  shuffleOriginalQueue: TPTrack[];
  userQueueSize: number;
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => Promise<void>;
  playbackPitch: number;
  setPlaybackPitch: (pitch: number) => Promise<void>;
  isVinylModeEnabled: boolean;
  setVinylModeEnabled: (enabled: boolean) => Promise<void>;
  applySpeedAndPitch: () => Promise<void>;
  isLyricsVisible: boolean;
  setLyricsVisible: (visible: boolean) => void;
  loadQueue: (
    tracks: Track[],
    index: number,
    context?: string,
    instanceIds?: string[],
  ) => Promise<void>;
  startShuffled: (tracks: Track[], context?: string, instanceIds?: string[]) => Promise<void>;
  playRandomQueueOnEnd: () => Promise<void>;
  skipToNext: () => Promise<void>;
  playSingleTrack: (track: Track, context?: string) => Promise<void>;
  setActiveTrackById: (trackId: string, instanceId?: string) => Promise<void>;
  addToQueueNext: (track: Track) => Promise<void>;
  addToQueueEnd: (track: Track) => Promise<void>;
  addMultipleToQueueNext: (tracks: Track[]) => Promise<void>;
  addMultipleToQueueEnd: (tracks: Track[]) => Promise<void>;
  updateQueueStatus: (currentIndex?: number) => Promise<void>;
  cancelQueueLoading: () => Promise<void>;
  clearPlayer: () => Promise<void>;
  setShuffleState: (enabled: boolean, queue: TPTrack[]) => void;
  toggleShuffle: () => Promise<void>;
  decrementUserQueue: () => void;
  clearUserQueue: () => Promise<void>;
  clearContextQueue: () => Promise<void>;
  savePlaybackState: () => Promise<void>;
  restorePlaybackState: () => Promise<void>;
  saveRecentsState: () => Promise<void>;
  restoreRecentsState: () => Promise<void>;
  recentMedia: RecentItem[];
  recentPlaylists: RecentPlaylist[];
  addMediaToRecents: (item: Omit<RecentItem, "timestamp">) => void;
  addPlaylistToRecents: (item: Omit<RecentPlaylist, "timestamp">) => void;
  updatePlaylistCoverInRecents: (playlistId: string, imageUrl: string | null) => void;
  removePlaylistFromRecents: (playlistId: string) => void;
  updateMediaImageInRecents: (id: string, type: RecentItem["type"], imageUrl: string | null) => void;
  handleDeletedEntities: (trackIds: string[], albumIds: string[], artistIds: string[]) => Promise<void>;
  handleRelocatedTracks: (relocatedTrackIds: string[]) => Promise<void>;
  checkAndPauseIfTracksActiveOrQueued: (trackIds: string[]) => Promise<boolean>;
  isRestoring: boolean;
  isQueueLoading: boolean;
  isSyncingLyrics: boolean;
  setIsSyncingLyrics: (value: boolean) => void;
  isFetchingLyrics: boolean;
  setIsFetchingLyrics: (value: boolean) => void;
  queueVersion: number;
  windowVersion: number;
  updateTrackMetadata: (trackId: string) => Promise<void>;
  refreshRecentsFromDatabase: () => Promise<void>;
  syncWithTrackPlayer: () => Promise<void>;
}

export type RecentItem = {
  id: string;
  type: "track" | "album" | "artist";
  title: string;
  subtitle: string;
  imageUrl: string | null;
  timestamp: number;
};

export type RecentPlaylist = {
  id: string;
  name: string;
  description: string | null;
  imageUrl?: string | null;
  timestamp: number;
};

function shouldTrackHistory(activeTrack: any): boolean {
  if (!activeTrack?.id || activeTrack.isExternal) return false;
  return !activeTrack.id.toString().startsWith('ext_');
}

async function flushCurrentTrackToHistory() {
  try {
    const { activeTrack } = usePlayerStore.getState();
    if (!shouldTrackHistory(activeTrack)) {
      return;
    }

    PlaybackTimeTracker.onStateNotPlaying();

    const activeIndex = await TrackPlayer.getActiveTrackIndex();
    const queue = await TrackPlayer.getQueue();
    const activeTPTrack = activeIndex != null ? queue[activeIndex] : null;

    const trackingId = activeTPTrack?.id ? activeTPTrack.id.toString() : activeTrack!.id.toString();

    const rawPlayed = PlaybackTimeTracker.getAccumulatedSeconds(trackingId);
    const trackDuration = activeTrack!.duration;
    const durationPlayed = trackDuration && rawPlayed > trackDuration ? trackDuration : rawPlayed;
    const requiredSeconds = trackDuration ? trackDuration * 0.5 : 20;

    if (durationPlayed >= requiredSeconds) {
      console.log(`[Historial] Guardando en historial. Canción: ${activeTrack!.id.toString()}, Duración: ${Math.floor(durationPlayed)}s.`);
      await HistoryService.logToDatabase(activeTrack!.id.toString(), durationPlayed, "manual");
    } else {
      console.log(`[Historial] Canción descartada (escuchada ${Math.floor(durationPlayed)}s, requiere ${Math.floor(requiredSeconds)}s).`);
    }

    PlaybackTimeTracker.clearAccumulated(trackingId);
  } catch (e) {
    console.error("Error flushing history before reset:", e);
  }
}

let currentLoadId = 0;
let activeBatchPromise: Promise<any> | null = null;

async function addTracksSafely(tpTracks: TPTrack[], insertIndex?: number) {
  const promise = insertIndex !== undefined
    ? TrackPlayer.add(tpTracks, insertIndex)
    : TrackPlayer.add(tpTracks);
  activeBatchPromise = promise;
  try {
    await promise;
  } finally {
    if (activeBatchPromise === promise) {
      activeBatchPromise = null;
    }
  }
}

async function removeIndicesInChunks(indices: number[]): Promise<void> {
  const CHUNK_SIZE = 50;
  const processChunk = async (i: number): Promise<void> => {
    if (i >= indices.length) return;
    const chunk = indices.slice(i, i + CHUNK_SIZE);
    await TrackPlayer.remove(chunk);
    await new Promise((resolve) => setTimeout(resolve, 30));
    return processChunk(i + CHUNK_SIZE);
  };
  await processChunk(0);
}

async function setupShuffledPlayback(
  initialTpTracks: TPTrack[],
  context: string,
  loadId: number,
  applySpeedAndPitch: () => Promise<void>
) {
  if (context === 'random_queue_end') {
    const existingQueue = await TrackPlayer.getQueue();
    const existingLength = existingQueue.length;

    await addTracksSafely(initialTpTracks);
    if (currentLoadId !== loadId) return;

    if (existingLength > 0) {
      await TrackPlayer.skip(existingLength);
    }

    await applySpeedAndPitch();
    if (useCastStore.getState().isServerRunning) {
      LocalCastService.setPlayIntent(true);
    }
    await TrackPlayer.play();

    if (existingLength > 0) {
      const oldIndices = Array.from({ length: existingLength }, (_, i) => i);
      await TrackPlayer.remove(oldIndices).catch(() => { });
    }
  } else {
    await TrackPlayer.stop().catch(() => { });
    await TrackPlayer.reset();
    lastAppliedSpeed = null;
    lastAppliedPitch = null;
    useCastStore.setState({ castPosition: 0 });
    await addTracksSafely(initialTpTracks);

    if (currentLoadId !== loadId) return;

    await applySpeedAndPitch();
    if (useCastStore.getState().isServerRunning) {
      LocalCastService.setPlayIntent(true);
    }
    await TrackPlayer.play();
  }
}

function loadShuffledOriginalQueueInBackground(
  tracks: Track[],
  instanceIds: string[] | undefined,
  loadId: number,
  set: (state: Partial<PlayerState>) => void,
  savePlaybackState: () => Promise<void>
) {
  void (async () => {
    try {
      const originalTpTracks = await Promise.all(
        tracks.map((t, idx) => mapToTPTrack(t, instanceIds?.[idx]))
      );
      if (currentLoadId === loadId) {
        set({ shuffleOriginalQueue: originalTpTracks });
        await savePlaybackState();
      }
    } catch (bgError) {
      console.error("Background original queue mapping error:", bgError);
    }
  })();
}

async function loadChunkBatch(
  trackList: Track[],
  instanceList: string[] | undefined,
  chunkSize: number,
  loadId: number,
  insertAtStart: boolean,
  updateQueueStatus: () => Promise<void>
) {
  const processChunk = async (i: number, insertIndex: number): Promise<void> => {
    if (i >= trackList.length || currentLoadId !== loadId) return;

    const chunk = trackList.slice(i, i + chunkSize);
    const instChunk = instanceList ? instanceList.slice(i, i + chunkSize) : undefined;
    const tpChunk = await Promise.all(chunk.map((t, cIdx) => mapToTPTrack(t, instChunk?.[cIdx])));
    if (currentLoadId !== loadId) return;

    if (insertAtStart) {
      await addTracksSafely(tpChunk, insertIndex);
    } else {
      await addTracksSafely(tpChunk);
    }

    if (currentLoadId !== loadId) return;
    await updateQueueStatus();
    await new Promise((resolve) => setTimeout(resolve, 100));

    return processChunk(i + chunkSize, insertIndex + chunk.length);
  };

  await processChunk(0, 0);
}

function loadShuffledRemainingChunksInBackground(
  remainingTracks: Track[],
  remainingInstances: string[] | undefined,
  loadId: number,
  chunkSize: number,
  set: (state: Partial<PlayerState>) => void,
  updateQueueStatus: () => Promise<void>,
  savePlaybackState: () => Promise<void>
) {
  if (remainingTracks.length === 0) {
    set({ isQueueLoading: false });
    return;
  }

  void (async () => {
    try {
      await loadChunkBatch(
        remainingTracks,
        remainingInstances,
        chunkSize,
        loadId,
        false,
        updateQueueStatus
      );
      if (currentLoadId === loadId) {
        await savePlaybackState();
      }
    } catch (bgError) {
      console.error("Background shuffle loading error:", bgError);
    } finally {
      if (currentLoadId === loadId) {
        set({ isQueueLoading: false });
      }
    }
  })();
}

interface QueueRemainingChunksOptions {
  previousTracks: Track[];
  previousInstances: string[] | undefined;
  remainingNextTracks: Track[];
  remainingNextInstances: string[] | undefined;
  chunkSize: number;
  loadId: number;
  set: (state: Partial<PlayerState>) => void;
  updateQueueStatus: () => Promise<void>;
  savePlaybackState: () => Promise<void>;
}

function loadQueueRemainingChunksInBackground({
  previousTracks,
  previousInstances,
  remainingNextTracks,
  remainingNextInstances,
  chunkSize,
  loadId,
  set,
  updateQueueStatus,
  savePlaybackState,
}: QueueRemainingChunksOptions) {
  void (async () => {
    try {
      if (previousTracks.length > 0) {
        await loadChunkBatch(previousTracks, previousInstances, chunkSize, loadId, true, updateQueueStatus);
      }
      if (remainingNextTracks.length > 0) {
        await loadChunkBatch(remainingNextTracks, remainingNextInstances, chunkSize, loadId, false, updateQueueStatus);
      }
      if (currentLoadId === loadId) {
        await savePlaybackState();
      }
    } catch (bgError) {
      console.error("Background queue loading error:", bgError);
    } finally {
      if (currentLoadId === loadId) {
        set({ isQueueLoading: false });
      }
    }
  })();
}

async function resolveTargetTrackPlayerTrack(
  activeTP: TPTrack | null | undefined,
  activeIndex: number | null | undefined
): Promise<TPTrack | null> {
  if (activeTP) return activeTP;
  if (activeIndex !== undefined && activeIndex !== null) {
    const queue = await TrackPlayer.getQueue();
    return queue[activeIndex] || null;
  }
  return null;
}

async function syncActiveTrackFromTP(
  targetTP: TPTrack,
  get: () => PlayerState,
  set: (partial: Partial<PlayerState> | ((state: PlayerState) => Partial<PlayerState>)) => void,
  isCurrent: () => boolean
) {
  const cleanId = targetTP.id.toString().split('-')[0];
  const current = get().activeTrack;
  const instId = (targetTP as any)?.instanceId || (targetTP.id.includes('-') ? targetTP.id.substring(cleanId.length + 1) : null);

  const isExternal = cleanId.startsWith('ext_') || (current && (current as any).isExternal && (current as any).id === cleanId);
  if (isExternal) {
    if (isCurrent() && instId !== get().activeTrackInstanceId) {
      set({ activeTrackInstanceId: instId });
    }
    return;
  }

  if (!current || current.id.toString() !== cleanId) {
    const track = await database.get<Track>("tracks").find(cleanId);
    if (!isCurrent()) return;
    set({
      activeTrack: track,
      activeTrackInstanceId: instId,
      queueVersion: get().queueVersion + 1,
      windowVersion: get().windowVersion + 1,
    });
  } else if (isCurrent()) {
    set({ activeTrackInstanceId: instId });
  }
}

type RefreshRecentResult = { item: RecentItem | null; modified: boolean };

interface RecentCollections {
  tracks: Collection<Track>;
  albums: Collection<Album>;
  artists: Collection<Artist>;
}

async function refreshRecentTrack(
  item: RecentItem,
  tracksCollection: Collection<Track>
): Promise<RefreshRecentResult> {
  try {
    const track = await tracksCollection.find(item.id);
    if (!track) {
      return { item: null, modified: true };
    }

    const album = await track.album.fetch().catch(() => null);
    const collaborators = (await track.queryCollaborators.fetch().catch(() => [])) as Artist[];
    const artistNames =
      collaborators.length > 0
        ? collaborators.map((a) => a.name).join(", ")
        : "Artista desconocido";
    const imageUrl = album?.coverUrl || null;

    const hasChanged = item.title !== track.title || item.subtitle !== artistNames || item.imageUrl !== imageUrl;
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

async function refreshRecentAlbum(
  item: RecentItem,
  albumsCollection: Collection<Album>
): Promise<RefreshRecentResult> {
  try {
    const album = await albumsCollection.find(item.id);
    if (!album) {
      return { item: null, modified: true };
    }

    const artist = await album.artist.fetch().catch(() => null);
    const artistName = artist?.name || "Varios Artistas";
    const imageUrl = album.coverUrl || null;

    const hasChanged = item.title !== album.title || item.subtitle !== artistName || item.imageUrl !== imageUrl;
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

async function refreshRecentArtist(
  item: RecentItem,
  artistsCollection: Collection<Artist>
): Promise<RefreshRecentResult> {
  try {
    const artist = await artistsCollection.find(item.id);
    if (!artist) {
      return { item: null, modified: true };
    }

    const imageUrl = artist.imageUrl || null;
    const hasChanged = item.title !== artist.name || item.imageUrl !== imageUrl;
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

async function refreshRecentItem(
  item: RecentItem,
  collections: RecentCollections
): Promise<RefreshRecentResult> {
  switch (item.type) {
    case "track":
      return refreshRecentTrack(item, collections.tracks);
    case "album":
      return refreshRecentAlbum(item, collections.albums);
    case "artist":
      return refreshRecentArtist(item, collections.artists);
    default:
      return { item, modified: false };
  }
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  activeTrack: null,
  activeTrackInstanceId: null,
  prevTrack: null,
  nextTrack: null,
  playbackContext: null,
  hasNext: false,
  hasPrevious: false,
  isShuffleEnabled: false,
  shuffleOriginalQueue: [],
  userQueueSize: 0,
  playbackSpeed: 1.0,
  playbackPitch: 1.0,
  isVinylModeEnabled: true,
  isLyricsVisible: false,
  recentMedia: [],
  recentPlaylists: [],
  isRestoring: false,
  isQueueLoading: false,
  isSyncingLyrics: false,
  setIsSyncingLyrics: (value) => set({ isSyncingLyrics: value }),
  isFetchingLyrics: false,
  setIsFetchingLyrics: (value) => set({ isFetchingLyrics: value }),
  queueVersion: 0,
  windowVersion: 0,

  cancelQueueLoading: async () => {
    ++currentLoadId;
    set({ isQueueLoading: false });
    if (activeBatchPromise) {
      try {
        await activeBatchPromise;
      } catch { }
    }
  },

  loadQueue: async (tracks, index, context = "unknown", instanceIds?: string[]) => {
    await get().cancelQueueLoading();
    const loadId = ++currentLoadId;
    try {
      set({ isQueueLoading: true });
      const CHUNK_SIZE = 15;

      const initialChunk = tracks.slice(index, index + CHUNK_SIZE);
      const initialInstances = instanceIds ? instanceIds.slice(index, index + CHUNK_SIZE) : undefined;
      const initialTpTracks = await Promise.all(
        initialChunk.map((t, i) => mapToTPTrack(t, initialInstances?.[i]))
      );

      if (currentLoadId !== loadId) return;

      await flushCurrentTrackToHistory();
      await TrackPlayer.stop().catch(() => { });
      await TrackPlayer.reset();
      lastAppliedSpeed = null;
      lastAppliedPitch = null;
      useCastStore.setState({ castPosition: 0 });
      await addTracksSafely(initialTpTracks);

      if (currentLoadId !== loadId) return;

      await get().applySpeedAndPitch();
      if (useCastStore.getState().isServerRunning) {
        LocalCastService.setPlayIntent(true);
      }
      await TrackPlayer.play();

      set({
        activeTrack: tracks[index],
        activeTrackInstanceId: instanceIds ? instanceIds[index] : (initialTpTracks[0]?.instanceId || initialTpTracks[0]?.id),
        playbackContext: context,
        isShuffleEnabled: false,
        shuffleOriginalQueue: [],
        userQueueSize: 0,
      });

      const previousTracks = tracks.slice(0, index);
      const previousInstances = instanceIds ? instanceIds.slice(0, index) : undefined;
      const remainingNextTracks = tracks.slice(index + CHUNK_SIZE);
      const remainingNextInstances = instanceIds ? instanceIds.slice(index + CHUNK_SIZE) : undefined;

      if (previousTracks.length > 0 || remainingNextTracks.length > 0) {
        loadQueueRemainingChunksInBackground({
          previousTracks,
          previousInstances,
          remainingNextTracks,
          remainingNextInstances,
          chunkSize: CHUNK_SIZE,
          loadId,
          set,
          updateQueueStatus: get().updateQueueStatus,
          savePlaybackState: get().savePlaybackState,
        });
      } else {
        set({ isQueueLoading: false });
      }
    } catch (error) {
      console.error("Error loading queue:", error);
      if (currentLoadId === loadId) {
        set({ isQueueLoading: false });
      }
    }
  },

  startShuffled: async (tracks, context = "unknown", instanceIds?: string[]) => {
    await get().cancelQueueLoading();
    const loadId = ++currentLoadId;
    try {
      set({ isQueueLoading: true });
      const CHUNK_SIZE = 15;

      const indices = Array.from({ length: tracks.length }, (_, i) => i);
      const shuffledIndices = shuffleArray(indices);
      const shuffledTracks = shuffledIndices.map((i) => tracks[i]);
      const shuffledInstances = instanceIds ? shuffledIndices.map((i) => instanceIds[i]) : undefined;

      const initialChunk = shuffledTracks.slice(0, CHUNK_SIZE);
      const initialInstances = shuffledInstances ? shuffledInstances.slice(0, CHUNK_SIZE) : undefined;
      const initialTpTracks = await Promise.all(
        initialChunk.map((t, i) => mapToTPTrack(t, initialInstances?.[i]))
      );

      if (currentLoadId !== loadId) return;

      await flushCurrentTrackToHistory();
      await setupShuffledPlayback(initialTpTracks, context, loadId, get().applySpeedAndPitch);
      if (currentLoadId !== loadId) return;

      set({
        activeTrack: shuffledTracks[0],
        activeTrackInstanceId: shuffledInstances ? shuffledInstances[0] : (initialTpTracks[0]?.instanceId || initialTpTracks[0]?.id),
        playbackContext: context,
        isShuffleEnabled: true,
        shuffleOriginalQueue: [],
        userQueueSize: 0,
        hasPrevious: false,
        hasNext: shuffledTracks.length > 1 || useSettingsStore.getState().shuffleOnQueueEnd,
      });

      loadShuffledOriginalQueueInBackground(tracks, instanceIds, loadId, set, get().savePlaybackState);
      loadShuffledRemainingChunksInBackground(
        shuffledTracks.slice(CHUNK_SIZE),
        shuffledInstances ? shuffledInstances.slice(CHUNK_SIZE) : undefined,
        loadId,
        CHUNK_SIZE,
        set,
        get().updateQueueStatus,
        get().savePlaybackState
      );
    } catch (error) {
      console.error("Error starting shuffled queue:", error);
      if (currentLoadId === loadId) {
        set({ isQueueLoading: false });
      }
    }
  },

  playRandomQueueOnEnd: async () => {
    const { shuffleOnQueueEnd } = useSettingsStore.getState();
    if (!shuffleOnQueueEnd) return;

    if (isHandlingQueueEnded) return;
    const { isQueueLoading } = get();
    if (isQueueLoading) return;

    try {
      const repeatMode = await TrackPlayer.getRepeatMode();
      if (repeatMode !== RepeatMode.Off) return;

      isHandlingQueueEnded = true;

      const availableTracks = await ShuffleService.getEligibleShuffleTracks();

      if (availableTracks.length === 0) return;

      console.log('[usePlayerStore] Queue ended with shuffleOnQueueEnd active. Triggering random playback.');
      useToastStore.getState().showToast(
        i18n.t('queue.random_autoplay_started', 'Cola finalizada: iniciando reproducción aleatoria'),
        'shuffle'
      );
      await get().startShuffled(availableTracks, 'random_queue_end');
    } catch (e) {
      console.error('[usePlayerStore] Error in playRandomQueueOnEnd:', e);
    } finally {
      const resetTimer = setTimeout(() => {
        isHandlingQueueEnded = false;
      }, 2000);
      (resetTimer as any)?.unref?.();
    }
  },

  skipToNext: async () => {
    try {
      const { shuffleOnQueueEnd } = useSettingsStore.getState();
      // Native skips already handle repeat mode and the end of the queue.
      // Only inspect the adjacent item when random autoplay needs an end check.
      if (shuffleOnQueueEnd) {
        const index = await TrackPlayer.getActiveTrackIndex();
        if (index !== undefined && index !== null) {
          const nextTrack = await TrackPlayer.getTrack(index + 1);
          if (!nextTrack && await TrackPlayer.getRepeatMode() === RepeatMode.Off) {
            await get().playRandomQueueOnEnd();
            return;
          }
        }
      }

      await TrackPlayer.skipToNext();
    } catch (e) {
      console.error('[usePlayerStore] Error skipping to next:', e);
    }
  },

  playSingleTrack: async (track, context = "unknown") => {
    await get().cancelQueueLoading();
    const loadId = ++currentLoadId;
    set({ isQueueLoading: true });
    try {
      const tpTrack = await mapToTPTrack(track);
      if (currentLoadId !== loadId) return;
      await flushCurrentTrackToHistory();
      await TrackPlayer.stop().catch(() => { });
      await TrackPlayer.reset();
      lastAppliedSpeed = null;
      lastAppliedPitch = null;
      useCastStore.setState({ castPosition: 0 });
      await addTracksSafely([tpTrack]);
      if (currentLoadId !== loadId) return;
      await get().applySpeedAndPitch();
      if (useCastStore.getState().isServerRunning) {
        LocalCastService.setPlayIntent(true);
      }
      await TrackPlayer.play();
      set({ activeTrack: track, activeTrackInstanceId: null, playbackContext: context, userQueueSize: 0, isQueueLoading: false });
      await get().updateQueueStatus();
      await get().savePlaybackState();
    } catch (error) {
      console.error("Error playing single track:", error);
      if (currentLoadId === loadId) {
        set({ isQueueLoading: false });
      }
    }
  },

  setActiveTrackById: async (trackId, instanceId) => {
    const revision = ++activeTrackRevision;
    try {
      const cleanId = trackId.split('-')[0];
      const instId = instanceId || (trackId.includes('-') ? trackId.substring(cleanId.length + 1) : null);
      if (cleanId.startsWith('ext_')) {
        const current = get().activeTrack;
        if (current?.id.toString() === cleanId) {
          set({ activeTrackInstanceId: instId });
        }
        return;
      }
      const track = await database.get<Track>("tracks").find(cleanId);
      if (revision !== activeTrackRevision) return;
      set({ activeTrack: track, activeTrackInstanceId: instId });
    } catch (error) {
      console.error("Error setting active track by ID:", error);
    }
  },

  syncWithTrackPlayer: async () => {
    const revision = ++activeTrackRevision;
    const isCurrent = () => revision === activeTrackRevision;
    // Foreground reads and event-driven metadata lookups share the same ordering guard.
    void refreshPlaybackSnapshot();
    try {
      const [activeTP, activeIndex] = await Promise.all([
        TrackPlayer.getActiveTrack(),
        TrackPlayer.getActiveTrackIndex(),
      ]);

      const targetTP = await resolveTargetTrackPlayerTrack(activeTP, activeIndex);
      if (!isCurrent()) return;
      if (targetTP?.id) {
        await syncActiveTrackFromTP(targetTP, get, set, isCurrent);
      }

      if (isCurrent() && activeIndex !== undefined && activeIndex !== null) {
        await get().updateQueueStatus(activeIndex);
      }
    } catch (e) {
      console.error("[usePlayerStore] Error en syncWithTrackPlayer:", e);
    }
  },

  addToQueueNext: async (track) => {
    try {
      const tpTrack = await mapToTPTrack(track);
      (tpTrack as any).isManual = true;
      const currentIndex = await TrackPlayer.getActiveTrackIndex();

      if (currentIndex !== undefined && currentIndex !== null) {
        const queue = await TrackPlayer.getQueue();
        if (currentIndex + 1 < queue.length) {
          await TrackPlayer.add([tpTrack], currentIndex + 1);
        } else {
          await TrackPlayer.add([tpTrack]);
        }
      } else {
        await TrackPlayer.add([tpTrack]);
      }
      // Incrementar el tamaño de la cola manual
      set((state) => ({ userQueueSize: state.userQueueSize + 1 }));
      await get().updateQueueStatus();
      await get().savePlaybackState();
    } catch (error) {
      console.error("Error adding to queue next:", error);
    }
  },

  addToQueueEnd: async (track) => {
    try {
      const tpTrack = await mapToTPTrack(track);
      (tpTrack as any).isManual = true;

      const { queueAddBehavior } = useSettingsStore.getState();
      const currentIndex = await TrackPlayer.getActiveTrackIndex();

      if (queueAddBehavior === 'user_queue' && currentIndex !== undefined && currentIndex !== null) {
        const { userQueueSize } = get();
        const insertIndex = currentIndex + 1 + Math.max(0, userQueueSize);
        const queue = await TrackPlayer.getQueue();

        if (insertIndex < queue.length) {
          await TrackPlayer.add([tpTrack], insertIndex);
        } else {
          await TrackPlayer.add([tpTrack]);
        }
        set((state) => ({ userQueueSize: state.userQueueSize + 1 }));
      } else if (queueAddBehavior === 'user_queue') {
        // Nada reproduciéndose actualmente, pero en modo cola de usuario
        await TrackPlayer.add([tpTrack]);
        set((state) => ({ userQueueSize: state.userQueueSize + 1 }));
      } else {
        // Comportamiento legado: al final de la cola de contexto / de toda la lista
        await TrackPlayer.add([tpTrack]);
      }

      await get().updateQueueStatus();
      await get().savePlaybackState();
    } catch (error) {
      console.error("Error adding to queue end:", error);
    }
  },

  addMultipleToQueueNext: async (tracks) => {
    try {
      if (tracks.length === 0) return;
      const tpTracks = await Promise.all(tracks.map((t) => mapToTPTrack(t)));
      tpTracks.forEach((t) => ((t as any).isManual = true));
      const currentIndex = await TrackPlayer.getActiveTrackIndex();

      if (currentIndex !== undefined && currentIndex !== null) {
        const queue = await TrackPlayer.getQueue();
        if (currentIndex + 1 < queue.length) {
          await TrackPlayer.add(tpTracks, currentIndex + 1);
        } else {
          await TrackPlayer.add(tpTracks);
        }
      } else {
        await TrackPlayer.add(tpTracks);
      }
      // Incrementar el tamaño de la cola manual
      set((state) => ({ userQueueSize: state.userQueueSize + tracks.length }));
      await get().updateQueueStatus();
      await get().savePlaybackState();
    } catch (error) {
      console.error("Error adding multiple to queue next:", error);
    }
  },

  addMultipleToQueueEnd: async (tracks) => {
    try {
      if (tracks.length === 0) return;
      const tpTracks = await Promise.all(tracks.map((t) => mapToTPTrack(t)));
      tpTracks.forEach((t) => ((t as any).isManual = true));

      const { queueAddBehavior } = useSettingsStore.getState();
      const currentIndex = await TrackPlayer.getActiveTrackIndex();

      if (queueAddBehavior === 'user_queue' && currentIndex !== undefined && currentIndex !== null) {
        const { userQueueSize } = get();
        const insertIndex = currentIndex + 1 + Math.max(0, userQueueSize);
        const queue = await TrackPlayer.getQueue();

        if (insertIndex < queue.length) {
          await TrackPlayer.add(tpTracks, insertIndex);
        } else {
          await TrackPlayer.add(tpTracks);
        }
        set((state) => ({ userQueueSize: state.userQueueSize + tracks.length }));
      } else if (queueAddBehavior === 'user_queue') {
        // Nada reproduciéndose actualmente, pero en modo cola de usuario
        await TrackPlayer.add(tpTracks);
        set((state) => ({ userQueueSize: state.userQueueSize + tracks.length }));
      } else {
        // Comportamiento legado: al final de la cola de contexto / de toda la lista
        await TrackPlayer.add(tpTracks);
      }

      await get().updateQueueStatus();
      await get().savePlaybackState();
    } catch (error) {
      console.error("Error adding multiple to queue end:", error);
    }
  },

  clearPlayer: async () => {
    try {
      await get().cancelQueueLoading();
      await flushCurrentTrackToHistory();
      await TrackPlayer.reset();
      lastAppliedSpeed = null;
      lastAppliedPitch = null;
      storage.remove(PERSISTENCE_KEY);
      storage.remove("@player_position");
      storage.remove("@player_accumulated");
      set({
        activeTrack: null,
        activeTrackInstanceId: null,
        prevTrack: null,
        nextTrack: null,
        playbackContext: null,
        hasNext: false,
        hasPrevious: false,
        isShuffleEnabled: false,
        shuffleOriginalQueue: [],
        userQueueSize: 0,
        isQueueLoading: false,
      });

      // Cerrar el PlayerScreen si está abierto
      if (navigationRef.isReady()) {
        const currentRoute = navigationRef.getCurrentRoute();
        const rootState = navigationRef.getRootState();

        if (
          currentRoute?.name === 'PlayerHome' ||
          (rootState && rootState.routes[rootState.index]?.name === 'Player')
        ) {
          navigationRef.navigate('Main');
        }
      }

    } catch (error) {
      console.error("Error in clearPlayer:", error);
    }
  },

  setShuffleState: (enabled, queue) =>
    set({
      isShuffleEnabled: enabled,
      shuffleOriginalQueue: queue,
    }),

  toggleShuffle: async () => {
    try {
      const { isShuffleEnabled, shuffleOriginalQueue } = get();
      const currentQueue = await TrackPlayer.getQueue();
      const activeIndex = (await TrackPlayer.getActiveTrackIndex()) ?? 0;

      if (currentQueue.length <= 1) {
        set({ isShuffleEnabled: !isShuffleEnabled, shuffleOriginalQueue: [] });
        return;
      }

      const currentIndex = Math.max(0, Math.min(activeIndex, currentQueue.length - 1));
      const currentTrack = currentQueue[currentIndex];

      if (!isShuffleEnabled) {
        // Save current queue as original queue
        set({ isShuffleEnabled: true, shuffleOriginalQueue: currentQueue });

        // Get all other tracks (excluding current track)
        const otherTracks = currentQueue.filter((_, idx) => idx !== currentIndex);
        const shuffledOthers = shuffleArray(otherTracks);

        // 1. Clear upcoming tracks
        await TrackPlayer.removeUpcomingTracks();

        // 2. Clear previous tracks if any, leaving currentTrack at index 0
        if (currentIndex > 0) {
          const previousIndices = Array.from({ length: currentIndex }, (_, i) => i);
          await TrackPlayer.remove(previousIndices);
        }

        // 3. Add shuffled other tracks after currentTrack
        if (shuffledOthers.length > 0) {
          await TrackPlayer.add(shuffledOthers);
        }
      } else {
        // Turning shuffle OFF: restore original queue order
        let tracksToRestore: TPTrack[] = [];
        if (shuffleOriginalQueue.length > 0) {
          const originalIdx = shuffleOriginalQueue.findIndex(t => t?.id === currentTrack?.id);
          const restoreIdx = Math.max(0, originalIdx);

          const upcomingOriginal = shuffleOriginalQueue.slice(restoreIdx + 1);
          const previousOriginal = shuffleOriginalQueue.slice(0, restoreIdx);
          tracksToRestore = [...upcomingOriginal, ...previousOriginal];
        }

        // 1. Clear upcoming tracks
        await TrackPlayer.removeUpcomingTracks();

        // 2. Clear previous tracks if any, leaving currentTrack at index 0
        if (currentIndex > 0) {
          const previousIndices = Array.from({ length: currentIndex }, (_, i) => i);
          await TrackPlayer.remove(previousIndices);
        }

        // 3. Add restored original tracks after currentTrack
        if (tracksToRestore.length > 0) {
          await TrackPlayer.add(tracksToRestore);
        }

        set({ isShuffleEnabled: false, shuffleOriginalQueue: [] });
      }

      await get().updateQueueStatus(0);
      await get().savePlaybackState();
    } catch (e) {
      console.error('Error toggling shuffle in usePlayerStore:', e);
    }
  },

  // Llamado por TrackPlayerSync cuando el track avanza hacia adelante
  // y hay tracks de la user queue pendientes
  decrementUserQueue: () => {
    set((state) => ({ userQueueSize: Math.max(0, state.userQueueSize - 1) }));
  },

  applySpeedAndPitch: async () => {
    if (isApplyingSpeedAndPitch) {
      hasPendingSpeedPitchUpdate = true;
      return;
    }
    isApplyingSpeedAndPitch = true;
    try {
      const applyUpdates = async (): Promise<void> => {
        hasPendingSpeedPitchUpdate = false;
        const { speed, pitch } = resolveTargetSpeedAndPitch(get());
        await applyTargetSpeedAndPitch(speed, pitch);
        if (hasPendingSpeedPitchUpdate) {
          await applyUpdates();
        }
      };
      await applyUpdates();
    } catch (e) {
      console.error("Error applying speed and pitch:", e);
    } finally {
      isApplyingSpeedAndPitch = false;
    }
  },

  setPlaybackSpeed: async (speed) => {
    try {
      set({ playbackSpeed: speed });
      if (get().isVinylModeEnabled) {
        set({ playbackPitch: speed });
      }
      await get().applySpeedAndPitch();
      scheduleDebouncedSavePlaybackState();
    } catch (e) {
      console.error("Error setting playback speed:", e);
    }
  },

  setPlaybackPitch: async (pitch) => {
    try {
      set({ playbackPitch: pitch });
      await get().applySpeedAndPitch();
      scheduleDebouncedSavePlaybackState();
    } catch (e) {
      console.error("Error setting playback pitch:", e);
    }
  },

  setVinylModeEnabled: async (enabled) => {
    try {
      set({ isVinylModeEnabled: enabled });
      if (enabled) {
        set({ playbackPitch: get().playbackSpeed });
      }
      await get().applySpeedAndPitch();
      scheduleDebouncedSavePlaybackState();
    } catch (e) {
      console.error("Error setting vinyl mode:", e);
    }
  },

  setLyricsVisible: (visible) => {
    set({ isLyricsVisible: visible });
  },

  clearUserQueue: async () => {
    try {
      const queue = await TrackPlayer.getQueue();
      const activeIndex = await TrackPlayer.getActiveTrackIndex();

      if (activeIndex === undefined || activeIndex === null) return;

      const indicesToRemove = queue
        .map((track, index) => index > activeIndex && (track as any).isManual ? index : -1)
        .filter(index => index !== -1);

      if (indicesToRemove.length > 0) {
        // Ordenamos los índices de mayor a menor para que al borrar desde el final
        // no afecte a los índices de las posiciones anteriores.
        indicesToRemove.sort((a, b) => b - a);
        await removeIndicesInChunks(indicesToRemove);
      }

      set({ userQueueSize: 0 });
      await get().updateQueueStatus();
      await get().savePlaybackState();
    } catch (e) {
      console.error("Error clearing user queue:", e);
    }
  },

  clearContextQueue: async () => {
    try {
      await get().cancelQueueLoading();
      const queue = await TrackPlayer.getQueue();
      const activeIndex = await TrackPlayer.getActiveTrackIndex();

      if (activeIndex === undefined || activeIndex === null) return;

      const indicesToRemove = queue
        .map((track, index) => index > activeIndex && !(track as any).isManual ? index : -1)
        .filter(index => index !== -1);

      if (indicesToRemove.length === 0) return;

      indicesToRemove.sort((a, b) => b - a);
      await removeIndicesInChunks(indicesToRemove);

      await get().updateQueueStatus();
      await get().savePlaybackState();
    } catch (e) {
      console.error("Error clearing context queue:", e);
    }
  },

  // ── Persistencia en disco ──
  // ── Persistencia en disco ──
  savePlaybackState: async () => {
    try {
      const { activeTrack } = get();
      if ((activeTrack as any)?.isExternal) {
        return;
      }

      const queue = await TrackPlayer.getQueue();
      const index = await TrackPlayer.getActiveTrackIndex();
      const {
        playbackContext,
        isShuffleEnabled,
        shuffleOriginalQueue,
        userQueueSize,
        playbackSpeed,
        playbackPitch,
        isVinylModeEnabled,
      } = get();

      if (queue.length === 0) {
        storage.remove(PERSISTENCE_KEY);
        storage.remove("@player_position");
        storage.remove("@player_accumulated");
        return;
      }

      // Guardar el estado general sin position y accumulatedTime en el JSON de la cola
      const payload = JSON.stringify({
        queue,
        index,
        playbackContext,
        isShuffleEnabled,
        shuffleOriginalQueue,
        userQueueSize,
        playbackSpeed,
        playbackPitch,
        isVinylModeEnabled,
      });
      storage.set(PERSISTENCE_KEY, payload);

      // Guardar minutaje y acumulado en claves separadas (primitivas numéricas) para micro-optimizar
      try {
        const progress = await TrackPlayer.getProgress();
        storage.set("@player_position", progress.position);
      } catch (error_) {
        console.error("Error obteniendo posición del track:", error_);
      }

      if (index !== undefined && index !== null && index >= 0 && index < queue.length) {
        const activeTPTrack = queue[index];
        if (activeTPTrack?.id) {
          try {
            const accumulatedTime = PlaybackTimeTracker.getAccumulatedSeconds(activeTPTrack.id.toString());
            storage.set("@player_accumulated", accumulatedTime);
          } catch (error_) {
            console.error("Error obteniendo acumulado del tracker:", error_);
          }
        }
      }
    } catch (error) {
      console.error("Error guardando estado de reproducción:", error);
    }
  },

  restorePlaybackState: async () => {
    set({ isRestoring: true });
    try {
      const savedData = storage.getString(PERSISTENCE_KEY);
      if (!savedData) {
        return;
      }

      const {
        queue,
        index,
        playbackContext,
        isShuffleEnabled,
        shuffleOriginalQueue,
        userQueueSize,
        playbackSpeed,
        playbackPitch,
        isVinylModeEnabled,
      } = JSON.parse(savedData);

      if (!queue || queue.length === 0) return;

      // Obtener posición y acumulado de sus claves primitivas (evita parsear el JSON de la cola cada segundo)
      const position = storage.getNumber("@player_position") || 0;
      const accumulatedTime = storage.getNumber("@player_accumulated") || 0;

      // 1. Rehidratar el motor nativo de TrackPlayer
      await TrackPlayer.reset();
      lastAppliedSpeed = null;
      lastAppliedPitch = null;
      await TrackPlayer.add(queue);
      await get().applySpeedAndPitch();

      const safeIndex =
        index !== undefined && index !== null && index < queue.length
          ? index
          : 0;
      await TrackPlayer.skip(safeIndex);

      await restorePlaybackPosition(position);

      // Iniciamos pausado para no sorprender al usuario al abrir la app
      await TrackPlayer.pause();

      // 2. Rehidratar el modelo WatermelonDB por ID
      const { trackModel, activeTrackInstanceId } = await restoreActiveTrackModel(
        queue[safeIndex],
        accumulatedTime
      );

      // 3. Rehidratar Zustand
      set({
        activeTrack: trackModel,
        activeTrackInstanceId,
        playbackContext: playbackContext ?? null,
        isShuffleEnabled: isShuffleEnabled ?? false,
        shuffleOriginalQueue: shuffleOriginalQueue ?? [],
        userQueueSize: userQueueSize ?? 0,
        playbackSpeed: playbackSpeed ?? 1.0,
        playbackPitch: playbackPitch ?? 1.0,
        isVinylModeEnabled: isVinylModeEnabled ?? true,
      });

      // 4. Actualizar hasPrevious / hasNext
      await get().updateQueueStatus(safeIndex);
    } catch (error) {
      console.error("Error restaurando estado de reproducción:", error);
    } finally {
      setTimeout(() => {
        set({ isRestoring: false });
      }, 1000);
    }
  },

  updateQueueStatus: async (currentIndex?: number) => {
    const revision = ++queueStatusRevision;
    const snapshotRevision = beginQueueSnapshotRead();
    try {
      const [queue, index, repeatMode] = await Promise.all([
        TrackPlayer.getQueue(),
        currentIndex ?? TrackPlayer.getActiveTrackIndex(),
        TrackPlayer.getRepeatMode(),
      ]);
      if (revision !== queueStatusRevision) return;
      publishNativeQueue(queue, index, snapshotRevision);
      const { shuffleOnQueueEnd } = useSettingsStore.getState();

      if (index === undefined || index === null || queue.length === 0) {
        set({ hasPrevious: false, hasNext: false, prevTrack: null, nextTrack: null });
        return;
      }

      const isLooping = repeatMode !== RepeatMode.Off;
      const hasPrev = index > 0 || isLooping;
      const hasNxt = index < queue.length - 1 || isLooping || shuffleOnQueueEnd;

      const prevIndex = getAdjacentTrackIndex(index, -1, queue.length, isLooping);
      const nextIndex = getAdjacentTrackIndex(index, 1, queue.length, isLooping);

      // Transport controls do not depend on database metadata.
      set({ hasPrevious: hasPrev, hasNext: hasNxt });

      const [prevModel, nextModel] = await Promise.all([
        fetchTrackModelFromQueue(queue, prevIndex, index),
        fetchTrackModelFromQueue(queue, nextIndex, index),
      ]);
      if (revision !== queueStatusRevision) return;

      set({
        hasPrevious: hasPrev,
        hasNext: hasNxt,
        prevTrack: prevModel,
        nextTrack: nextModel,
      });
    } catch (error) {
      console.error("❌ [Store] Error actualizando status de la cola:", error);
    }
  },
  saveRecentsState: () => {
    try {
      const { recentMedia, recentPlaylists } = get();
      const payload = JSON.stringify({ recentMedia, recentPlaylists });
      storage.set(RECENTS_KEY, payload);
    } catch (error) {
      console.error("Error guardando recientes:", error);
    }
    return Promise.resolve();
  },

  restoreRecentsState: () => {
    try {
      const savedData = storage.getString(RECENTS_KEY);
      if (!savedData) return Promise.resolve();

      const { recentMedia, recentPlaylists } = JSON.parse(savedData);
      set({
        recentMedia: recentMedia || [],
        recentPlaylists: recentPlaylists || [],
      });
    } catch (error) {
      console.error("Error restaurando recientes:", error);
    }
    return Promise.resolve();
  },

  addMediaToRecents: (item) => {
    const current = get().recentMedia;
    const filtered = current.filter(
      (i) => !(i.id === item.id && i.type === item.type),
    );
    const updated = [{ ...item, timestamp: Date.now() }, ...filtered].slice(
      0,
      6,
    );
    set({ recentMedia: updated });
    get().saveRecentsState().catch((err) => console.error("Error saving recents:", err));
  },

  addPlaylistToRecents: (playlist) => {
    const current = get().recentPlaylists;
    const filtered = current.filter((p) => p.id !== playlist.id);
    const updated = [{ ...playlist, timestamp: Date.now() }, ...filtered].slice(
      0,
      10,
    );
    set({ recentPlaylists: updated });
    get().saveRecentsState().catch((err) => console.error("Error saving recents:", err));
  },

  updatePlaylistCoverInRecents: (playlistId, imageUrl) => {
    const current = get().recentPlaylists;
    let modified = false;
    const updated = current.map((p) => {
      if (p.id === playlistId && (p as any).imageUrl !== imageUrl) {
        modified = true;
        return { ...p, imageUrl };
      }
      return p;
    });
    if (modified) {
      set({ recentPlaylists: updated });
      get().saveRecentsState().catch((err) => console.error("Error saving recents:", err));
    }
  },

  removePlaylistFromRecents: (playlistId) => {
    const current = get().recentPlaylists;
    const updated = current.filter((p) => p.id !== playlistId);
    if (updated.length !== current.length) {
      set({ recentPlaylists: updated });
      get().saveRecentsState().catch((err) => console.error("Error saving recents:", err));
    }
  },

  updateMediaImageInRecents: (id, type, imageUrl) => {
    const current = get().recentMedia;
    let modified = false;
    const updated = current.map((item) => {
      if (item.id === id && item.type === type && item.imageUrl !== imageUrl) {
        modified = true;
        return { ...item, imageUrl };
      }
      return item;
    });
    if (modified) {
      set({ recentMedia: updated });
      get().saveRecentsState().catch((err) => console.error("Error saving recents:", err));
    }
  },

  handleDeletedEntities: async (trackIds, albumIds, artistIds) => {
    try {
      const state = get();
      let shouldUpdateRecents = false;
      const newRecentMedia = state.recentMedia.filter(item => {
        if (item.type === 'track' && trackIds.includes(item.id)) return false;
        if (item.type === 'album' && albumIds.includes(item.id)) return false;
        if (item.type === 'artist' && artistIds.includes(item.id)) return false;
        return true;
      });

      if (newRecentMedia.length !== state.recentMedia.length) {
        set({ recentMedia: newRecentMedia });
        shouldUpdateRecents = true;
      }

      if (shouldUpdateRecents) {
        await get().saveRecentsState();
      }

      // Handle queue
      const activeTrack = state.activeTrack;
      const activeTP = await TrackPlayer.getActiveTrack().catch(() => null);
      const activeTPId = activeTP?.id ? (activeTP.id as string).split('-')[0] : null;

      const isActiveTrackDeleted = Boolean(
        (activeTrack && trackIds.includes(activeTrack.id)) ||
        (activeTPId && trackIds.includes(activeTPId))
      );

      const queue = await TrackPlayer.getQueue();
      const indicesToRemove: number[] = [];
      queue.forEach((track, index) => {
        if (track.id) {
          const originalId = (track.id as string).split('-')[0];
          if (trackIds.includes(originalId)) {
            indicesToRemove.push(index);
          }
        }
      });

      const isAnyQueueTrackDeleted = indicesToRemove.length > 0;

      if (isActiveTrackDeleted || isAnyQueueTrackDeleted) {
        // Si alguna canción se ha eliminado y está en reproducción o en la cola, parar la reproducción
        await TrackPlayer.pause().catch(() => { });

        if (isActiveTrackDeleted) {
          // Current track deleted -> clear queue and stop
          await get().clearPlayer();
        } else if (isAnyQueueTrackDeleted) {
          await TrackPlayer.remove(indicesToRemove);
          if (state.shuffleOriginalQueue.length > 0) {
            const updatedShuffle = state.shuffleOriginalQueue.filter((t) => {
              if (!t?.id) return true;
              const origId = (t.id as string).split('-')[0];
              return !trackIds.includes(origId);
            });
            set({ shuffleOriginalQueue: updatedShuffle });
          }
          await get().updateQueueStatus();
          await get().savePlaybackState();
        }
      }
    } catch (error) {
      console.error("Error handling deleted entities in player store:", error);
    }
  },

  handleRelocatedTracks: async (relocatedTrackIds) => {
    try {
      if (!relocatedTrackIds || relocatedTrackIds.length === 0) return;

      const state = get();
      const activeTrack = state.activeTrack;
      const activeTP = await TrackPlayer.getActiveTrack().catch(() => null);
      const activeTPId = activeTP?.id ? (activeTP.id as string).split('-')[0] : null;

      const isActiveTrackRelocated = Boolean(
        (activeTrack && relocatedTrackIds.includes(activeTrack.id)) ||
        (activeTPId && relocatedTrackIds.includes(activeTPId))
      );

      const queue = await TrackPlayer.getQueue();
      const relocatedIndices: number[] = [];
      queue.forEach((track, index) => {
        if (track.id) {
          const originalId = (track.id as string).split('-')[0];
          if (relocatedTrackIds.includes(originalId)) {
            relocatedIndices.push(index);
          }
        }
      });

      const isAnyQueueTrackRelocated = relocatedIndices.length > 0;
      if (!isActiveTrackRelocated && !isAnyQueueTrackRelocated) {
        return;
      }

      // Si alguna canción se ha recolocado y está en reproducción o en la cola, parar la reproducción
      await TrackPlayer.pause().catch(() => { });

      if (isActiveTrackRelocated) {
        // Si la pista activa ha sido reubicada, su archivo se ha movido: reseteamos el reproductor
        await get().clearPlayer();
        return;
      }

      await updateRelocatedQueueTracks(queue, relocatedIndices);

      if (state.shuffleOriginalQueue.length > 0) {
        const updatedShuffle = await updateRelocatedShuffleQueue(
          state.shuffleOriginalQueue,
          relocatedTrackIds
        );
        set({ shuffleOriginalQueue: updatedShuffle });
      }

      await get().updateQueueStatus();
      await get().savePlaybackState();
    } catch (error) {
      console.error("Error handling relocated tracks in player store:", error);
    }
  },

  checkAndPauseIfTracksActiveOrQueued: async (trackIds) => {
    try {
      if (!trackIds || trackIds.length === 0) return false;
      const targetIds = new Set(trackIds);
      const state = get();
      const activeTrack = state.activeTrack;
      const activeTP = await TrackPlayer.getActiveTrack().catch(() => null);
      const activeTPId = activeTP?.id ? (activeTP.id as string).split('-')[0] : null;

      const isActiveTrackTarget = Boolean(
        (activeTrack && targetIds.has(activeTrack.id)) ||
        (activeTPId && targetIds.has(activeTPId))
      );

      const queue = await TrackPlayer.getQueue().catch(() => []);
      const isAnyQueueTarget = queue.some(t => {
        if (!t.id) return false;
        const origId = (t.id as string).split('-')[0];
        return targetIds.has(origId);
      });

      if (isActiveTrackTarget || isAnyQueueTarget) {
        await TrackPlayer.pause().catch(() => { });
        return true;
      }
      return false;
    } catch (e) {
      console.error("[usePlayerStore] Error checking and pausing tracks:", e);
      return false;
    }
  },

  updateTrackMetadata: async (trackId: string) => {
    try {
      const track = await database.get<Track>("tracks").find(trackId);
      if (!track) return;

      const album = await track.album.fetch().catch(() => null);
      const artists = (await track.queryCollaborators.fetch().catch(() => [])) as Artist[];
      const artistNames =
        artists.length > 0
          ? artists.map((a) => a.name).join(", ")
          : "Artista desconocido";

      const title = track.title;
      const artist = artistNames;
      const albumTitle = album?.title || "Álbum desconocido";
      const artwork = album?.coverUrl || undefined;

      const activeTrack = get().activeTrack;
      if (activeTrack?.id === trackId) {
        set({ activeTrack: track });
      }

      const queue = await TrackPlayer.getQueue();
      const metadataUpdates: Promise<void>[] = [];
      let updatedAny = false;
      for (let i = 0; i < queue.length; i++) {
        const tpTrack = queue[i];
        const tpTrackId = tpTrack.id.toString();
        if (tpTrackId.startsWith(`${trackId}-`) || tpTrack.url === track.fileUrl) {
          metadataUpdates.push(
            TrackPlayer.updateMetadataForTrack(i, {
              title,
              artist,
              album: albumTitle,
              artwork,
            })
          );
          updatedAny = true;
        }
      }
      if (metadataUpdates.length > 0) {
        await Promise.all(metadataUpdates);
      }

      const updatedShuffleQueue = get().shuffleOriginalQueue.map((tpTrack) => {
        const tpTrackId = tpTrack.id.toString();
        if (tpTrackId.startsWith(`${trackId}-`) || tpTrack.url === track.fileUrl) {
          updatedAny = true;
          return {
            ...tpTrack,
            title,
            artist,
            album: albumTitle,
            artwork,
          };
        }
        return tpTrack;
      });

      if (updatedAny) {
        set((state) => ({
          shuffleOriginalQueue: updatedShuffleQueue,
          queueVersion: state.queueVersion + 1,
        }));
        await get().savePlaybackState();
      }

      // Update recentMedia for this track and its album
      const currentRecentMedia = get().recentMedia;
      let recentsModified = false;
      const updatedRecentMedia = currentRecentMedia.map((item) => {
        if (item.type === 'track' && item.id === trackId) {
          recentsModified = true;
          return {
            ...item,
            title,
            subtitle: artist,
            imageUrl: artwork || null,
          };
        }
        if (item.type === 'album' && item.id === album?.id) {
          recentsModified = true;
          return {
            ...item,
            title: albumTitle,
            imageUrl: artwork || null,
          };
        }
        return item;
      });
      if (recentsModified) {
        set({ recentMedia: updatedRecentMedia });
        await get().saveRecentsState();
      }
    } catch (e) {
      console.error("Error updating track metadata in player store:", e);
    }
  },

  refreshRecentsFromDatabase: async () => {
    try {
      const state = get();
      if (!state.recentMedia || state.recentMedia.length === 0) return;

      const collections: RecentCollections = {
        tracks: database.collections.get<Track>("tracks"),
        albums: database.collections.get<Album>("albums"),
        artists: database.collections.get<Artist>("artists"),
      };

      const results = await Promise.all(
        state.recentMedia.map((item) => refreshRecentItem(item, collections))
      );

      let modified = false;
      const updatedMedia: RecentItem[] = [];

      for (const { item: updatedItem, modified: isItemModified } of results) {
        if (isItemModified) {
          modified = true;
        }
        if (updatedItem) {
          updatedMedia.push(updatedItem);
        }
      }

      if (modified) {
        set({ recentMedia: updatedMedia });
        await get().saveRecentsState();
      }
    } catch (error) {
      console.error("Error refreshing recents from database:", error);
    }
  }
}));
