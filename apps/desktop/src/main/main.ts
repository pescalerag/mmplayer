import { captureCard } from "./cardCapture";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  protocol,
  session,
  Tray,
  Menu,
  nativeImage,
} from "electron";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { join, resolve, extname, sep } from "node:path";
import { desktopCommands } from "@mmplayer/platform";
import { SettingsFile } from "./settings";
import { LibraryWorkerClient } from "./workerClient";
import { mediaResponse } from "./media";
import { normalizeDesktopZoom, stepDesktopZoom } from "../shared/desktopScale";
import { TaskbarTransport } from "./taskbarTransport";
import { registerWindowsIdentity, WINDOWS_APP_ID } from './windowsIdentity';
import { DiscordPresenceClient } from './discordPresence';
import { DISCORD_APPLICATION_ID, MMPLAYER_WEBSITE } from '../../../../src/config/discord';
import { publicArtworkUrl } from '../../../../src/services/discord/activity';
const discordPresence = new DiscordPresenceClient(process.env.MMPLAYER_DESKTOP_SMOKE_AUDIO && process.env.MMPLAYER_DISCORD_TEST_PIPE
  ? { paths: [process.env.MMPLAYER_DISCORD_TEST_PIPE] } : {});

protocol.registerSchemesAsPrivileged([
  {
    scheme: "mmplayer",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
  {
    scheme: "mmplayer-media",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);
app.setName("MMPlayer");
if (process.platform === "win32")
  app.setAppUserModelId(WINDOWS_APP_ID);
if (process.env.MMPLAYER_DESKTOP_DATA)
  app.setPath("userData", resolve(process.env.MMPLAYER_DESKTOP_DATA));
else app.setPath("userData", join(app.getPath("appData"), "MMPlayer Desktop"));
const locked = app.requestSingleInstanceLock();
if (!locked) app.quit();
let window: BrowserWindow | null = null;
let library: LibraryWorkerClient;
let settings: SettingsFile;
let taskbar: TaskbarTransport | undefined;
const rendererErrors: string[] = [];
let quitting = false;
let tray: Tray | null = null;
const origin = "mmplayer://app";
app.on("second-instance", () => {
  if (window?.isMinimized()) window.restore();
  window?.show();
  window?.focus();
});

function emit(event: string, data: unknown) {
  if (window && !window.isDestroyed())
    window.webContents.send("mmplayer:event", { event, data });
}
function applyDesktopScale() {
  if (!window || window.isDestroyed()) return;
  const factor = normalizeDesktopZoom(settings.state.preferences.zoomFactor);
  if (Math.abs(window.webContents.getZoomFactor() - factor) > 0.0001)
    window.webContents.setZoomFactor(factor);
}
function configureTray() {
  tray?.destroy();
  tray = null;
  if (!settings.state.preferences.closeToTray) return;
  tray = new Tray(
    nativeImage
      .createFromPath(join(__dirname, "icon.png"))
      .resize({ width: 20, height: 20 }),
  );
  tray.setToolTip("MMPlayer");
  tray.on("click", () => window?.show());
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "MMPlayer", click: () => window?.show() },
      {
        label: "Quit",
        click: () => {
          app.quit();
        },
      },
    ]),
  );
}

async function start() {
  const directory = app.getPath("userData");
  await mkdir(directory, { recursive: true });
  // Register before creating the window/media session, including unpackaged launches.
  // Test profiles must never replace the user's real Start menu shortcut.
  const windowsIcon = process.env.MMPLAYER_DESKTOP_DATA ? undefined : await registerWindowsIdentity({
    iconPath: join(__dirname, 'icon.png'),
  }).catch(error => { console.error('Windows identity:', error); return undefined; });
  settings = new SettingsFile(directory);
  await settings.load();
  library = new LibraryWorkerClient(
    join(__dirname, "libraryWorker.cjs"),
    directory,
    emit,
  );
  await library.request("initialize", settings.state.preferences.language);
  if (process.env.MMPLAYER_DESKTOP_SMOKE_AUDIO) {
    await library.request("addRoots", [
      resolve(process.env.MMPLAYER_DESKTOP_SMOKE_AUDIO),
    ]);
    const fixture =
      await library.request<import("@mmplayer/platform").LibrarySnapshot>(
        "library",
      );
    await library.request("saveLyrics", {
      trackId: fixture.tracks[0].id,
      lyrics:
        "[00:00.00]Shared mobile PlayerScreen\n[00:10.00]Desktop playback test",
    });
  }
  protocol.handle("mmplayer-media", (request) =>
    mediaResponse(request, (id, kind) =>
      library.request("media", { id, kind }),
    ),
  );
  const webRoot = resolve(__dirname, "renderer");
  protocol.handle("mmplayer", async (request) => {
    const url = new URL(request.url);
    if (url.hostname !== "app") return new Response(null, { status: 404 });
    const path = resolve(
      webRoot,
      "." +
        decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname),
    );
    if (!path.startsWith(webRoot + sep))
      return new Response(null, { status: 403 });
    try {
      const content = await readFile(path);
      const mime: Record<string, string> = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".ttf": "font/ttf",
        ".png": "image/png",
        ".svg": "image/svg+xml",
      };
      return new Response(content, {
        headers: {
          "Content-Type": mime[extname(path)] || "application/octet-stream",
          "Content-Security-Policy":
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: mmplayer-media: https://api.deezer.com https://*.dzcdn.net; media-src 'self' blob: mmplayer-media:; font-src 'self'; connect-src 'self' data: blob: mmplayer-media: https://lrclib.net https://api.deezer.com https://*.dzcdn.net; object-src 'none'; base-uri 'none'",
        },
      });
    } catch {
      return new Response(null, { status: 404 });
    }
  });
  session.defaultSession.webRequest.onHeadersReceived(
    {
      urls: [
        "https://api.deezer.com/*",
        "https://*.dzcdn.net/*",
      ],
    },
    (details, callback) => {
      const responseHeaders = { ...(details.responseHeaders || {}) };
      delete responseHeaders["access-control-allow-origin"];
      delete responseHeaders["Access-Control-Allow-Origin"];
      responseHeaders["Access-Control-Allow-Origin"] = ["*"];
      callback({ responseHeaders });
    },
  );
  session.defaultSession.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  ipcMain.handle(
    "mmplayer:invoke",
    async (event, command: string, input: unknown) => {
      if (
        event.sender !== window?.webContents ||
        event.senderFrame !== window.webContents.mainFrame ||
        !event.senderFrame.url.startsWith(origin + "/")
      )
        throw Error("Untrusted desktop request");
      if (!desktopCommands.includes(command as never))
        throw Error("Unknown command");
      if (command === "state") return settings.state;
      if (command === 'discordPresence') {
        const request = input as any;
        if (request?.op === 'disconnect') { discordPresence.disconnect();return discordPresence.status; }
        if (request?.op === 'configure' && request.applicationId === DISCORD_APPLICATION_ID) return discordPresence.configure(DISCORD_APPLICATION_ID);
        if (request?.op === 'activity') {
          const activity = request.activity;
          if (activity !== null && (!activity || activity.type !== 2 || activity.status_display_type !== 0
            || !['name', 'details', 'state'].every(key => typeof activity[key] === 'string' && activity[key].length <= 256)
            || activity.assets?.large_url !== MMPLAYER_WEBSITE
            || (activity.assets.large_image !== 'mmplayer' && !publicArtworkUrl(activity.assets.large_image))
            || JSON.stringify(activity).length > 8192)) throw Error('Invalid Discord activity');
          discordPresence.setActivity(activity);return discordPresence.status;
        }
        throw Error('Invalid Discord presence request');
      }
      if (command === "transportState") {
        const state = input as {
          playing: boolean;
          available: boolean;
          title: string;
          artist: string;
        };
        if (
          !state ||
          typeof state.playing !== "boolean" ||
          typeof state.available !== "boolean" ||
          typeof state.title !== "string" ||
          typeof state.artist !== "string"
        )
          throw Error("Invalid transport state");
        taskbar?.update(
          {
            ...state,
            title: state.title.slice(0, 512),
            artist: state.artist.slice(0, 512),
          },
          settings.state.preferences.language,
        );
        return;
      }
      if (command === "preferences") {
        const previous = settings.state.preferences;
        const value = await settings.update(input as never);
        if (previous.closeToTray !== value.preferences.closeToTray)
          configureTray();
        if (previous.language !== value.preferences.language)
          await library.request("language", value.preferences.language);
        if (previous.zoomFactor !== value.preferences.zoomFactor)
          applyDesktopScale();
        emit("preferences", value.preferences);
        return value.preferences;
      }
      if (command === "savePlayer") {
        await settings.update(undefined, input);
        return;
      }
      if (command === "windowState") return { maximized: window.isMaximized() };
      if (command === "window") {
        if (input === "minimize") window.minimize();
        else if (input === "maximize") {
          if (window.isMaximized()) window.unmaximize();
          else window.maximize();
        } else if (input === "close") window.close();
        return;
      }
      if (command === "captureCard") return captureCard(input as never, directory);
      if (command === "saveFile") {
        const request = input as { uri: string; name: string };
        const uri = new URL(request.uri);
        if (uri.protocol !== 'file:' && (uri.protocol !== "mmplayer-media:" || !["asset", "track", "cover"].includes(uri.hostname))) throw Error("Invalid export URI");
        const source = uri.protocol === 'file:'
          ? await library.request<string>('trackExportPath', uri.href)
          : await library.request<string | null>("media", { id: decodeURIComponent(uri.pathname.slice(1)), kind: uri.hostname });
        if (!source) throw Error("Export file does not exist");
        const result = await dialog.showSaveDialog(window, { defaultPath: request.name.replace(/[<>:"/\\|?*]/g, "_") });
        if (result.canceled || !result.filePath) return false;
        await copyFile(source, result.filePath); return true;
      }
      if (command === "pickMusic") {
        const folders = (input as { folders?: boolean })?.folders === true;
        const result = await dialog.showOpenDialog(window, {
          properties: folders
            ? ["openDirectory", "multiSelections"]
            : ["openFile", "multiSelections"],
          filters: folders
            ? undefined
            : [
                {
                  name: "Audio",
                  extensions: [
                    "mp3",
                    "flac",
                    "ogg",
                    "opus",
                    "m4a",
                    "aac",
                    "wav",
                    "wma",
                    "aiff",
                    "ape",
                    "wv",
                  ],
                },
              ],
        });
        return result.canceled
          ? 0
          : library.request("addRoots", result.filePaths);
      }
      return library.request(command, input);
    },
  );
  ipcMain.handle("mmplayer:drop", (event, paths: string[]) => {
    if (
      event.sender !== window?.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      !event.senderFrame.url.startsWith(origin + "/")
    )
      throw Error("Untrusted desktop request");
    return library.request("importPaths", paths);
  });
  window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 640,
    show: false,
    frame: false,
    backgroundColor: "#0f0f0f",
    title: "MMPlayer",
    icon: join(__dirname, "icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  window.setMenu(null);
  if (process.platform === 'win32') window.setAppDetails({
    appId: WINDOWS_APP_ID,
    appIconPath: windowsIcon ?? join(__dirname, 'icon.png'),
    relaunchDisplayName: 'MMPlayer',
  });
  const emitWindowState = () => emit("windowState", { maximized: window!.isMaximized() });
  window.on("maximize", emitWindowState);
  window.on("unmaximize", emitWindowState);
  // Browser zoom keeps native pointer coordinates, portals and layout measurements aligned.
  window.webContents.on("did-finish-load", () => {
    applyDesktopScale();
  });
  window.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown" || !(input.control || input.meta) || input.alt)
      return;
    const key = input.key;
    const delta = ["+", "="].includes(key) ? 1 : key === "-" ? -1 : 0;
    if (!delta && key !== "0") return;
    event.preventDefault();
    const zoomFactor =
      key === "0"
        ? 1
        : stepDesktopZoom(settings.state.preferences.zoomFactor, delta);
    window!.webContents.setZoomFactor(zoomFactor);
    void settings
      .update({ zoomFactor })
      .then((state) => emit("preferences", state.preferences))
      .catch((error) => emit("error", String(error)));
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  taskbar = new TaskbarTransport(window, (action) => emit("transport", action));
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(origin + "/")) event.preventDefault();
  });
  window.webContents.on("render-process-gone", (_event, details) =>
    console.error("Desktop renderer stopped:", details.reason),
  );
  window.webContents.on("console-message", (event) => {
    if (event.level === "error") {
      rendererErrors.push(event.message);
      console.error("Renderer:", event.message);
    }
  });
  window.on("close", (event) => {
    if (!quitting && settings.state.preferences.closeToTray && tray) {
      event.preventDefault();
      window?.hide();
    } else if (!quitting) {
      event.preventDefault();
      app.quit();
    }
  });
  window.once("ready-to-show", () => {
    if (!process.env.MMPLAYER_DESKTOP_SMOKE) window?.show();
    else window?.showInactive();
  });
  configureTray();
  await window.loadURL(origin + "/index.html");
  // Startup and explicit refresh only. No focus-triggered rescans or file watchers.
  void library.request("scan").catch((error) => emit("error", error.message));
  if (process.env.MMPLAYER_DESKTOP_SMOKE) {
    window.webContents.setAudioMuted(
      process.env.MMPLAYER_DESKTOP_SMTC_HOLD !== "1",
    );
    setTimeout(async () => {
      try {
        if (process.env.MMPLAYER_DESKTOP_SMOKE_AUDIO) {
          await window!.webContents.executeJavaScript(`(() => {
            const bar = document.querySelector('.window-titlebar');
            if (!bar || !bar.querySelector('.brand') || !bar.querySelector('.window-history')) throw Error('Title bar must contain the logo and history');
            if (getComputedStyle(bar).backgroundColor !== 'rgb(0, 0, 0)' || bar.querySelectorAll('button').length !== 5) throw Error('Invalid persistent navigation bar');
            if (getComputedStyle(bar.querySelector('.window-drag-region')).getPropertyValue('-webkit-app-region') !== 'drag') throw Error('Title bar must allow window dragging');
            const brand = document.querySelector('.brand');
            if (!brand || document.querySelector('.sidebar .brand') || !getComputedStyle(brand).backgroundImage.includes('splash-icon')) throw Error('Top bar must use the transparent M logo');
            if (document.querySelector('.sidebar [aria-label="Ampliar"], .sidebar [aria-label="Reducir"], .sidebar [aria-label="Restablecer zoom"]')) throw Error('Sidebar zoom controls remain');
            document.querySelector('[data-window-action="maximize"]').click();
          })()`);
          await new Promise((resolve) => setTimeout(resolve, 300));
          if (!window!.isMaximized()) throw Error('Custom maximize button failed');
          await window!.webContents.executeJavaScript(`(() => {
            const button = document.querySelector('[data-window-action="maximize"]');
            if (button.getAttribute('aria-label') !== 'Restaurar ventana') throw Error('Maximize state did not reach the title bar');
            button.click();
          })()`);
          await new Promise((resolve) => setTimeout(resolve, 300));
          if (window!.isMaximized()) throw Error('Custom restore button failed');
          await window!.webContents.executeJavaScript("document.querySelector('[data-window-action=\"minimize\"]').click()");
          await new Promise((resolve) => setTimeout(resolve, 300));
          if (!window!.isMinimized()) throw Error('Custom minimize button failed');
          window!.restore();
          await new Promise((resolve) => setTimeout(resolve, 300));
          console.log('MMPLAYER_WINDOW_CHROME OK: persistent black navigation bar, transparent brand, minimize, maximize and restore');
          const integration = await window!.webContents
            .executeJavaScript(`(async () => {
            const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
            const until = async probe => { for (let n = 0; n < 100; n++) { const value = probe(); if (value) return value; await wait(50); } throw Error('Shared screen was not ready: ' + probe.toString() + '\\n' + document.body.innerText); };
            document.querySelectorAll('.sidebar nav button')[1].click(); await wait(150);
            const tracksTab = await until(() => document.querySelector('[data-testid="library-tab-tracks"]'));
            tracksTab.click();
            const song = await until(() => document.querySelector('[data-testid^="track-row-"]'));
            song.click(); await wait(700);
            const playing = document.querySelectorAll('[aria-label="Pausar"]').length === 1;
            if (!playing) throw Error('Only the persistent player must show transport: ' + document.body.innerText);
            if (document.querySelector('.player-panel [data-testid="player-progress-slider"], .player-panel [data-testid="player-transport-controls"]')) throw Error('Desktop PlayerScreen must not duplicate progress or transport');
            if (!document.querySelector('.bottom-player [data-testid="player-progress-slider"]') || !document.querySelector('.bottom-player [data-testid="player-transport-controls"]')) throw Error('Persistent player must use the shared progress and transport');
            document.querySelector('.bottom-player button[aria-label="Me gusta"]').click(); await wait(180);
            await until(() => document.querySelector('[data-testid="player-like-active"]'));
            const favorites = document.querySelectorAll('[data-testid="player-like-active"],.bottom-player button[aria-label="Me gusta"].active').length;
            if (favorites !== 2) throw Error('Favorite observation did not update both surfaces');
            const layoutBeforeMenu = document.querySelector('main').getBoundingClientRect().toJSON();
            document.querySelector('[data-testid^="track-menu-"]').click();
            const rootMenu = await until(() => document.querySelector('[data-desktop-menu-type="track-menu"]'));
            const menuAction = (panel, text) => [...panel.querySelectorAll('[role="button"],button')].find(button => button.textContent.includes(text));
            await until(() => menuAction(rootMenu, 'Añadir a playlist'));
            menuAction(rootMenu, 'Añadir a playlist').click();
            const playlistMenu = await until(() => document.querySelector('[data-desktop-menu-type="playlist-selector"]'));
            if (!rootMenu.isConnected) throw Error('Opening a child unmounted its parent');
            menuAction(playlistMenu, 'Crear nueva playlist').click();
            await until(() => document.querySelectorAll('[data-desktop-menu-id]').length === 3);
            await wait(150);
            if (!rootMenu.isConnected || !playlistMenu.isConnected) throw Error('Third level lost parent menus');
            if (!rootMenu.textContent.includes('Propiedades') || !playlistMenu.textContent.includes('Crear nueva playlist')) throw Error('A child replaced its parent content or props');
            if (getComputedStyle(rootMenu).scrollbarWidth !== 'none') throw Error('Contextual menu scrollbar must be hidden');
            const panels = [...document.querySelectorAll('[data-desktop-menu-id]')];
            for (const panel of panels) {
              const r = panel.getBoundingClientRect();
              if (r.left < 7 || r.top < 7 || r.right > innerWidth - 7 || r.bottom > innerHeight - 7 || r.height < 60) throw Error('Menu outside viewport: ' + JSON.stringify(r.toJSON()));
            }
            if (JSON.stringify(document.querySelector('main').getBoundingClientRect().toJSON()) !== JSON.stringify(layoutBeforeMenu)) throw Error('Floating menus moved the desktop layout');
            document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true}));
            await until(() => document.querySelectorAll('[data-desktop-menu-id]').length === 2);
            if (!rootMenu.isConnected || !playlistMenu.isConnected) throw Error('Escape did not preserve parents');
            document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true}));
            await until(() => document.querySelectorAll('[data-desktop-menu-id]').length === 1);
            document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true}));
            await until(() => !document.querySelector('[data-desktop-menu-layer]'));
            const artwork = await until(() => document.querySelector('[data-testid="player-artwork"]'));
            const bounds = artwork.getBoundingClientRect();
            const panel = document.querySelector('.player-panel').getBoundingClientRect();
            if (bounds.width < 100 || Math.abs(bounds.width - bounds.height) > 1 || bounds.left < panel.left - 1 || bounds.right > panel.right + 1) throw Error('Shared artwork must be square and contained in the player panel: ' + JSON.stringify({bounds:bounds.toJSON(),panel:panel.toJSON()}));
            document.querySelector('[data-testid="desktop-open-queue"]').click();
            const queueSheet = await until(() => document.querySelector('[data-testid="desktop-queue-sheet"]'));
            await wait(250);
            const queueBounds = queueSheet.getBoundingClientRect();
            const playerBounds = document.querySelector('.player-panel').getBoundingClientRect();
            if (Math.abs(queueBounds.top-playerBounds.top)>1 || Math.abs(queueBounds.height-playerBounds.height)>1 || Math.abs(queueBounds.width-playerBounds.width)>1) throw Error('Shared queue must cover the whole right panel');
            for (const id of ['queue-tab-upcoming','queue-tab-recent','queue-save-playlist','queue-manage','queue-rename'])
              if (!queueSheet.querySelector('[data-testid="'+id+'"]')) throw Error('Mobile queue option missing: '+id);
            if (!queueSheet.textContent.includes('Desktop integration test')) throw Error('Queue snapshot is missing track metadata');
            document.querySelector('[data-testid="queue-manage"]').click();
            await until(() => document.querySelector('[data-testid="queue-manage-options"]'));
            document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true})); await wait(50);
            if (!document.querySelector('[data-testid="desktop-queue-sheet"]') || document.querySelector('[data-testid="queue-manage-options"]')) throw Error('Escape must close queue options before the queue');
            document.querySelector('[data-testid="queue-rename"]').click();
            const rename = await until(() => document.querySelector('[data-desktop-modal-layer] input'));
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(rename, 'Desktop queue');
            rename.dispatchEvent(new Event('input', {bubbles:true})); await wait(50);
            document.querySelector('[data-testid="queue-rename-save"]').click();
            await until(() => document.querySelector('[data-testid="queue-selector"]')?.textContent.includes('Desktop queue'));
            document.querySelector('[data-testid="queue-save-playlist"]').click();
            await until(() => document.querySelector('[data-testid="queue-save-options"]'));
            document.querySelector('[data-testid="queue-save-all"]').click();
            await until(() => document.querySelector('[data-desktop-menu-type="playlist-selector"]'));
            if (document.querySelector('.queue-overlay')) throw Error('Saving queue must hand off to the shared playlist selector');
            document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true})); await wait(50);
            document.querySelector('[data-testid="desktop-open-queue"]').click();
            await until(() => document.querySelector('[data-testid="desktop-queue-sheet"]'));
            await wait(100);
            document.querySelector('[data-testid="queue-tab-recent"]').click(); await wait(50);
            document.querySelector('[data-testid="queue-tab-upcoming"]').click(); await wait(50);
            document.querySelector('[data-testid="queue-selector"]').click(); await wait(50);
            document.querySelector('[data-testid="queue-slot-1"]').click(); await wait(200);
            if (document.querySelectorAll('[aria-label="Pausar"]').length) throw Error('Empty queue did not pause');
            if (!document.querySelector('.player-panel-empty')) throw Error('Empty player must use the purple fallback');
            document.querySelector('[data-testid="queue-selector"]').click(); await wait(50);
            document.querySelector('[data-testid="queue-slot-0"]').click(); await wait(200);
            if (document.querySelectorAll('[aria-label="Pausar"]').length) throw Error('Restored queue must start paused');
            if ((await window.mmplayer.invoke('state')).player.activeQueue !== 0 || document.querySelector('.bottom-player .footer-track strong')?.textContent !== 'Desktop integration test') throw Error('Original queue was not restored');
            document.querySelector('[data-testid="queue-close"]').click();
            await wait(50);
            if (document.querySelector('.queue-overlay')) throw Error('Queue overlay did not close');
            const lyricsToggle = document.querySelector('[data-testid="desktop-toggle-lyrics"]');
            const playerLyrics = () => document.querySelector('[data-testid="player-lyrics-slot"]');
            await until(() => playerLyrics()?.textContent.trim());
            const originalCoverSize = document.querySelector('[data-testid="player-artwork"]').getBoundingClientRect().width;
            lyricsToggle.click();
            await until(() => document.querySelector('[data-testid="mobile-screen-Lyrics"]'));
            await until(() => document.querySelector('[data-testid="lyrics-dismiss"]'));
            if (document.querySelector('main [role="slider"], main input[type="range"], main [data-testid="lyrics-playback-controls"]')) throw Error('Desktop lyrics must not include playback controls');
            if (playerLyrics()?.textContent.trim()) throw Error('Player lyrics must hide while LyricsScreen is open');
            if (Math.abs(document.querySelector('[data-testid="player-artwork"]').getBoundingClientRect().width - originalCoverSize) > 1) throw Error('Opening lyrics must preserve artwork size');
            lyricsToggle.click();
            await until(() => !document.querySelector('[data-testid="mobile-screen-Lyrics"]'));
            await until(() => playerLyrics()?.textContent.trim());
            document.querySelector('[data-testid="desktop-toggle-lyrics"]').click();
            await until(() => document.querySelector('[data-testid="lyrics-dismiss"]'));
            document.querySelector('[data-testid="desktop-toggle-lyrics"]').click();
            await until(() => !document.querySelector('[data-testid="mobile-screen-Lyrics"]'));
            lyricsToggle.click();
            await until(() => document.querySelector('[data-testid="lyrics-dismiss"]'));
            document.querySelector('[data-testid="lyrics-dismiss"]').click();
            await until(() => !document.querySelector('[data-testid="mobile-screen-Lyrics"]'));
            await until(() => playerLyrics()?.textContent.trim());
            for (const [index, name] of [[0, 'Home'], [2, 'Search'], [3, 'Tags'], [4, 'WeeklyActivity'], [5, 'Settings']]) {
              document.querySelectorAll('.sidebar nav button')[index].click();
              await until(() => document.querySelector('[data-testid="mobile-screen-' + name + '"]'));
              await wait(180);
            }
            document.querySelectorAll('.sidebar nav button')[1].click();
            const albumCard = await until(() => document.querySelector('main [data-testid="library-card"]'));
            albumCard.click();
            await until(() => document.querySelector('[data-testid="mobile-screen-AlbumDetail"]'));
            await wait(180);
            document.querySelector('.window-titlebar [data-testid="header-history-back"]').click();
            await until(() => document.querySelector('[data-testid="mobile-screen-Library"]'));
            document.querySelector('.window-titlebar [data-testid="header-history-forward"]').click();
            await until(() => document.querySelector('[data-testid="mobile-screen-AlbumDetail"]'));
            document.querySelector('.window-titlebar [data-testid="header-history-back"]').click();
            await until(() => document.querySelector('[data-testid="mobile-screen-Library"]'));
            if (document.querySelector('.page-header')) throw Error('Redundant desktop toolbar remains');
            document.querySelectorAll('.sidebar nav button')[0].click();
            await until(() => document.querySelector('[data-testid="mobile-screen-Home"]'));
            await wait(800);
            const state = await window.mmplayer.invoke('state');
            return {playing, favorites, queueCount:state.player.queues.length, navigationResponsive:!!document.querySelector('.sidebar nav button'), contextualMenuLevels:3, floatingLayoutStable:true};
          })()`);
          console.log("MMPLAYER_INTEGRATION", JSON.stringify(integration));
          await window!.webContents.executeJavaScript(`document.querySelector('[data-testid="desktop-open-queue"]').click()`);
          await new Promise((resolve) => setTimeout(resolve, 300));
          const queueImage = await window!.webContents.capturePage();
          const { writeFile: saveQueueImage } = await import("node:fs/promises");
          await saveQueueImage(join(directory, "shared-queue.png"), queueImage.toPNG());
          await window!.webContents.executeJavaScript(`document.querySelector('[data-testid="queue-close"]').click()`);
          const widthAt100 =
            await window!.webContents.executeJavaScript("innerWidth");
          window!.webContents.sendInputEvent({
            type: "keyDown",
            keyCode: "-",
            modifiers: ["control"],
          });
          await new Promise((resolve) => setTimeout(resolve, 250));
          if (
            Math.abs(
              window!.webContents.getZoomFactor() -
                0.9,
            ) > 0.001 ||
            settings.state.preferences.zoomFactor !== 0.9
          )
            throw Error("Keyboard zoom was not applied and persisted");
          const widthAt90 =
            await window!.webContents.executeJavaScript("innerWidth");
          if (widthAt90 <= widthAt100)
            throw Error("Zoom did not update the logical viewport");
          window!.webContents.sendInputEvent({ type: "keyDown", keyCode: "0", modifiers: ["control"] });
          await new Promise((resolve) => setTimeout(resolve, 150));
          window!.webContents.sendInputEvent({ type: "keyDown", keyCode: "=", modifiers: ["control"] });
          await new Promise((resolve) => setTimeout(resolve, 150));
          if (Math.abs(window!.webContents.getZoomFactor() - 1.1) > 0.001 || Math.abs(settings.state.preferences.zoomFactor - 1.1) > 0.001)
            throw Error("Keyboard zoom must increase above 100 percent");
          window!.webContents.sendInputEvent({
            type: "keyDown",
            keyCode: "0",
            modifiers: ["control"],
          });
          await new Promise((resolve) => setTimeout(resolve, 250));
          if (
            Math.abs(
              window!.webContents.getZoomFactor() -
                1,
            ) > 0.001
          )
            throw Error("Zoom reset failed");
          console.log(
            "MMPLAYER_ZOOM OK: native scaling, keyboard and persistence",
          );

          const originalContentSize = window!.getContentSize();
          for (const [width, height] of [
            [1920, 1080],
            [1280, 720],
            [900, 640],
            [1440, 640],
          ]) {
            window!.setContentSize(width, height);
            await new Promise((resolve) => setTimeout(resolve, 180));
            await window!.webContents.executeJavaScript(`(() => {
              const shell = document.querySelector('[data-testid="desktop-shell"]').getBoundingClientRect();
              const footer = document.querySelector('.bottom-player').getBoundingClientRect();
              const panel = document.querySelector('.player-panel');
              if (!panel || Math.abs(shell.width - innerWidth) > 1 || Math.abs(shell.height - innerHeight) > 1) throw Error('Desktop must fill the logical viewport');
              if (Math.abs(footer.height - (innerWidth <= 1180 ? 154 : 104)) > 1) throw Error('Window resizing changed control sizes');
              const bar = document.querySelector('.window-titlebar').getBoundingClientRect();
              if (Math.abs(bar.width - innerWidth) > 1 || bar.top !== 0 || Math.abs(bar.height - 56) > 1) throw Error('Title bar does not fill the window top');
              const center = document.querySelector('main').getBoundingClientRect();
              if (center.width < 279 || center.left < 0 || center.right > innerWidth) throw Error('Central panel lost its available space');
              const cover = [...panel.querySelectorAll('[data-testid="player-artwork"]')].find(node => {
                const r=node.getBoundingClientRect(), p=panel.getBoundingClientRect();return r.x>=p.x&&r.x<p.right;
              });
              if (!cover) throw Error('Artwork disappeared');
              const r=cover.getBoundingClientRect();
              const lyrics = panel.querySelector('[data-testid="player-lyrics-slot"]');
              const lyricBounds = lyrics.getBoundingClientRect();
              const region = lyrics.parentElement.getBoundingClientRect();
              if (lyricBounds.height < 57 || lyricBounds.bottom > region.bottom + 1 || r.bottom > lyricBounds.top + 1) throw Error('Cover must leave the full lyrics slot inside the artwork region');
              if (Math.abs(r.width-r.height)>1 || r.left < panel.getBoundingClientRect().left - 1 || r.right > panel.getBoundingClientRect().right + 1) throw Error('Artwork must remain square and inside its responsive panel');
              for (let node=cover;node;node=node.parentElement) if (Number(getComputedStyle(node).opacity)<0.99) throw Error('Artwork stayed invisible after resizing');
            })()`);
            if (Math.abs(window!.webContents.getZoomFactor() - 1) > 0.001)
              throw Error('Window resizing changed user zoom');
          }
          window!.setContentSize(
            originalContentSize[0],
            originalContentSize[1],
          );
          await new Promise((resolve) => setTimeout(resolve, 180));
          console.log(
            "MMPLAYER_REFLOW OK: viewport filled, zoom stable, responsive panels and square artwork across window sizes",
          );

          for (const [width, height] of [[1920, 1080], [1280, 720], [900, 640]]) {
            window!.setContentSize(width, height);
            for (const zoom of [0.5, 1, 1.3]) {
              await window!.webContents.executeJavaScript(`window.mmplayer.invoke('preferences', { zoomFactor: ${zoom} })`);
              await new Promise((resolve) => setTimeout(resolve, 200));
              await window!.webContents.executeJavaScript(`(() => {
                const grid = document.querySelector('[data-testid="home-recent-media-grid"]');
                const cards = grid?.querySelectorAll('[data-testid="home-recent-media-card"]');
                if (!cards || cards.length < 2) throw Error('Two recent items required for the layout check');
                const first = cards[0].getBoundingClientRect(), second = cards[1].getBoundingClientRect();
                const bounds = grid.getBoundingClientRect();
                if (getComputedStyle(grid).display !== 'grid' || Math.abs(first.top - second.top) > 1 || second.left <= first.right)
                  throw Error('Recent items must always form two columns: ' + JSON.stringify({ first: first.toJSON(), second: second.toJSON() }));
                if (Math.abs(first.width - second.width) > 1 || first.left < bounds.left || second.right > bounds.right + 1)
                  throw Error('Recent item columns overflow or have different widths');
              })()`);
            }
          }
          window!.setContentSize(originalContentSize[0], originalContentSize[1]);
          await window!.webContents.executeJavaScript("window.mmplayer.invoke('preferences', { zoomFactor: 1 })");
          await new Promise((resolve) => setTimeout(resolve, 200));
          console.log("MMPLAYER_RECENTS_GRID OK: two columns at all supported window sizes and zoom levels");

          await window!.webContents.executeJavaScript(`(async () => {
            document.querySelectorAll('.sidebar nav button')[1].click();
            await new Promise(resolve => setTimeout(resolve, 400));
          })()`);
          const gridColumns: number[] = [];
          for (const zoom of [0.5, 1, 1.2, 1.3]) {
            await window!.webContents.executeJavaScript(`window.mmplayer.invoke('preferences', {zoomFactor: ${zoom}})`);
            await new Promise((resolve) => setTimeout(resolve, 300));
            const columns = await window!.webContents.executeJavaScript(`(() => {
              const bar = document.querySelector('.window-titlebar').getBoundingClientRect();
              if (Math.abs(bar.height * ${zoom} - 56) > 1 || Math.abs(bar.width - innerWidth) > 1) throw Error('Window controls changed size with content zoom');
              const screen = document.querySelector('[data-testid="mobile-screen-Library"]');
              const card = screen.querySelector('[data-testid="library-card"]');
              if (!card) throw Error('Responsive grid card missing');
              const available = screen.getBoundingClientRect().width - 40;
              const columns = Math.max(1, Math.floor(available / 204));
              const expected = Math.max(1, Math.min(280, available / columns - 24));
              const bounds = card.getBoundingClientRect();
              if (Math.abs(bounds.width - expected) > 2) throw Error('Grid did not reflow: ' + JSON.stringify({available, columns, expected, actual: bounds.width}));
              const artwork = card.firstElementChild.getBoundingClientRect();
              if (Math.abs(artwork.width - artwork.height) > 1) throw Error('Grid artwork lost its square aspect');
              const footer = document.querySelector('.bottom-player');
              if (footer.scrollWidth > innerWidth + 1) throw Error('Transport overflow after zoom');
              return columns;
            })()`);
            gridColumns.push(columns);
            if (Math.abs(window!.webContents.getZoomFactor() - zoom) > 0.001)
              throw Error('Native zoom factor disagrees with preference');
          }
          if (gridColumns[0] <= gridColumns[gridColumns.length - 1]) throw Error('Zoom did not reduce the grid column count');
          await window!.webContents.executeJavaScript("window.mmplayer.invoke('preferences', {zoomFactor: 1})");
          await new Promise((resolve) => setTimeout(resolve, 200));
          console.log("MMPLAYER_GRID_ZOOM OK:", JSON.stringify(gridColumns));

          if (process.platform === "win32" && !taskbar?.configured)
            throw Error("Windows taskbar transport was not configured");
          const dropFolder = join(directory, "external-drop");
          await mkdir(join(dropFolder, "nested"), { recursive: true });
          const droppedAudio = join(dropFolder, "Dropped song.wav");
          const folderAudio = join(dropFolder, "nested", "Folder song.wav");
          const { writeFile: writeDropFixture } = await import(
            "node:fs/promises"
          );
          const bytes = await readFile(
            process.env.MMPLAYER_DESKTOP_SMOKE_AUDIO!,
          );
          await writeDropFixture(droppedAudio, bytes);
          await writeDropFixture(folderAudio, bytes);
          await writeDropFixture(join(dropFolder, "ignored.txt"), "not music");
          const queueBeforeDrop = JSON.stringify(
            settings.state.player.queues.map((queue) => queue.trackIds),
          );
          window!.webContents.debugger.attach("1.3");
          try {
            for (const file of [droppedAudio, dropFolder]) {
              for (const type of ["dragEnter", "dragOver", "drop"])
                await window!.webContents.debugger.sendCommand(
                  "Input.dispatchDragEvent",
                  {
                    type,
                    x: 500,
                    y: 250,
                    data: { items: [], files: [file], dragOperationsMask: 1 },
                  },
                );
              await window!.webContents.executeJavaScript(`(async () => {
                for (let i = 0; i < 100; i++) {
                  const snapshot = await window.mmplayer.invoke('library');
                  if (snapshot.tracks.some(track => track.title === ${JSON.stringify(file === droppedAudio ? "Dropped song" : "Folder song")})) return;
                  await new Promise(resolve => setTimeout(resolve, 50));
                }
                throw Error('External music drop did not import the file/folder');
              })()`);
            }
          } finally {
            window!.webContents.debugger.detach();
          }
          if (
            JSON.stringify(
              settings.state.player.queues.map((queue) => queue.trackIds),
            ) !== queueBeforeDrop
          )
            throw Error("Dropping music changed the playback queues");
          console.log(
            "MMPLAYER_EXTERNAL_DROP OK: file, nested folder, library only",
          );
          if (process.env.MMPLAYER_DESKTOP_SMTC_HOLD === "1") {
            await window!.webContents.executeJavaScript(
              `document.querySelector('.bottom-player [aria-label="Reproducir"]').click()`,
            );
            await new Promise((resolve) => setTimeout(resolve, 20000));
          }
          await window!.webContents.executeJavaScript(`(async () => {
            const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
            const until = async probe => { for (let i = 0; i < 100; i++) { const value = await probe(); if (value) return value; await wait(50); } throw Error('Metadata editor was not ready'); };
            document.querySelectorAll('.sidebar nav button')[1].click(); await wait(150);
            document.querySelector('[data-testid="library-tab-tracks"]').click(); await wait(150);
            document.querySelector('[data-testid^="track-menu-"]').click();
            const menu = await until(() => document.querySelector('[data-desktop-menu-type="track-menu"]'));
            [...menu.querySelectorAll('[role="button"]')].find(button => button.textContent.includes('Editar Metadatos')).click();
            const editor = await until(() => document.querySelector('[data-desktop-menu-type="metadata-editor"]'));
            const title = await until(() => editor.querySelector('input'));
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(title, 'Saved through desktop editor');
            title.dispatchEvent(new Event('input', { bubbles: true })); await wait(50);
            [...editor.querySelectorAll('[role="button"],button,[tabindex="0"]')].find(button => button.textContent.includes('Guardar')).click();
            await until(async () => (await window.mmplayer.invoke('library')).tracks.some(track => track.title === 'Saved through desktop editor'));
            await until(() => !document.querySelector('[data-desktop-menu-type="metadata-editor"]'));
            document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true})); await wait(50);
          })()`);
          console.log(
            "MMPLAYER_METADATA_EDITOR OK: shared editor writes to the physical file",
          );
          await window!.webContents.executeJavaScript(`(async () => {
            const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
            const state = await window.mmplayer.invoke('state');
            const library = await window.mmplayer.invoke('library');
            const active = state.player.queues[state.player.activeQueue];
            const track = library.tracks.find(track => track.id === active.trackIds[active.index]);
            if (!track) throw Error('Easter egg test requires an active fixture');
            const original = await window.mmplayer.invoke('readMetadata', { uri: track.fileUrl });
            try {
              const result = await window.mmplayer.invoke('writeMetadata', [{ filePath: track.fileUrl, metadata: { artist: 'Olivia Rodrigo', album: 'you seem pretty sad for a girl so in love' } }]);
              if (!result[0]?.success) throw Error('Could not prepare easter egg metadata');
              let image;
              for (let i = 0; i < 100; i++) {
                image = document.querySelector('.bottom-player [data-testid="player-progress-slider"] img');
                if (image) break;
                await wait(50);
              }
              if (!image) throw Error('Shared footer slider did not show the album easter egg thumb');
              const slider = document.querySelector('.bottom-player [data-testid="player-progress-slider"]');
              if (![...slider.querySelectorAll('*')].some(node => getComputedStyle(node).backgroundColor === 'rgb(247, 94, 145)')) throw Error('Shared footer slider lost the easter egg progress color');
            } finally {
              await window.mmplayer.invoke('writeMetadata', [{ filePath: track.fileUrl, metadata: original }]);
            }
            for (let i = 0; i < 100 && document.querySelector('.bottom-player [data-testid="player-progress-slider"] img'); i++) await wait(50);
            if (document.querySelector('.bottom-player [data-testid="player-progress-slider"] img')) throw Error('Easter egg thumb survived switching back to an ordinary album');
          })()`);
          console.log('MMPLAYER_SHARED_TRANSPORT OK: desktop panel has no duplicate transport; footer preserves album easter egg thumb and color');
          await window!.webContents.executeJavaScript(`(async () => {
            const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
            document.querySelectorAll('.sidebar nav button')[1].click(); await wait(150);
            document.querySelector('[data-testid="library-tab-tracks"]').click(); await wait(150);
            document.querySelector('[data-testid^="track-menu-"]').click(); await wait(200);
            const press = (panel, text) => [...panel.querySelectorAll('[role="button"]')].find(button => button.textContent.includes(text)).click();
            press(document.querySelector('[data-desktop-menu-type="track-menu"]'), 'Añadir a playlist'); await wait(150);
            press(document.querySelector('[data-desktop-menu-type="playlist-selector"]'), 'Crear nueva playlist'); await wait(200);
          })()`);
          const originalBounds = window!.getBounds();
          window!.setSize(900, 640);
          await new Promise((resolve) => setTimeout(resolve, 200));
          await window!.webContents.executeJavaScript(`(() => {
            for (const panel of document.querySelectorAll('[data-desktop-menu-id]')) {
              const r = panel.getBoundingClientRect();
              if (r.left < 7 || r.top < 7 || r.right > innerWidth - 7 || r.bottom > innerHeight - 7) throw Error('Menu outside resized viewport: ' + JSON.stringify(r.toJSON()));
            }
          })()`);
          await window!.webContents.executeJavaScript(
            "window.mmplayer.invoke('preferences', { zoomFactor: 2 })",
          );
          await new Promise((resolve) => setTimeout(resolve, 200));
          await window!.webContents.executeJavaScript(`(() => {
            const footer = document.querySelector('.bottom-player');
            if (footer.scrollWidth > innerWidth + 1) throw Error('Transport overflows at maximum zoom');
            for (const panel of document.querySelectorAll('[data-desktop-menu-id]')) {
              const r = panel.getBoundingClientRect();
              if (r.left < 7 || r.top < 7 || r.right > innerWidth - 7 || r.bottom > innerHeight - 7) throw Error('Menu outside zoomed viewport');
            }
          })()`);
          await window!.webContents.executeJavaScript(`(async () => {
            for (let i = 0; i < 3; i++) {
              document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true}));
              await new Promise(resolve => setTimeout(resolve, 30));
            }
            const state = await window.mmplayer.invoke('state');
            if (state.preferences.zoomFactor !== 1.3) throw Error('Zoom above the maximum must be clamped to 130 percent');
            if (!document.querySelector('.player-panel')) throw Error('Player panel should still fit at maximum supported zoom');
            document.querySelector('[data-testid="desktop-toggle-player"]').click();
            await new Promise(resolve => setTimeout(resolve, 200));
            if (document.querySelector('.player-panel')) throw Error('Player panel did not close');
            document.querySelector('[data-testid="desktop-toggle-player"]').click();
            await new Promise(resolve => setTimeout(resolve, 100));
            const panel = document.querySelector('.player-panel');
            if (!panel) throw Error('Player panel did not reopen');
            const r = panel.getBoundingClientRect();
            if (r.left < 0 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) throw Error('Player outside viewport');
          })()`);
          console.log("MMPLAYER_MAX_ZOOM OK: capped at 130 percent, transport, menu bounds and player controls");
          await window!.webContents.executeJavaScript(
            "window.mmplayer.invoke('preferences', { zoomFactor: 1 })",
          );
          window!.setSize(originalBounds.width, originalBounds.height);
          await new Promise((resolve) => setTimeout(resolve, 200));
          const menuScreenshot = await window!.webContents.capturePage();
          const { writeFile: writeMenuScreenshot } = await import(
            "node:fs/promises"
          );
          await writeMenuScreenshot(
            join(directory, "context-menus.png"),
            menuScreenshot.toPNG(),
          );
          await writeMenuScreenshot(
            join(directory, "context-menus.html"),
            await window!.webContents.executeJavaScript(
              "document.documentElement.outerHTML",
            ),
          );
          console.log("MMPLAYER_MENU_VIEWPORTS OK: full window and 900x640");
          await window!.webContents.executeJavaScript(`(async () => {
            for (let i = 0; i < 3; i++) {
              document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true}));
              await new Promise(resolve => setTimeout(resolve, 30));
            }
            document.querySelectorAll('.sidebar nav button')[0].click();
            await new Promise(resolve => setTimeout(resolve, 250));
          })()`);
          if (rendererErrors.length)
            throw Error("Renderer errors: " + rendererErrors.join("\n"));
        }
        const report = await window!.webContents.executeJavaScript(
          `({title:document.title,ready:!!document.querySelector('[data-testid="desktop-shell"]'),text:document.body.innerText.slice(0,1000)})`,
        );
        console.log("MMPLAYER_SMOKE", JSON.stringify(report));
        const screenshot = await window!.webContents.capturePage();
        const { writeFile } = await import("node:fs/promises");
        await writeFile(join(directory, "smoke.png"), screenshot.toPNG());
        if (report.ready) {
          await window!.webContents.executeJavaScript("document.querySelector('[data-window-action=\"close\"]').click()");
          console.log('MMPLAYER_WINDOW_CLOSE OK: custom close button uses the normal save and exit flow');
        }
        else app.exit(1);
      } catch (error) {
        const screenshot = await window!.webContents.capturePage();
        const { writeFile } = await import("node:fs/promises");
        await writeFile(
          join(directory, "smoke-failed.png"),
          screenshot.toPNG(),
        );
        await writeFile(
          join(directory, "smoke-failed.html"),
          await window!.webContents.executeJavaScript(
            "document.documentElement.outerHTML",
          ),
        );
        console.log(
          "MMPLAYER_FAILED_DOM",
          await window!.webContents.executeJavaScript(
            `JSON.stringify({visibility:document.visibilityState,tabs:[...document.querySelectorAll('[data-testid^="library-tab-"]')].map(element=>({test:element.getAttribute('data-testid'),selected:element.getAttribute('aria-selected')})),main:document.querySelector('main')?.innerHTML.slice(-2500)})`,
          ),
        );
        console.error(error);
        app.exit(1);
      }
    }, 2500);
  }
}
if (locked)
  void app
    .whenReady()
    .then(start)
    .catch((error) => {
      console.error(error);
      if (!process.env.MMPLAYER_DESKTOP_SMOKE)
        dialog.showErrorBox("MMPlayer", String(error));
      app.exit(1);
    });
app.on("before-quit", (event) => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  discordPresence.disconnect();
  void (async () => {
    if (window && !window.isDestroyed()) {
      await new Promise<void>((resolve) => {
        const finish = () => {
          clearTimeout(timeout);
          ipcMain.removeListener("mmplayer:close-ready", acknowledge);
          resolve();
        };
        const acknowledge = (event: Electron.IpcMainEvent) => {
          if (
            event.sender === window?.webContents &&
            event.senderFrame === window.webContents.mainFrame
          )
            finish();
        };
        // Only a fallback for a crashed/unresponsive renderer, not a playback delay.
        const timeout = setTimeout(finish, 2000);
        ipcMain.on("mmplayer:close-ready", acknowledge);
        window!.webContents.send("mmplayer:before-close");
      });
    }
    await settings?.flush();
    await library?.close();
  })()
    .catch(console.error)
    .finally(() => app.quit());
});
app.on("window-all-closed", () => {
  if (!settings?.state.preferences.closeToTray) app.quit();
});
