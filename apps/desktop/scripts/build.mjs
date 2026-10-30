import { build as bundle } from "esbuild";
import { build as webBuild } from "vite";
import { transformAsync } from "@babel/core";
import { readFile, copyFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export function nativeOptions() {
  const decorators = {
    name: "shared-model-decorators",
    setup(build) {
      build.onLoad(
        {
          filter:
            /watermelondb[\\/]adapters[\\/]sqlite[\\/]sqlite-node[\\/]DatabaseBridge\.js$/,
        },
        async ({ path }) => {
          const source = await readFile(path, "utf8");
          // The bridge replaces its waiting driver during schema creation/migration.
          // Close that connection before the replacement (Windows file locking).
          return {
            contents: source
              .replace(
                "var driver = new _DatabaseDriver.default();",
                "this.connections[tag]?.driver?.database?.instance?.close(); var driver = new _DatabaseDriver.default();",
              )
              .replace(
                "var _driver = new _DatabaseDriver.default();",
                "this.connections[tag]?.driver?.database?.instance?.close(); var _driver = new _DatabaseDriver.default();",
              ),
            loader: "js",
          };
        },
      );
      build.onLoad(
        {
          filter:
            /watermelondb[\\/]adapters[\\/]sqlite[\\/]sqlite-node[\\/]DatabaseDriver\.js$/,
        },
        async ({ path }) => {
          const source = await readFile(path, "utf8");
          const original =
            "dbName.startsWith('/') || dbName.startsWith('file:')";
          if (!source.includes(original))
            throw new Error(
              "Review WatermelonDB desktop path compatibility after upgrading.",
            );
          // Upstream Node driver recognizes POSIX paths but not Windows drive paths.
          return {
            contents: source
              .replace(
                original,
                "require('node:path').isAbsolute(dbName) || dbName.startsWith('file:')",
              )
              // Schema setup re-enters init on the same driver. Reuse its connection;
              // a leaked first connection prevents database replacement on Windows.
              .replace(
                "this.database = new _Database.default(getPath(dbName));",
                "if (!this.database) this.database = new _Database.default(getPath(dbName));",
              ),
            loader: "js",
          };
        },
      );
      build.onLoad(
        { filter: /[\\/]src[\\/]database[\\/]models[\\/].*\.ts$/ },
        async ({ path }) => {
          const source = await readFile(path, "utf8");
          const result = await transformAsync(source, {
            filename: path,
            configFile: false,
            babelrc: false,
            plugins: [
              [
                "@babel/plugin-transform-typescript",
                { allowDeclareFields: true },
              ],
              ["@babel/plugin-proposal-decorators", { legacy: true }],
              ["@babel/plugin-transform-class-properties", { loose: true }],
            ],
          });
          return { contents: result.code, loader: "js" };
        },
      );
    },
  };
  return {
    absWorkingDir: root,
    entryPoints: [
      "src/main/main.ts",
      "src/main/preload.ts",
      "src/main/libraryWorker.ts",
      "src/main/metadataWorker.ts",
    ],
    outdir: "build",
    outExtension: { ".js": ".cjs" },
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node24",
    external: ["electron", "node-taglib-sharp"],
    alias: { "better-sqlite3": resolve(root, "src/main/sqliteEntry.cjs"), 'decode-uri-component': require.resolve('desktop-uri-decoder') },
    define: { __DEV__: "false", "process.env.NODE_ENV": '"production"' },
    plugins: [decorators],
    sourcemap: true,
    metafile: true,
  };
}
export async function build({ rendererPlugins = [] } = {}) {
  const native = await bundle(nativeOptions());
  await copyFile(
    resolve(root, "../../src/assets/images/icon.png"),
    resolve(root, "build/icon.png"),
  );
  const renderer = await webBuild({ root, configFile: resolve(root, "vite.config.ts"), plugins: rendererPlugins });
  const inputs = Object.keys(native.metafile.inputs).map(path => resolve(root, path));
  for (const output of Array.isArray(renderer) ? renderer : [renderer]) {
    if ('output' in output) for (const chunk of output.output) {
      if (chunk.type === 'chunk') inputs.push(...Object.keys(chunk.modules));
    }
  }
  await writeFile(resolve(root, 'build/bundled-inputs.json'), JSON.stringify([...new Set(inputs)], null, 2));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await build();
