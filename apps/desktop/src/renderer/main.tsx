import { syncDesktopPins } from "./pins";
import { FooterFunctions } from "./FooterFunctions";
import { startDiscordPresence } from '../../../../src/services/DiscordPresenceService';
import { requestDesktopNavigation } from "./navigationGuard";
import { startDesktopNotifications } from "./notifications";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createRoot } from "react-dom/client";
import { View, useWindowDimensions } from "react-native";
import { useTranslation, I18nextProvider } from "react-i18next";
import type {
  Command,
  DesktopCommands,
  DesktopPreferences,
  LibrarySnapshot,
  LibraryTrack,
  ScanProgress,
} from "@mmplayer/platform";
import { defaultPreferences } from "@mmplayer/platform";
import {
  parseSkipConfig,
  normalizeSkipSegments,
  parseTimestampInput,
  formatTimestampInput,
} from "@mmplayer/core/timestamps";
import { player } from "./player";
import { Icon } from "./Icon";
import { i18n } from "./strings";
import "./style.css";
import { DESKTOP_SPLIT_MIN_WIDTH, desktopPanelLayout } from "../shared/desktopScale";
import brandLogo from "../../../../src/assets/images/splash-icon.png";
import { MobileScreenHost, hasSharedScreen } from "./MobileScreenHost";
import { DesktopSheetHost, DesktopAlertModal } from "./DesktopSheetHost";
import { DesktopModalHost } from "./DesktopModalHost";
import { ExternalMusicDrop } from "./ExternalMusicDrop";
import { DesktopQueuePanel } from "./DesktopQueuePanel";
import {
  syncExclusionsToWorker,
  pullExclusionsFromWorker,
  reviewMissingDesktopFiles,
} from "./ports/scannerService";
import { useUIStore, openPlaylistSelector } from "../../../../src/store/useUIStore";
import { useSettingsStore } from "../../../../src/store/useSettingsStore";
import { usePlayerStore } from "./ports/playerStore";
import { EqualizerService } from "../../../../src/services/EqualizerService";
import { initializeReplayGain } from "../../../../src/services/ReplayGainService";
import { initializeCrossfade } from "../../../../src/services/CrossfadeService";
import { MediaAssetService } from "../../../../src/services/MediaAssetService";
import { TimestampService } from "./ports/timestampService";
import { Ionicons } from "@expo/vector-icons";
import { RepeatMode } from "react-native-track-player";
import MarqueeText from "../../../../src/components/common/MarqueeText";
import {
  PlayerControls as SharedPlayerControls,
  PlayerProgressSection,
  SKIP_PREVIOUS_THRESHOLD,
} from "../../../../src/screens/player/PlayerScreen";
import { useAppTheme } from "../../../../src/hooks/useAppTheme";
import { getAlbumEasterEgg } from "../../../../src/easterEggs/albumEasterEggs";
import { formatTrackTime } from "../../../../src/utils/time";

const emptyLibrary: LibrarySnapshot = {
  tracks: [],
  albums: [],
  artists: [],
  playlists: [],
  tags: [],
};
type Route = {
  section: string;
  kind?: string;
  id?: string;
  title?: string;
  screen?: string;
  params?: Record<string, unknown>;
};
type Modal = {
  kind: string;
  track?: LibraryTrack;
  target?: string;
  initial?: string;
};
const sections = [
  "home",
  "library",
  "search",
  "tags",
  "stats",
  "settings",
] as const;

const sidebarIcons: Record<string, [React.ComponentProps<typeof Ionicons>["name"], React.ComponentProps<typeof Ionicons>["name"]]> = {
  home: ["home-outline", "home"],
  library: ["library-outline", "library"],
  search: ["search-outline", "search"],
  tags: ["pricetags-outline", "pricetags"],
  stats: ["stats-chart-outline", "stats-chart"],
  settings: ["settings-outline", "settings"],
  queue: ["list-outline", "list"],
  folder: ["folder-outline", "folder"],
  plus: ["add-outline", "add"],
  refresh: ["sync-outline", "sync"],
  list: ["list-outline", "list"],
  album: ["disc-outline", "disc"],
  artist: ["person-outline", "person"],
};
function SidebarIcon({ name, selected = false }: { name: string; selected?: boolean }) {
  const icon = sidebarIcons[name][selected ? 1 : 0];
  return <span className="sidebar-icon" data-sidebar-icon={icon} aria-hidden="true"><Ionicons name={icon} size={24} color="currentColor" /></span>;
}

function Cover({
  track,
  cover,
  size = 48,
}: {
  track?: LibraryTrack | null;
  cover?: string | null;
  size?: number;
}) {
  const source = track?.cover || cover;
  return (
    <div className="cover" style={{ width: size, height: size }}>
      {source ? (
        <img
          src={source}
          alt=""
          onError={(event) => {
            event.currentTarget.style.visibility = "hidden";
          }}
        />
      ) : (
        <Icon name="music" size={size * 0.45} />
      )}
    </div>
  );
}
function WindowTitleBar({ zoomFactor, canGoBack, canGoForward, back, forward }: {
  zoomFactor: number;
  canGoBack: boolean;
  canGoForward: boolean;
  back: () => void;
  forward: () => void;
}) {
  const { t } = useTranslation("desktop");
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    let alive = true;
    const stop = window.mmplayer.on("windowState", (state) => setMaximized(state.maximized));
    void window.mmplayer.invoke("windowState", undefined).then((state) => {
      if (alive) setMaximized(state.maximized);
    });
    return () => { alive = false; stop(); };
  }, []);
  return (
    <header className="window-titlebar" style={{ zoom: 1 / zoomFactor }}>
      <div className="brand" role="img" aria-label="MMPlayer"
        style={{ backgroundImage: `url(${brandLogo})` }} />
      <nav className="window-history" aria-label={t("navigation")}>
        <button data-testid="header-history-back" disabled={!canGoBack}
          aria-label={t("back")} title={t("back")} onClick={back}>
          <Icon name="back" size={24} />
        </button>
        <button data-testid="header-history-forward" disabled={!canGoForward}
          aria-label={t("forward")} title={t("forward")} onClick={forward}>
          <Icon name="forward" size={24} />
        </button>
      </nav>
      <div className="window-drag-region" />
      <div className="window-controls">
        {(["minimize", "maximize", "close"] as const).map((action) => {
          const icon = action === "maximize" && maximized ? "restore" : action;
          return (
            <button key={action} className={`window-control window-${action}`}
              data-window-action={action} aria-label={t(icon)} title={t(icon)}
              onClick={() => { void window.mmplayer.invoke("window", action); }}>
              <Icon name={icon} size={12} />
            </button>
          );
        })}
      </div>
    </header>
  );
}

function App() {
  const { width: viewportWidth } = useWindowDimensions();
  const { t } = useTranslation("desktop");
  const [preferences, setPreferences] =
    useState<DesktopPreferences>(defaultPreferences);
  const [library, setLibrary] = useState<LibrarySnapshot>(emptyLibrary);
  const [ready, setReady] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanProgress | null>(null);
  const [history, setHistory] = useState<{ routes: Route[]; index: number }>({
    routes: [{ section: "home" }], index: 0,
  });
  const route = history.routes[history.index];
  const section = route.section;
  const [modal, setModal] = useState<Modal | null>(null);
  const [queueOpen, setQueueOpen] = useState(false),
    [narrowPlayerOpen, setNarrowPlayerOpen] = useState(false),
    [sidebarWidth, setSidebarWidth] = useState(224),
    [playerWidth, setPlayerWidth] = useState(360);
  const activeId = useSyncExternalStore(player.subscribe, player.getActiveId);
  const track = library.tracks.find((track) => track.id === activeId) || null;
  const invoke = useCallback(
    async <K extends Command>(
      command: K,
      input?: DesktopCommands[K]["input"],
    ): Promise<DesktopCommands[K]["output"]> => {
      try {
        return await window.mmplayer.invoke(
          command,
          input as DesktopCommands[K]["input"],
        );
      } catch (error) {
        setError(String(error));
        throw error;
      }
    },
    [],
  );
  const updatePreferences = useCallback(
    (patch: Partial<DesktopPreferences>) => {
      setPreferences((current) => ({ ...current, ...patch }));
      void invoke("preferences", patch).catch(() => {});
    },
    [invoke],
  );
  useEffect(
    () =>
      useUIStore.subscribe((state) => {
        if (!state.activeSheet) return;
        const kind = state.activeSheet;
        if (kind === "queue") {
          useUIStore.getState().closeSheet();
          updatePreferences({ playerVisible: true });
          setNarrowPlayerOpen(viewportWidth < DESKTOP_SPLIT_MIN_WIDTH);
          setQueueOpen(true);
          return;
        }
        if (kind === "local-cast") {
          useUIStore.getState().closeSheet();
          return;
        }
        if (kind === "player-menu") {
          updatePreferences({ playerVisible: true });
          setNarrowPlayerOpen(viewportWidth < DESKTOP_SPLIT_MIN_WIDTH);
        }
      }),
    [updatePreferences, viewportWidth],
  );
  useEffect(() => {
    let alive = true,
      revision = 0;
    let initialized = false;
    let stopLanguage = () => {};
    let stopEqualizer = () => {};
    let stopNotifications = () => {};
    const reload = async () => {
      const current = ++revision;
      const result = await window.mmplayer.invoke("library", undefined);
      if (alive && current === revision) {
        setLibrary(result);
        player.setTracks(result.tracks);
      }
    };
    const stop = window.mmplayer.on("library", () => {
      void reload().catch((error) => setError(String(error)));
    });
    const stopScan = window.mmplayer.on("scan", (value) => setScan(value));
    const stopPreferences = window.mmplayer.on("preferences", (value) => {
      setPreferences(value);
      setSidebarWidth(value.sidebarWidth);
      setPlayerWidth(value.playerWidth);
      syncDesktopPins(value);
    });
    const stopError = window.mmplayer.on("error", (value) => setError(value));
    const stopClose = window.mmplayer.onBeforeClose(() =>
      initialized ? player.saveNow() : Promise.resolve(),
    );
    void (async () => {
      const [state, result] = await Promise.all([
        window.mmplayer.invoke("state", undefined),
        window.mmplayer.invoke("library", undefined),
      ]);
      if (!alive) return;
      setPreferences(state.preferences);
      syncDesktopPins(state.preferences);
      setSidebarWidth(state.preferences.sidebarWidth);
      setPlayerWidth(state.preferences.playerWidth);
      setHistory({ routes: [{ section: sections.includes(state.preferences.section as never)
          ? state.preferences.section
          : "home" }], index: 0 });
      await useSettingsStore.persist.rehydrate();
      useSettingsStore.getState().setLanguage(state.preferences.language);
      useSettingsStore.setState({
        hasSeenLibraryTutorial: true,
        hasSeenTagsTutorial: true,
        hasSeenSearchTutorial: true,
        hasSeenActivityTutorial: true,
        hasSeenPlayerTutorial: true,
      });
      await i18n.changeLanguage(state.preferences.language);
      stopLanguage = useSettingsStore.subscribe((next, previous) => {
        if (next.language && next.language !== previous.language)
          void window.mmplayer
            .invoke("preferences", {
              language: next.language as "es" | "en" | "pt",
            })
            .catch((error) => setError(String(error)));
      });
      setLibrary(result);
      player.setFadeEnabledProvider(
        () => useSettingsStore.getState().isFadeEnabled,
      );
      await initializeReplayGain();
      await initializeCrossfade();
      stopEqualizer = EqualizerService.subscribeToPlayback();
      await MediaAssetService.init();
      MediaAssetService.migrateLegacyCacheAssets();
      MediaAssetService.runGarbageCollector();
      player.initialize(state.player, result.tracks);
      await TimestampService.initialize();
      await usePlayerStore.getState().restoreRecentsState();
      await usePlayerStore.getState().refreshRecentsFromDatabase();
      initialized = true;
      setReady(true);
      startDiscordPresence();
      if (alive) void reviewMissingDesktopFiles().catch((error) => setError(String(error)));
      if (alive) stopNotifications = startDesktopNotifications();
    })().catch((error) => setError(String(error)));
    return () => {
      alive = false;
      stop();
      stopScan();
      stopError();
      stopPreferences();
      stopClose();
      stopLanguage();
      stopEqualizer();
      stopNotifications();
    };
  }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (modal) setModal(null);
        else if (queueOpen) setQueueOpen(false);
      }
      if (
        event.target instanceof Element && event.target.closest(
          "input,textarea,select,[contenteditable=true]",
        )
      )
        return;
      if (event.code === "Space") {
        event.preventDefault();
        player.toggle();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [modal, queueOpen]);
  const navigate = (destination: Route) => {
    requestDesktopNavigation(() => {
      setHistory((previous) => {
        if (JSON.stringify(previous.routes[previous.index]) === JSON.stringify(destination)) return previous;
        return {
          routes: [...previous.routes.slice(0, previous.index + 1), destination],
          index: previous.index + 1,
        };
      });
      updatePreferences({ section: destination.section });
    });
  };
  const back = (step: number) =>
    requestDesktopNavigation(() => {
      setHistory((current) => ({
        ...current,
        index: Math.max(
          0,
          Math.min(current.routes.length - 1, current.index + step),
        ),
      }));
    });
  const navigateShared = (name: string, params?: Record<string, unknown>) => {
    if (name === "Lyrics" && route.screen === "Lyrics") {
      back(-1);
      return;
    }
    if (name === "Biblioteca" || name === "Library") {
      navigate({ section: "library", params });
      return;
    }
    if (!hasSharedScreen(name)) {
      setError(t("desktopPending"));
      return;
    }
    const isSettingsRoute =
      name === "Settings" ||
      name.startsWith("Settings") ||
      name === "ExcludedMedia" ||
      name.startsWith("Debug");
    navigate({
      section: isSettingsRoute ? "settings" : section,
      kind: "mobile",
      screen: name,
      params,
    });
  };
  const pick = (folders: boolean) => {
    void syncExclusionsToWorker()
      .then(() => invoke("pickMusic", { folders }))
      .then(() => pullExclusionsFromWorker())
      .catch(() => {});
  };
  const resize = (
    side: "sidebar" | "player",
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    const start = event.clientX,
      initial = side === "sidebar" ? layout.sidebarWidth : layout.playerWidth;
    let value = initial;
    let frame = 0;
    const paint = () => {
      frame = 0;
      if (side === "sidebar") setSidebarWidth(value);
      else setPlayerWidth(value);
    };
    const move = (event: PointerEvent) => {
      value = Math.max(
        side === "sidebar" ? 64 : 290,
        Math.min(
          side === "sidebar" ? 360 : 520,
          initial + (event.clientX - start) * (side === "sidebar" ? 1 : -1),
        ),
      );
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("blur", end);
      cancelAnimationFrame(frame);
      paint();
      updatePreferences(
        side === "sidebar" ? { sidebarWidth: value } : { playerWidth: value },
      );
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("blur", end);
  };
  const layout = desktopPanelLayout(viewportWidth, sidebarWidth, playerWidth, preferences.playerVisible);
  const compact = layout.sidebarWidth < 150;
  const rightVisible = preferences.playerVisible && (layout.playerVisible || narrowPlayerOpen);
  const openPlayer = () => {
    setNarrowPlayerOpen(viewportWidth < DESKTOP_SPLIT_MIN_WIDTH);
    updatePreferences({ playerVisible: true });
  };
  useEffect(() => {
    if (viewportWidth >= DESKTOP_SPLIT_MIN_WIDTH) setNarrowPlayerOpen(false);
  }, [viewportWidth]);
  const appTabsOrder = useSettingsStore((state) => state.appTabsOrder);
  const orderedSections = useMemo(() => {
    const tabToSection: Record<string, (typeof sections)[number]> = {
      Inicio: "home",
      Biblioteca: "library",
      Buscar: "search",
      Etiquetas: "tags",
      Actividad: "stats",
    };
    const mapped = (appTabsOrder || [])
      .map((tab) => tabToSection[tab])
      .filter((s): s is (typeof sections)[number] => Boolean(s));
    for (const s of ["home", "library", "search", "tags", "stats"] as const) {
      if (!mapped.includes(s)) mapped.push(s);
    }
    mapped.push("settings");
    return mapped;
  }, [appTabsOrder]);
  return (
    <View
      testID="desktop-shell"
      style={{
        width: "100%",
        height: "100%",
        flexShrink: 0,
        backgroundColor: "#0f0f0f",
      }}
    >
      <WindowTitleBar zoomFactor={preferences.zoomFactor}
        canGoBack={history.index > 0} canGoForward={history.index < history.routes.length - 1}
        back={() => back(-1)} forward={() => back(1)} />
      <div
        className="app-body"
        style={{
          gridTemplateColumns: `${layout.sidebarWidth}px minmax(0,1fr) ${layout.playerWidth}px`,
        }}
      >
        <aside className={`sidebar${compact ? " sidebar-compact" : ""}`}>
          <nav>
            {orderedSections.map((item) => (
              <button
                title={t(item)}
                key={item}
                className={section === item ? "selected-nav" : ""}
                onClick={() => navigate({ section: item })}
              >
                <SidebarIcon name={item} selected={section === item} />
                {!compact && <span>{t(item)}</span>}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            {!compact && <small>{t("local")}</small>}
            <button onClick={() => pick(true)} title={t("addFolder")}>
              <SidebarIcon name="folder" />
              {!compact && t("addFolder")}
            </button>
            <button onClick={() => pick(false)} title={t("addFiles")}>
              <SidebarIcon name="plus" />
              {!compact && t("addFiles")}
            </button>
            <button
              onClick={() => {
                void invoke("scan").catch(() => {});
              }}
              title={t("scan")}
            >
              <SidebarIcon name="refresh" />
              {!compact && t("scan")}
            </button>
            <div className="sidebar-pins" data-testid="sidebar-pins">
              {[
                ...library.playlists.filter(item => item.isPinned).map(item => ({ ...item, kind: "playlist", icon: "list" })),
                ...library.albums.filter(item => item.isPinned).map(item => ({ ...item, kind: "album", icon: "album" })),
                ...library.artists.filter(item => item.isPinned).map(item => ({ ...item, kind: "artist", icon: "artist" })),
                ...(preferences.pinnedShortcuts || []).flatMap(item => {
                  if (item.kind === "tag") {
                    const tag = library.tags.find(tag => tag.id === item.id);
                    return tag ? [{ ...item, name: tag.name, icon: "tags" }] : [];
                  }
                  return [{ ...item, icon: "folder" }];
                }),
              ].sort((a, b) => a.name.localeCompare(b.name, preferences.language, { sensitivity: "base", numeric: true }) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id)).map(item => (
                <button key={`${item.kind}:${item.id}`} title={item.name}
                  data-pin-kind={item.kind} data-pin-id={item.id}
                  onClick={() => item.kind === "folder"
                    ? navigateShared("FolderDetail", { folderPath: item.id, folderName: item.name })
                    : navigate({ section: item.kind === "tag" ? "tags" : "library", kind: item.kind, id: item.id, title: item.name })}
                  onContextMenu={event => {
                    event.preventDefault();
                    const open = useUIStore.getState().openSheet;
                    if (item.kind === "folder") open("folder-menu", { folderPath: item.id, folderName: item.name });
                    else void import("./ports/database").then(async ({ database }) => {
                      const table = item.kind === "tag" ? "tags" : `${item.kind}s`;
                      const model = await database.get(table).find(item.id);
                      open(`${item.kind}-menu` as any, { [item.kind]: model });
                    });
                  }}>
                  <SidebarIcon name={item.icon} />{!compact && <span>{item.name}</span>}
                </button>
              ))}
            </div>
          </div>
          <button
            className="resize-handle right"
            aria-label={t("resizeSidebar")}
            onPointerDown={(event) => resize("sidebar", event)}
          />
        </aside>
        <main className="center">
          {!ready ? (
            <div className="empty" aria-busy="true" />
          ) : (
            <div
              className="mobile-screen"
              key={
                section +
                ":" +
                (route.screen || route.kind || "") +
                ":" +
                (route.id || "")
              }
            >
              <MobileScreenHost
                name={
                  route.screen ||
                  (route.kind === "lyrics"
                    ? "Lyrics"
                    : (
                        {
                          album: "AlbumDetail",
                          artist: "ArtistDetail",
                          playlist: "PlaylistDetail",
                          favorites: "FavoritesDetail",
                          tag: "TagDetail",
                        } as Record<string, string>
                      )[route.kind || ""]) ||
                  (
                    {
                      home: "Home",
                      library: "Library",
                      search: "Search",
                      tags: "Tags",
                      stats: "WeeklyActivity",
                      settings: "Settings",
                    } as Record<string, string>
                  )[section]
                }
                params={
                  route.params ||
                  (route.id
                    ? {
                        albumId: route.id,
                        artistId: route.id,
                        playlistId: route.id,
                        tagId: route.id,
                      }
                    : undefined)
                }
                history={{
                  canGoBack: history.index > 0,
                  canGoForward: history.index < history.routes.length - 1,
                  back: () => back(-1),
                  forward: () => back(1),
                }}
                back={() => back(-1)}
                navigate={navigateShared}
              />
            </div>
          )}
        </main>
        {rightVisible && (
          <aside className={`player-panel ${!track ? "player-panel-empty" : ""} ${layout.playerVisible ? "" : "player-panel-overlay"}`}>
            <button
              className="resize-handle left"
              aria-label={t("resizePlayer")}
              onPointerDown={(event) => resize("player", event)}
            />
            {track ? (
              <div className="mobile-screen">
                <MobileScreenHost
                  name="Player"
                  hidePlayerLyrics={route.screen === "Lyrics" || route.kind === "lyrics"}
                  back={() => updatePreferences({ playerVisible: false })}
                  navigate={navigateShared}
                />
              </div>
            ) : (
              <div className="empty">
                <p>{t("nothingPlaying")}</p>
              </div>
            )}
            {queueOpen && (
              <DesktopQueuePanel close={() => setQueueOpen(false)} />
            )}
          </aside>
        )}
      </div>
      <Footer
        track={track}
        favorite={() =>
          track &&
          void invoke("favorite", { trackId: track.id }).catch(() => {})
        }
        openPlayer={openPlayer}
        playerOpen={rightVisible}
        togglePlayer={() => {
          if (rightVisible) {
            setNarrowPlayerOpen(false);
            updatePreferences({ playerVisible: false });
          } else openPlayer();
        }}
        playlist={() => {
          if (!track) return;
          void import("./ports/database").then(async ({ database }) => {
            openPlaylistSelector(await database.get("tracks").find(track.id));
          }).catch(error => setError(String(error)));
        }}
        lyricsOpen={route.screen === "Lyrics"}
        toggleLyrics={() => navigateShared("Lyrics")}
        queueOpen={rightVisible && queueOpen}
        toggleQueue={() => {
          if (rightVisible && queueOpen) setQueueOpen(false);
          else useUIStore.getState().openSheet("queue");
        }}
        share={() => {
          if (!track) return;
          const active = usePlayerStore.getState().activeTrack;
          void (async () => {
            const album = await active?.album?.fetch?.().catch(() => null);
            navigateShared("ShareSong", {
              trackId: track.id, title: track.title, artist: track.artist,
              album: track.album, coverUrl: album?.coverUrl || track.cover,
              fileUrl: track.fileUrl, duration: track.duration,
            });
          })();
        }}
      />
      {scan?.active && (
        <div className="scan-indicator" role="status">
          ↻ {t("applying")} · {scan.completed}
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}
      {modal && (
        <Editor
          modal={modal}
          close={() => setModal(null)}
          save={async (value) => {
            if (modal.kind === "rename") player.renameQueue(value);
            if (modal.kind === "lyrics")
              await invoke("saveLyrics", {
                trackId: modal.track!.id,
                lyrics: value,
              });
            if (modal.kind === "timestamps") {
              const segments = value
                .split("\n")
                .filter((line) => line.trim())
                .map((line, index) => {
                  const [start, end] = line.split(/→|->/);
                  return {
                    id: String(index),
                    startMs: parseTimestampInput(start?.trim() || "") ?? NaN,
                    endMs: parseTimestampInput(end?.trim() || "") ?? NaN,
                  };
                });
              await invoke("saveTimestamps", {
                trackId: modal.track!.id,
                value: JSON.stringify({
                  enabled: true,
                  segments: normalizeSkipSegments(
                    segments,
                    modal.track!.duration * 1000,
                  ),
                }),
              });
            }
            if (modal.kind === "playlist") {
              const id = await invoke("createPlaylist", { name: value });
              if (modal.track)
                await invoke("addToPlaylist", {
                  playlistId: id,
                  trackIds: [modal.track.id],
                });
            }
            if (modal.kind === "tag")
              await invoke("createTag", { name: value, color: "#8b5cf6" });
            setModal(null);
          }}
        />
      )}
      <DesktopSheetHost />
      <DesktopAlertModal />
      <DesktopModalHost />
      <ExternalMusicDrop />
    </View>
  );
}
function Footer({
  track,
  favorite,
  openPlayer,
  playerOpen,
  togglePlayer,
  playlist,
  lyricsOpen,
  toggleLyrics,
  queueOpen,
  toggleQueue,
  share,
}: {
  track: LibraryTrack | null;
  favorite: () => void;
  openPlayer: () => void;
  playerOpen: boolean;
  togglePlayer: () => void;
  playlist: () => void;
  lyricsOpen: boolean;
  toggleLyrics: () => void;
  queueOpen: boolean;
  toggleQueue: () => void;
  share: () => void;
}) {
  const state = useSyncExternalStore(player.subscribe, player.getSnapshot);
  const { t } = useTranslation("desktop");
  const { colors, fonts } = useAppTheme();
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  const queue = state.queues[state.activeQueue];
  const hasPrevious = queue.index > 0 || queue.repeat === "all";
  const hasNext =
    queue.index < queue.trackIds.length - 1 ||
    queue.repeat === "all" ||
    queue.shuffleOnEnd;
  const repeatMode =
    queue.repeat === "one"
      ? RepeatMode.Track
      : queue.repeat === "all"
        ? RepeatMode.Queue
        : RepeatMode.Off;

  const duration = state.duration || track?.duration || 0;
  const displayPosition = isSeeking ? seekValue : state.position;
  const albumEasterEgg = getAlbumEasterEgg(track?.album, track?.artist);

  return (
    <footer className="bottom-player">
      <div className="footer-left">
        <button className="footer-track" onClick={openPlayer}>
          <Cover track={track} />
          <div className="footer-track-text">
            <strong className="sr-only">
              {track?.title || t("nothingPlaying")}
            </strong>
            <MarqueeText
              key={`footer-title-${track?.id || "none"}`}
              text={track?.title || t("nothingPlaying")}
              style={{
                color: colors.text,
                fontSize: 14,
                fontWeight: "700",
                fontFamily: fonts.regular,
                marginBottom: 2,
              }}
              speed={40}
              pauseDuration={1800}
            />
            {track?.artist ? (
              <MarqueeText
                key={`footer-artist-${track.id}`}
                text={track.artist}
                style={{
                  color: colors.textSecondary,
                  fontSize: 12,
                  fontWeight: "700",
                  fontFamily: fonts.regular,
                }}
                speed={35}
                pauseDuration={2000}
              />
            ) : null}
          </div>
        </button>
        <button
          className={`footer-heart-button ${track?.isFavorite ? "active liked" : ""}`}
          aria-label={t("like")}
          title={t("like")}
          onClick={favorite}
          disabled={!track}
        >
          <Ionicons
            name={track?.isFavorite ? "heart" : "heart-outline"}
            size={24}
            color={track?.isFavorite ? colors.heartIcon : colors.text}
          />
        </button>
        <button className="footer-heart-button" data-testid="footer-add-to-playlist"
          aria-label={i18n.t("actions.add_to_playlist")} title={i18n.t("actions.add_to_playlist")}
          onClick={playlist} disabled={!track}>
          <Ionicons name="add" size={24} color={colors.text} />
        </button>
      </div>
      <div className="footer-transport">
        <SharedPlayerControls
          compact
          isShuffleEnabled={queue.shuffle}
          hasPrevious={hasPrevious}
          hasNext={hasNext}
          position={state.position}
          repeatMode={repeatMode}
          colors={colors}
          onToggleShuffle={() => player.shuffle()}
          onSkipPrevious={() => {
            if (state.position > SKIP_PREVIOUS_THRESHOLD) {
              player.seek(0);
            } else {
              void player.previous();
            }
          }}
          onSkipNext={() => {
            void player.next();
          }}
          onCycleRepeat={() => player.repeat()}
        />
        <div className="footer-progress-row">
          <PlayerProgressSection
            compact
            easterEgg={albumEasterEgg}
            isLocalCastActive={false}
            duration={duration}
            displayPosition={displayPosition}
            isSeeking={isSeeking}
            seekValue={seekValue}
            colors={colors}
            t={t}
            formatTimestamp={formatTrackTime}
            onSlidingStart={(value) => { setIsSeeking(true); setSeekValue(value); }}
            onValueChange={(value) => { setIsSeeking(true); setSeekValue(value); }}
            onSlidingComplete={(value) => { setIsSeeking(false); player.seek(value); }}
          />
        </div>
      </div>
      <div className="footer-tools">
        <FooterFunctions available={Boolean(track)} hasLyrics={Boolean(track?.lyricsLRC?.trim())}
          lyricsOpen={lyricsOpen} queueOpen={queueOpen} toggleLyrics={toggleLyrics} toggleQueue={toggleQueue} share={share}
          playerOpen={playerOpen} togglePlayer={togglePlayer} />
        <div className="volume">
        <Icon name="volume" />
        <input
          type="range"
          aria-label={t("volume")}
          min="0"
          max="1"
          step="0.01"
          value={state.volume}
          onChange={(event) => player.volume(Number(event.target.value))}
        />
        </div>
      </div>
    </footer>
  );
}
function Editor({
  modal,
  close,
  save,
}: {
  modal: Modal;
  close: () => void;
  save: (value: string) => Promise<void>;
}) {
  const { t } = useTranslation("desktop");
  const [value, setValue] = useState(modal.initial || ""),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const [eq, setEq] = useState([0, 0, 0, 0, 0, 0]),
    [eqEnabled, setEqEnabled] = useState(false);
  const input = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  useEffect(() => {
    input.current?.focus();
    const previous = document.activeElement as HTMLElement;
    return () => previous?.focus();
  }, []);
  const title =
    modal.kind === "playlist"
      ? t("newPlaylist")
      : modal.kind === "tag"
        ? t("newTag")
        : modal.kind === "lyrics"
          ? t("editLyrics")
          : modal.kind === "timestamps"
            ? t("editTimestamps")
            : modal.kind === "audio"
              ? t("audio")
              : t("rename");
  return (
    <div
      className="modal-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !saving) close();
      }}
    >
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={(event) => {
          event.preventDefault();
          setSaving(true);
          void save(value).catch((error) => {
            setError(String(error));
            setSaving(false);
          });
        }}
        onKeyDown={(event) => {
          if (event.key === "Tab") {
            const nodes = event.currentTarget.querySelectorAll<HTMLElement>(
              "button:not(:disabled),input,textarea,select",
            );
            const first = nodes[0],
              last = nodes[nodes.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header>
          <h2>{title}</h2>
          <button type="button" aria-label={t("close")} onClick={close}>
            ×
          </button>
        </header>
        {modal.kind === "audio" ? (
          <>
            <label>
              {t("speed")}
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.05"
                defaultValue="1"
                onChange={(event) => player.speed(Number(event.target.value))}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={eqEnabled}
                onChange={(event) => {
                  setEqEnabled(event.target.checked);
                  player.equalizer(eq, event.target.checked);
                }}
              />
              {t("eqEnable")}
            </label>
            <div className="eq">
              {eq.map((gain, index) => (
                <label key={index}>
                  {[60, 170, 350, 1000, 3500, 10000][index]} Hz
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    value={gain}
                    onChange={(event) => {
                      const gains = [...eq];
                      gains[index] = Number(event.target.value);
                      setEq(gains);
                      player.equalizer(gains, eqEnabled);
                    }}
                  />
                  {gain} dB
                </label>
              ))}
            </div>
          </>
        ) : (
          <>
            {modal.kind === "timestamps" && <p>{t("timestampsHelp")}</p>}
            {["lyrics", "timestamps"].includes(modal.kind) ? (
              <textarea
                ref={(element) => {
                  input.current = element;
                }}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                rows={12}
              />
            ) : (
              <input
                ref={(element) => {
                  input.current = element;
                }}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                required
                maxLength={200}
                aria-label={t("name")}
              />
            )}
            {["lyrics", "timestamps"].includes(modal.kind) && (
              <small>{t("filesUnchanged")}</small>
            )}
          </>
        )}
        {error && <p role="alert">{error}</p>}
        <footer>
          <button type="button" onClick={close}>
            {t("cancel")}
          </button>
          {modal.kind !== "audio" && (
            <button className="primary" disabled={saving}>
              {t("save")}
            </button>
          )}
        </footer>
      </form>
    </div>
  );
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <div role="alert" className="empty">
        <h1>MMPlayer</h1>
        <p>{this.state.error}</p>
      </div>
    ) : (
      this.props.children
    );
  }
}
// Prevent dragging images, links and non-draggable elements
window.addEventListener("dragstart", (e) => {
  const target = e.target as HTMLElement | null;
  if (
    target?.tagName === "IMG" ||
    target?.closest?.("img") ||
    target?.tagName === "A" ||
    (!target?.hasAttribute?.("draggable") && !target?.closest?.("[draggable='true']"))
  ) {
    e.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>
  </ErrorBoundary>,
);
