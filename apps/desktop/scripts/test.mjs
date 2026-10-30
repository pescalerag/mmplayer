import { build } from "esbuild";
import { spawn } from "node:child_process";
import { dirname, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { nativeOptions } from "./build.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(root, "../..");
const port = (name) => resolve(root, "src/renderer/ports", name);
const modules = {
  "services/LocalCastService": "localCast.ts",
  "services/MetadataEditorService": "metadataEditor.ts",
  "hooks/useSheetProps": "sheetProps.tsx",
  "hooks/useUnsavedDocument": "unsavedDocument.ts",
  "hooks/usePlayerArtworkLayout": "playerArtworkLayout.ts",
  "hooks/usePlayerVisualRecovery": "playerVisualRecovery.ts",
  "database/index": "database.ts",
  "store/usePlayerStore": "playerStore.ts",
  "store/useCastStore": "castStore.ts",
  "hooks/usePlaybackState": "playbackState.ts",
  "services/LibraryRefreshService": "libraryRefresh.ts",
  "theme/fonts": "fonts.ts",
  "navigation/navigationRef": "navigationRef.ts",
  "utils/scheduleScreenRefresh": "scheduleScreenRefresh.ts",
  "store/useMultipleQueuesStore": "queues.ts",
  "services/MultipleQueuesService": "queues.ts",
  "utils/restartHelper": "restartHelper.ts",
  "store/usePlaybackSnapshotStore": "playbackSnapshot.ts",
  "store/useABRepeatStore": "abRepeat.ts",
  "store/useSleepTimerStore": "sleepTimer.ts",
  "services/ScannerService": "scannerService.ts",
  "services/TimestampService": "timestampService.ts",
};

const desktopTestPorts = {
  name: "desktop-test-ports",
  setup(b) {
    b.onResolve({ filter: /.*/ }, (args) => {
      if (args.path === "react-native") {
        return { path: "react-native-web", namespace: "rnw-alias" };
      }
      if (args.path === "@react-native-async-storage/async-storage") {
        return { path: "async-storage", namespace: "async-storage-alias" };
      }
      if (args.path === "expo-localization") {
        return { path: "expo-localization", namespace: "expo-localization-alias" };
      }
      if (
        args.path === "expo-file-system" ||
        args.path === "expo-file-system/legacy"
      ) {
        return { path: port("fileSystem.ts") };
      }
      if (args.path === "react-native-track-player") {
        return { path: port("trackPlayer.ts") };
      }
      if (args.path === "react-native-mmkv") {
        return { path: port("mmkv.ts") };
      }
      if (/\.(png|jpe?g|webp|gif|svg)$/i.test(args.path)) {
        return { path: args.path, namespace: "asset-stub" };
      }
      let p = args.path.startsWith("@/")
        ? resolve(repo, "src", args.path.slice(2))
        : isAbsolute(args.path)
          ? args.path
          : args.resolveDir && args.path.startsWith(".")
            ? resolve(args.resolveDir, args.path)
            : "";
      if (!p) return;
      const norm = p.replaceAll("\\", "/").replace(/\.(tsx?|jsx?)$/, "");
      if (norm === resolve(repo, "modules/native-audio-scanner").replaceAll("\\", "/")) {
        return { path: port("audioFiles.ts") };
      }
      if (norm === resolve(repo, "modules/native-equalizer").replaceAll("\\", "/")) {
        return { path: port("equalizer.tsx") };
      }
      const srcPrefix = resolve(repo, "src").replaceAll("\\", "/") + "/";
      let key = norm.startsWith(srcPrefix) ? norm.slice(srcPrefix.length) : "";
      if (key === "database") key = "database/index";
      if (modules[key]) {
        return { path: port(modules[key]) };
      }
    });
    b.onLoad({ filter: /.*/, namespace: "rnw-alias" }, () => ({
      contents: `
        const React = require("react");
        module.exports = {
          Platform: { OS: "web", select: (obj) => obj.web ?? obj.default },
          View: (props) => React.createElement("div", props, props.children),
          StyleSheet: { create: (s) => s, absoluteFillObject: {} },
          Image: {
            resolveAssetSource: (asset) =>
              typeof asset === "string"
                ? { uri: asset }
                : asset && typeof asset.uri === "string"
                  ? asset
                  : { uri: "mmplayer://app/nullcover.png" },
          },
          Alert: { alert: () => {} },
        };
      `,
      loader: "js",
      resolveDir: root,
    }));
    b.onLoad({ filter: /.*/, namespace: "async-storage-alias" }, () => ({
      contents: `
        const store = new Map();
        const api = {
          getItem: async (k) => store.has(k) ? store.get(k) : null,
          setItem: async (k, v) => { store.set(k, String(v)); },
          removeItem: async (k) => { store.delete(k); },
          clear: async () => { store.clear(); },
        };
        module.exports = api;
        module.exports.default = api;
      `,
      loader: "js",
    }));
    b.onLoad({ filter: /.*/, namespace: "expo-localization-alias" }, () => ({
      contents: `
        module.exports = {
          getLocales: () => [{ languageCode: "en", languageTag: "en-US" }],
        };
      `,
      loader: "js",
    }));
    b.onLoad({ filter: /.*/, namespace: "asset-stub" }, (args) => ({
      contents: `module.exports = { uri: "mmplayer://app/" + ${JSON.stringify(args.path.split(/[\\/]/).pop() || "asset.png")} };`,
      loader: "js",
    }));
  },
};

const base = nativeOptions();
await build(base);
await build({
  ...base,
  entryPoints: ["test/desktop.test.ts"],
  outdir: "build/test",
  plugins: [desktopTestPorts, ...(base.plugins || [])],
  banner: {
    js: `
if (typeof globalThis.Audio === "undefined") {
  globalThis.Audio = class FakeBootAudio extends EventTarget {
    constructor() { super(); this.paused = true; this.currentTime = 0; this.duration = 0; this.volume = 1; this.playbackRate = 1; this.preservesPitch = true; this.src = ""; this.preload = "auto"; this.crossOrigin = "anonymous"; }
    play() { this.paused = false; this.dispatchEvent(new Event("play")); return Promise.resolve(); }
    pause() { this.paused = true; this.dispatchEvent(new Event("pause")); }
    load() {}
    removeAttribute(attr) { if (attr === "src") this.src = ""; }
  };
}
if (typeof globalThis.window === "undefined") {
  globalThis.window = {
    addEventListener() {},
    removeEventListener() {},
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    setInterval: globalThis.setInterval.bind(globalThis),
    clearInterval: globalThis.clearInterval.bind(globalThis),
    mmplayer: {
      on: () => () => {},
      invoke: async () => ({ roots: [], scanning: false, tracks: [], albums: [], artists: [], folders: [], updatedAt: Date.now() }),
    },
  };
}
`,
  },
});
const child = spawn(
  process.execPath,
  ["--test", "build/test/desktop.test.cjs"],
  { stdio: "inherit" },
);
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
