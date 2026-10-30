import { mkdir, readFile, writeFile } from "node:fs/promises";
import { replaceFile } from './atomicFile';
import { join } from "node:path";
import { defaultPreferences, emptyPlayer } from "@mmplayer/platform";
import { normalizeDesktopZoom } from "../shared/desktopScale";
import type {
  DesktopPreferences,
  DesktopState,
  PlayerPersistence,
} from "@mmplayer/platform";

export function normalizePreferences(
  input: Partial<DesktopPreferences>,
): DesktopPreferences {
  return {
    language: ["en", "es", "pt"].includes(input.language ?? "")
      ? input.language!
      : "es",
    section:
      typeof input.section === "string" && input.section.length < 100
        ? input.section
        : "home",
    sidebarWidth: clamp(input.sidebarWidth, 64, 360, 224),
    playerWidth: clamp(input.playerWidth, 290, 520, 360),
    playerVisible: input.playerVisible !== false,
    zoomFactor: normalizeDesktopZoom(input.zoomFactor),
    closeToTray: input.closeToTray === true,
    pinnedShortcuts: Array.isArray(input.pinnedShortcuts)
      ? input.pinnedShortcuts.filter((item, index, all) =>
          item && ["tag", "folder"].includes(item.kind) &&
          typeof item.id === "string" && item.id.length > 0 && item.id.length <= 8192 &&
          typeof item.name === "string" && item.name.length <= 512 &&
          all.findIndex(other => other?.kind === item.kind && other?.id === item.id) === index,
        ).slice(0, 1000)
      : [],
  };
}
function clamp(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}
export function normalizePlayer(input: unknown): PlayerPersistence {
  const result = emptyPlayer();
  if (!input || typeof input !== "object") return result;
  const value = input as Partial<PlayerPersistence>;
  result.activeQueue = Math.floor(clamp(value.activeQueue, 0, 4, 0));
  result.volume = clamp(value.volume, 0, 1, 1);
  result.queues = result.queues.map((queue, index) => {
    const saved = value.queues?.[index];
    if (!saved || !Array.isArray(saved.trackIds)) return queue;
    const trackIds = saved.trackIds
      .filter((id): id is string => typeof id === "string" && id.length <= 200)
      .slice(0, 100000);
    return {
      name:
        typeof saved.name === "string" ? saved.name.slice(0, 60) : queue.name,
      trackIds,
      index: Math.floor(
        clamp(saved.index, 0, Math.max(0, trackIds.length - 1), 0),
      ),
      position: clamp(saved.position, 0, 604800, 0),
      manualTrackIds: Array.isArray(saved.manualTrackIds)
        ? saved.manualTrackIds
            .filter((id) => typeof id === "string")
            .slice(0, 100000)
        : [],
      shuffle: saved.shuffle === true,
      ...(Array.isArray(saved.shuffleOriginalTrackIds)
        ? {
            shuffleOriginalTrackIds: saved.shuffleOriginalTrackIds
              .filter(
                (id): id is string => typeof id === "string" && id.length <= 200,
              )
              .slice(0, 100000),
          }
        : {}),
      repeat: ["all", "one"].includes(saved.repeat) ? saved.repeat : "off",
      shuffleOnEnd: saved.shuffleOnEnd === true,
      accumulatedTime: clamp(saved.accumulatedTime, 0, 604800, 0),
    };
  });
  return result;
}
export class SettingsFile {
  private value: DesktopState = {
    preferences: { ...defaultPreferences },
    player: emptyPlayer(),
  };
  private pending: Promise<void> = Promise.resolve();
  constructor(private directory: string) {}
  async load() {
    await mkdir(this.directory, { recursive: true });
    try {
      const saved = JSON.parse(
        await readFile(join(this.directory, "settings.json"), "utf8"),
      );
      this.value = {
        preferences: normalizePreferences(saved.preferences ?? {}),
        player: normalizePlayer(saved.player),
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        console.warn("Desktop settings could not be read:", error);
    }
    return this.value;
  }
  get state() {
    return this.value;
  }
  async update(preferences?: Partial<DesktopPreferences>, player?: unknown) {
    this.value = {
      preferences: preferences
        ? normalizePreferences({ ...this.value.preferences, ...preferences })
        : this.value.preferences,
      player:
        player === undefined ? this.value.player : normalizePlayer(player),
    };
    const content = JSON.stringify(this.value);
    const write = this.pending
      .catch(() => {})
      .then(async () => {
        const temporary = join(this.directory, "settings.json.pending");
        await writeFile(temporary, content, "utf8");
        await replaceFile(temporary, join(this.directory, "settings.json"));
      });
    this.pending = write;
    await write;
    return this.value;
  }
  flush() {
    return this.pending;
  }
}
