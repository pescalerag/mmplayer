import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "./build.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const directory = resolve(root, "../../.tmp/desktop-electron-test");
await mkdir(directory, { recursive: true });
const rate = 8000,
  frames = rate * 20,
  wav = Buffer.alloc(44 + frames * 2);
wav.write("RIFF");
wav.writeUInt32LE(wav.length - 8, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24);
wav.writeUInt32LE(rate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(frames * 2, 40);
for (let i = 0; i < frames; i++)
  wav.writeInt16LE(
    Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 1000),
    44 + i * 2,
  );
const audio = resolve(directory, "Desktop integration test.wav");
await writeFile(audio, wav);
if (!process.env.MMPLAYER_TEST_EXECUTABLE) await build();
const env = {
  ...process.env,
  MMPLAYER_DESKTOP_SMOKE: "1",
  MMPLAYER_DESKTOP_SMOKE_AUDIO: audio,
  MMPLAYER_DESKTOP_DATA: process.env.MMPLAYER_TEST_PROFILE || resolve(directory, `profile-${Date.now()}`),
};
delete env.ELECTRON_RUN_AS_NODE;
const require = createRequire(import.meta.url);
const child = spawn(process.env.MMPLAYER_TEST_EXECUTABLE || require("electron"), process.env.MMPLAYER_TEST_EXECUTABLE ? [] : [root], {
  stdio: "inherit",
  env,
  windowsHide: true,
});
const timeout = setTimeout(() => {
  child.kill();
  process.exitCode = 1;
}, 60000);
child.on("exit", async (code) => {
  clearTimeout(timeout);
  process.exitCode = code ?? 1;
  if (code !== 0) return;
  try {
    const saved = JSON.parse(
      await readFile(
        resolve(env.MMPLAYER_DESKTOP_DATA, "settings.json"),
        "utf8",
      ),
    );
    assert.equal(saved.player.queues.length, 5);
    assert.equal(saved.player.activeQueue, 0);
    assert.equal(saved.player.queues[0].trackIds.length, 1);
    assert.ok(saved.player.queues[0].position > 0);
    console.log("MMPLAYER_CLOSE_PERSISTENCE OK");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
});
