import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { resolve, dirname, isAbsolute } from "node:path";
import { transformAsync } from "@babel/core";
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const repo = fileURLToPath(new URL("../..", import.meta.url));
const port = (name: string) =>
  resolve(repo, "apps/desktop/src/renderer/ports", name).replaceAll('\\', '/');
const modules: Record<string, string> = {
  "services/MusicZipImportService": "musicZip.ts",
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
const ports = {
  name: "desktop-platform-ports",
  enforce: "pre" as const,
  resolveId(source: string, importer?: string) {
    let path = source.startsWith("@/")
      ? resolve(repo, "src", source.slice(2))
      : isAbsolute(source)
        ? source
        : importer && source.startsWith(".")
          ? resolve(dirname(importer), source)
          : "";
    path = path.replaceAll("\\", "/").replace(/\.(tsx?|jsx?)$/, "");
    if (
      path ===
      resolve(repo, "modules/native-audio-scanner").replaceAll("\\", "/")
    )
      return port("audioFiles.ts");
    if (
      path === resolve(repo, "modules/native-equalizer").replaceAll("\\", "/")
    )
      return port("equalizer.tsx");
    const src = resolve(repo, "src").replaceAll("\\", "/") + "/";
    let key = path.startsWith(src) ? path.slice(src.length) : "";
    if (key === "database") key = "database/index";
    if (modules[key]) return port(modules[key]);
  },
  async transform(code: string, id: string) {
    if (id.includes("/node_modules/expo-") && id.endsWith(".ts")) {
      const result = await transformAsync(code, {
        filename: id,
        configFile: false,
        babelrc: false,
        plugins: [
          ["@babel/plugin-transform-typescript", { allowDeclareFields: true }],
        ],
      });
      return { code: result!.code!, map: result!.map };
    }
    if (
      id.includes("/node_modules/expo-") &&
      id.endsWith(".js") &&
      /<[A-Z_a-z]/.test(code)
    ) {
      const result = await transformAsync(code, {
        filename: id,
        configFile: false,
        babelrc: false,
        plugins: [
          ["@babel/plugin-transform-react-jsx", { runtime: "automatic" }],
        ],
      });
      return { code: result!.code!, map: result!.map };
    }
    if (/[\\/]src[\\/]database[\\/]models[\\/].*\.ts$/.test(id)) {
      const result = await transformAsync(code, {
        filename: id,
        configFile: false,
        babelrc: false,
        plugins: [
          ["@babel/plugin-transform-typescript", { allowDeclareFields: true }],
          ["@babel/plugin-proposal-decorators", { legacy: true }],
          ["@babel/plugin-transform-class-properties", { loose: true }],
        ],
      });
      return { code: result!.code!, map: result!.map };
    }
  },
};
export default defineConfig({
  plugins: [ports, react()],
  define: {
    global: "globalThis",
    __DEV__: false,
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process.env.EXPO_OS": JSON.stringify("web"),
  },
  base: "./",
  resolve: {
    extensions: [
      ".web.mjs",
      ".mjs",
      ".web.js",
      ".js",
      ".web.ts",
      ".ts",
      ".web.tsx",
      ".tsx",
      ".json",
    ],
    alias: [
      { find: /^decode-uri-component$/, replacement: require.resolve('desktop-uri-decoder') },
      { find: /^expo-sharing$/, replacement: port("sharing.ts") },
      { find: /^react-native-restart$/, replacement: port("restart.ts") },
      { find: /^react-native$/, replacement: "react-native-web" },
      {
        find: /^react-native\/Libraries\/promiseRejectionTrackingOptions$/,
        replacement: port("viewShot.tsx"),
      },
      { find: /^react-native-view-shot$/, replacement: port("viewShot.tsx") },
      { find: /^expo-status-bar$/, replacement: port("viewShot.tsx") },
      {
        find: /^react-native-track-player$/,
        replacement: port("trackPlayer.ts"),
      },
      { find: /^react-native-mmkv$/, replacement: port("mmkv.ts") },
      {
        find: /^react-native-draggable-flatlist$/,
        replacement: port("draggableFlatList.tsx"),
      },
      {
        find: /^expo-file-system(\/legacy)?$/,
        replacement: port("fileSystem.ts"),
      },
      {
        find: /^react-native-zip-archive$/,
        replacement: port("zipArchive.ts"),
      },
      { find: /^@expo\/vector-icons$/, replacement: port("icons.tsx") },
      { find: "@", replacement: resolve(repo, "src") },
    ],
    dedupe: ["react", "react-dom"],
  },
  build: { outDir: "build/renderer", emptyOutDir: true, sourcemap: true },
  server: { fs: { allow: [fileURLToPath(new URL("../..", import.meta.url))] } },
});
