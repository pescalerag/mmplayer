/** Only serializable data crosses the desktop process boundary. */
export interface LibraryTrack {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  album: string;
  albumId: string;
  duration: number;
  cover: string | null;
  fileUrl: string;
  available: boolean;
  isFavorite: boolean;
  rating: number | null;
  genre: string | null;
  year: number | null;
  lyricsLRC: string | null;
  skipSegments: string | null;
  trackNumber: number | null;
  discNumber?: number | null;
  replayGain?: number | null;
  replayPeak?: number | null;
  isExcludedFromShuffle?: boolean;
}
export interface LibraryCollection {
  id: string;
  name: string;
  count: number;
  cover: string | null;
  isPinned?: boolean;
}
export interface LibraryTag {
  id: string;
  name: string;
  color: string;
  trackIds: string[];
}
export interface LibrarySnapshot {
  tracks: LibraryTrack[];
  albums: LibraryCollection[];
  artists: LibraryCollection[];
  playlists: (LibraryCollection & { trackIds: string[] })[];
  tags: LibraryTag[];
}
export interface ScanProgress {
  completed: number;
  discovered: number;
  active: boolean;
  errors: number;
}
export interface DesktopPreferences {
  language: "es" | "en" | "pt";
  section: string;
  sidebarWidth: number;
  playerWidth: number;
  playerVisible: boolean;
  zoomFactor: number;
  closeToTray: boolean;
  pinnedShortcuts: { kind: "tag" | "folder"; id: string; name: string }[];
}
export interface PlaybackSession {
  name: string;
  trackIds: string[];
  index: number;
  position: number;
  manualTrackIds: string[];
  shuffle: boolean;
  shuffleOriginalTrackIds?: string[];
  repeat: "off" | "all" | "one";
  shuffleOnEnd: boolean;
  accumulatedTime: number;
}
export interface PlayerPersistence {
  activeQueue: number;
  queues: PlaybackSession[];
  volume: number;
}
export interface DesktopState {
  preferences: DesktopPreferences;
  player: PlayerPersistence;
}
export interface FileMetadata {
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  albumArtist?: string | null;
  genre?: string | null;
  year?: number | null;
  trackNumber?: number | null;
  discNumber?: number | null;
  coverArtPath?: string | null;
}
export interface MetadataWriteItem {
  filePath: string;
  metadata: FileMetadata;
}
export interface MetadataWriteResult {
  filePath: string;
  success: boolean;
  error?: string;
  errorCode?: "permission";
}
export type TransportAction =
  | "play"
  | "pause"
  | "toggle"
  | "previous"
  | "next"
  | "stop";
export type FileSystemRequest =
  | { op: "checkFiles"; uris: string[] }
  | { op: "archive"; action: "zip" | "unzip" | "size"; sources: string[]; target?: string }
  | { op: "diskStats" }
  | { op: "getInfo"; uri: string; md5?: boolean }
  | { op: "makeDirectory"; uri: string; intermediates?: boolean }
  | { op: "readDirectory"; uri: string }
  | { op: "copy"; from: string; to: string }
  | { op: "move"; from: string; to: string }
  | { op: "delete"; uri: string; idempotent?: boolean }
  | { op: "writeBase64"; uri: string; base64: string }
  | { op: "readString"; uri: string; encoding?: "utf8" | "base64" }
  | { op: "writeString"; uri: string; contents: string; encoding?: "utf8" | "base64" }
  | { op: "download"; url: string; uri: string };
export interface DesktopCommands {
  repairCollaborators: { input: undefined; output: number };
  captureCard: { input: { html: string; width: number; height: number; outputWidth: number; outputHeight: number; format: "png" | "jpg" | "jpeg"; quality: number }; output: string };
  saveFile: { input: { uri: string; name: string }; output: boolean };
  importMusicZip: { input: { uri: string; name?: string }; output: { folder: string; imported: number; skipped: number } };
  readMetadata: { input: { uri: string }; output: FileMetadata };
  readReplayGain: {
    input: { uri: string };
    output: { gain: number | null; peak: number | null };
  };
  writeMetadata: {
    input:
      | MetadataWriteItem[]
      | { items: MetadataWriteItem[]; batchId: string };
    output: MetadataWriteResult[];
  };
  cancelMetadata: { input: { batchId: string }; output: void };
  fileSystem: { input: FileSystemRequest; output: unknown };
  transportState: {
    input: {
      playing: boolean;
      available: boolean;
      title: string;
      artist: string;
    };
    output: void;
  };
  database: { input: { method: string; args: unknown[] }; output: unknown };
  discordPresence: {
    input: { op: 'configure'; applicationId: string } | { op: 'activity'; activity: import('../../../src/services/discord/activity').DiscordActivity | null } | { op: 'disconnect' };
    output: import('../../../src/services/discord/activity').DiscordStatus;
  };
  state: { input: undefined; output: DesktopState };
  library: { input: undefined; output: LibrarySnapshot };
  pickMusic: { input: { folders: boolean }; output: number };
  scan: { input: undefined; output: number };
  favorite: { input: { trackId: string }; output: void };
  rate: { input: { trackId: string; rating: number | null }; output: void };
  saveLyrics: { input: { trackId: string; lyrics: string }; output: void };
  saveTimestamps: { input: { trackId: string; value: string }; output: void };
  createPlaylist: { input: { name: string }; output: string };
  addToPlaylist: {
    input: { playlistId: string; trackIds: string[] };
    output: void;
  };
  removeFromPlaylist: {
    input: { playlistId: string; trackIds: string[] };
    output: void;
  };
  createTag: { input: { name: string; color: string }; output: string };
  toggleTag: { input: { tagId: string; trackId: string }; output: void };
  preferences: {
    input: Partial<DesktopPreferences>;
    output: DesktopPreferences;
  };
  savePlayer: { input: PlayerPersistence; output: void };
  listen: { input: { trackId: string; seconds: number }; output: void };
  window: { input: "minimize" | "maximize" | "close"; output: void };
  windowState: { input: undefined; output: { maximized: boolean } };
}
export type Command = keyof DesktopCommands;
export interface DesktopEvents {
  musicZipProgress: { completed: number; total: number; folder: string };
  windowState: { maximized: boolean };
  preferences: DesktopPreferences;
  metadataProgress: { batchId?: string; current: number; total: number };
  transport: TransportAction;
  database: {
    source: "renderer" | "worker";
    table: string;
    changes: {
      type: "created" | "updated" | "destroyed";
      raw: Record<string, unknown> & { id: string };
    }[];
  };
  library: undefined;
  scan: ScanProgress;
  error: string;
  openTracks: string[];
}
export interface DesktopBridge {
  importDroppedFiles(
    files: File[],
  ): Promise<{ trackIds: string[]; imported: number }>;
  onBeforeClose(handler: () => Promise<void>): () => void;
  invoke<K extends Command>(
    command: K,
    input: DesktopCommands[K]["input"],
  ): Promise<DesktopCommands[K]["output"]>;
  on<K extends keyof DesktopEvents>(
    event: K,
    listener: (data: DesktopEvents[K]) => void,
  ): () => void;
}
export const desktopCommands: readonly Command[] = [
  "captureCard",
  "saveFile",
  "importMusicZip",
  "readMetadata",
  "readReplayGain",
  "writeMetadata",
  "cancelMetadata",
  "fileSystem",
  "transportState",
  "discordPresence",
  "database",
  "state",
  "library",
  "pickMusic",
  "scan",
  "repairCollaborators",
  "favorite",
  "rate",
  "saveLyrics",
  "saveTimestamps",
  "createPlaylist",
  "addToPlaylist",
  "removeFromPlaylist",
  "createTag",
  "toggleTag",
  "preferences",
  "savePlayer",
  "listen",
  "window",
  "windowState",
];
export const defaultPreferences: DesktopPreferences = {
  language: "es",
  section: "home",
  sidebarWidth: 224,
  playerWidth: 360,
  playerVisible: true,
  zoomFactor: 1,
  closeToTray: false,
  pinnedShortcuts: [],
};
export function emptyPlayer(): PlayerPersistence {
  return {
    activeQueue: 0,
    volume: 1,
    queues: Array.from({ length: 5 }, (_, i) => ({
      name: `Cola ${i + 1}`,
      trackIds: [],
      index: 0,
      position: 0,
      manualTrackIds: [],
      shuffle: false,
      repeat: "off",
      shuffleOnEnd: false,
      accumulatedTime: 0,
    })),
  };
}
