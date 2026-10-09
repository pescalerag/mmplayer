import { create } from 'zustand';
import { useTagFormStore } from './useTagFormStore';
import type Album from '../database/models/Album';
import type Artist from '../database/models/Artist';

export interface TrackMenuMetadata {
  coverUrl: string | null;
  artistName: string | null;
  albumId: string | null;
  artists: Artist[];
}

// Any new opening or dismissal invalidates pending track metadata requests.
let sheetRequestId = 0;

export type SheetType =
  | 'track-menu'
  | 'album-menu'
  | 'artist-menu'
  | 'folder-menu'
  | 'playlist-menu'
  | 'sleep-timer'
  | 'speed-pitch'
  | 'queue'
  | 'tag-menu'
  | 'lyrics-menu'
  | 'artists-list'
  | 'local-cast'
  | 'library-tabs-order'
  | 'app-tabs-order'
  | 'home-sections'
  | 'swipe-action'
  | 'sort-modal'
  | 'metadata-editor'
  | 'playlist-selector'
  | 'tag-manager'
  | 'player-menu'
  | 'batch-menu'
  | 'advanced-tag-search'
  | 'edit-alias'
  | 'clear-queue'
  | 'canvas-manager'
  | 'track-details'
  | 'notification-settings';

interface UIState {
  activeSheet: SheetType | null;
  sheetProps: any;
  openSheet: (type: SheetType, props?: any) => void;
  closeSheet: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeSheet: null,
  sheetProps: null,
  openSheet: (type, props = {}) => {
    sheetRequestId++;
    set({ activeSheet: type, sheetProps: props });
  },
  closeSheet: () => {
    sheetRequestId++;
    set({ activeSheet: null, sheetProps: null });
  },
}));

// ----- HELPERS DE APERTURA PARA CADA SHEET -----
export const openTrackMenu = async (track: any, callbacks: any = {}, playlistId?: string) => {
  const requestId = ++sheetRequestId;
  let album: Album | null = track?.albumObj ?? null;
  let artists: Artist[] = track?.artistsList ?? [];

  if (track?.album?.fetch || track?.queryCollaborators?.fetch) {
    const [albumResult, artistsResult] = await Promise.allSettled([
      Promise.resolve().then(() => track.album?.fetch() as Promise<Album | null> | undefined),
      Promise.resolve().then(() => track.queryCollaborators?.fetch() as Promise<Artist[]> | undefined),
    ]);
    if (albumResult.status === 'fulfilled') album = albumResult.value ?? album;
    if (artistsResult.status === 'fulfilled') artists = artistsResult.value ?? artists;
  }

  if (requestId !== sheetRequestId) return;

  const metadata: TrackMenuMetadata = {
    coverUrl: album?.coverUrl || track?.coverUrl || null,
    artistName: artists.length ? artists.map(artist => artist.name).join(', ') : track?.artistName || null,
    albumId: album?.id || null,
    artists,
  };
  useUIStore.getState().openSheet('track-menu', { track, callbacks, playlistId, metadata });
};

export const openLyricsMenu = (track: any, callbacks: any = {}) =>
  useUIStore.getState().openSheet('lyrics-menu', { track, callbacks });

export const openAlbumMenu = (album: any, callbacks: any = {}) =>
  useUIStore.getState().openSheet('album-menu', { album, callbacks });

export const openArtistMenu = (artist: any, callbacks: any = {}) =>
  useUIStore.getState().openSheet('artist-menu', { artist, callbacks });

export const openSortModal = (options: any = {}) =>
  useUIStore.getState().openSheet('sort-modal', options);

export const openQueueSheet = () =>
  useUIStore.getState().openSheet('queue');

export const openClearQueueSheet = () =>
  useUIStore.getState().openSheet('clear-queue');

export const openTagManager = (targetType: 'track' | 'album', targetId: string, targetTitle: string) =>
  useUIStore.getState().openSheet('tag-manager', { targetType, targetId, targetTitle });

export const openTagForm = (tag: any = null, onSave?: () => void) => {
  if (tag) {
    useTagFormStore.getState().openForEdit(tag, onSave);
  } else {
    useTagFormStore.getState().openForCreate(onSave);
  }
};

export const openTagMenu = (tag: any, callbacks: any = {}) =>
  useUIStore.getState().openSheet('tag-menu', { tag, callbacks });

export const openPlaylistSelector = (tracks: any) =>
  useUIStore.getState().openSheet('playlist-selector', {
    tracksToAssociate: Array.isArray(tracks) ? tracks : [tracks],
    playlistToEdit: null,
    isCreatingDirectly: false,
  });

export const openPlaylistSelectorEdit = (playlist: any) =>
  useUIStore.getState().openSheet('playlist-selector', {
    tracksToAssociate: [],
    playlistToEdit: playlist,
    isCreatingDirectly: false,
  });

export const openPlaylistSelectorCreate = () =>
  useUIStore.getState().openSheet('playlist-selector', {
    tracksToAssociate: [],
    playlistToEdit: null,
    isCreatingDirectly: true,
  });

export const openPlaylistMenu = (playlist: any, callbacks: any = {}) =>
  useUIStore.getState().openSheet('playlist-menu', { playlist, callbacks });

export const openFolderMenu = (folderPath: string, callbacks: any = {}) =>
  useUIStore.getState().openSheet('folder-menu', { folderPath, callbacks });

export const openArtistsList = (artists: any[]) =>
  useUIStore.getState().openSheet('artists-list', { artists });

export const openSleepTimer = () =>
  useUIStore.getState().openSheet('sleep-timer');

export const openLocalCast = () =>
  useUIStore.getState().openSheet('local-cast');

export const openSpeedPitch = () =>
  useUIStore.getState().openSheet('speed-pitch');

export const openLibraryTabsOrder = () =>
  useUIStore.getState().openSheet('library-tabs-order');

export const openAppTabsOrder = () =>
  useUIStore.getState().openSheet('app-tabs-order');

export const openHomeSections = () =>
  useUIStore.getState().openSheet('home-sections');

export const openSwipeAction = (target: 'left' | 'right') =>
  useUIStore.getState().openSheet('swipe-action', { target });

export const openMetadataEditor = (tracks: any) =>
  useUIStore.getState().openSheet('metadata-editor', { tracks });

export const openTagManagerForTrack = (track: any) =>
  useUIStore.getState().openSheet('tag-manager', { targetType: 'track', targetId: track.id, targetTitle: track.title });

export const openTagManagerForAlbum = (album: any) =>
  useUIStore.getState().openSheet('tag-manager', { targetType: 'album', targetId: album.id, targetTitle: album.title });

export const openPlayerMenu = () =>
  useUIStore.getState().openSheet('player-menu');

export const openBatchMenu = (tracks: any[]) =>
  useUIStore.getState().openSheet('batch-menu', { tracks });

export const openTagManagerForBatch = (tracks: any[]) =>
  useUIStore.getState().openSheet('tag-manager', {
    targetType: 'batch',
    targetId: 'batch',
    targetTitle: `${tracks.length} canciones`,
    tracks,
  });

export const openEditAlias = () =>
  useUIStore.getState().openSheet('edit-alias');

export const openCanvasManager = (tracks: any = []) =>
  useUIStore.getState().openSheet('canvas-manager', {
    tracks: Array.isArray(tracks) ? tracks : [tracks],
  });

export const openTrackDetails = (track: any) =>
  useUIStore.getState().openSheet('track-details', { track });

export const openNotificationSettings = () =>
  useUIStore.getState().openSheet('notification-settings');

