import { archiveSize, createArchive, extractArchive } from "../src/main/archives";
import { replaceFile } from '../src/main/atomicFile';
import { createServer } from 'node:net';
import { DiscordPresenceClient, discordFrame } from '../src/main/discordPresence';
import { buildDiscordActivity, publicArtworkUrl } from '../../../src/services/discord/activity';
import { registerDesktopLeaveGuard, requestDesktopNavigation } from "../src/renderer/navigationGuard";
import { remapBackupTracks } from "../src/shared/backupPaths";
import * as yazl from "yazl";
import { normalizeDesktopZoom, stepDesktopZoom, desktopPanelLayout } from "../src/shared/desktopScale";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  writeFile,
  rename,
  readFile,
  rm,
} from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import { LibraryWorkerClient } from "../src/main/workerClient";
import {
  SettingsFile,
  normalizePlayer,
  normalizePreferences,
} from "../src/main/settings";
import { mediaResponse, parseByteRange } from "../src/main/media";
import { positionOverlay } from "../../../packages/core/src/overlayPosition";
import { DesktopMenuStack } from "../src/renderer/desktopMenuStack";
import { writeFileMetadata } from "../src/main/metadataWriter";
import { parseFile } from "music-metadata";
import { SystemMediaSession } from "../src/renderer/systemMedia";
import { parseLRC } from "@mmplayer/core/lyrics";
import {
  normalizeSkipSegments,
  resolveSkipPosition,
} from "@mmplayer/core/timestamps";
import type { LibrarySnapshot } from "@mmplayer/platform";
import { emptyPlayer } from "@mmplayer/platform";
import type { LibraryTrack } from "@mmplayer/platform";
import type { DesktopBridge } from "@mmplayer/platform";
import { createDesktopDatabase } from "../src/renderer/ports/databaseAdapter";
import type Track from "../../../src/database/models/Track";
import type Artist from "../../../src/database/models/Artist";
import type Tag from "../../../src/database/models/Tag";

const tempRoot = resolve("../../.tmp/desktop-tests");

test('atomic replacement tolerates transient Windows locks and preserves files on permanent errors', async () => {
  const directory = await temporary(), target = join(directory, 'index.json'), pending = target + '.pending';
  try {
    await writeFile(target, 'old');await writeFile(pending, 'new');let attempts = 0;
    await replaceFile(pending, target, async (from, to) => {
      if (++attempts <= 2) { assert.equal(await readFile(target, 'utf8'), 'old');throw Object.assign(Error('busy'), {code:'EPERM'}); }
      await rename(from, to);
    });
    assert.equal(attempts, 3);assert.equal(await readFile(target, 'utf8'), 'new');
    await writeFile(pending, 'next');attempts=0;
    await assert.rejects(replaceFile(pending,target,async()=>{attempts++;throw Object.assign(Error('missing'),{code:'ENOENT'});}),/missing/);
    assert.equal(attempts,1);assert.equal(await readFile(target,'utf8'),'new');assert.equal(await readFile(pending,'utf8'),'next');
    attempts=0;
    await assert.rejects(replaceFile(pending,target,async()=>{attempts++;throw Object.assign(Error('locked'),{code:'EACCES'});}),/locked/);
    assert.equal(attempts,6);assert.equal(await readFile(target,'utf8'),'new');assert.equal(await readFile(pending,'utf8'),'next');
  } finally { await cleanup(directory); }
});

test('Discord listening activity preserves primary artist, collaborators, cover links and playback time', () => {
  const activity = buildDiscordActivity({id:'song',title:'Song',primaryArtist:'Main Artist',artists:['Guest','Main Artist'],album:'Album',coverUrl:'https://example.com/cover.jpg'},30,180,1.5,1000000);
  assert.equal(activity.name,'Main Artist');assert.equal(activity.type,2);assert.equal(activity.status_display_type,0);
  assert.equal(activity.state,'Main Artist, Guest');assert.equal(activity.details,'Song');
  assert.equal(activity.assets.large_image,'https://example.com/cover.jpg');assert.equal(activity.assets.large_url,'https://mmplayer.pescalerag.com');
  assert.deepEqual(activity.timestamps,{start:980,end:1100});
  for(const uri of ['file:///private/song.jpg','mmplayer-media://cover/id','https://127.0.0.1/a','http://example.com/a','https://192.168.0.1/a'])assert.equal(publicArtworkUrl(uri),null);
});

test('Discord IPC handles fragmented frames, ping, reconnect, latest song and clear on disconnect', async () => {
  const path = process.platform==='win32'?`\\\\.\\pipe\\mmplayer-discord-test-${process.pid}`:join(await temporary(),'discord-test.sock');
  const sockets=new Set<import('node:net').Socket>(),messages:any[]=[];
  let connections=0;
  const server=createServer(socket=>{
    sockets.add(socket);connections++;let buffer=Buffer.alloc(0);
    socket.on('close',()=>sockets.delete(socket));socket.on('error',()=>{});
    socket.on('data',chunk=>{
      buffer=Buffer.concat([buffer,chunk]);
      while(buffer.length>=8){const op=buffer.readUInt32LE(0),size=buffer.readUInt32LE(4);if(buffer.length<size+8)return;const message=JSON.parse(buffer.subarray(8,size+8).toString());buffer=buffer.subarray(size+8);messages.push({op,message});
        if(op===0){assert.equal(message.client_id,'1565469835033321472');const ready=discordFrame(1,{evt:'READY'});socket.write(ready.subarray(0,5));setTimeout(()=>{if(!socket.destroyed)socket.write(Buffer.concat([ready.subarray(5),discordFrame(3,{ping:1})]));},2);}
        if(op===1&&message.nonce)socket.write(discordFrame(1,{cmd:'SET_ACTIVITY',nonce:message.nonce,data:{}}));
      }
    });
  });
  const until=async(probe:()=>boolean)=>{for(let i=0;i<150;i++){if(probe())return;await new Promise(resolve=>setTimeout(resolve,10));}throw Error('Discord IPC test timed out');};
  await new Promise<void>(resolve=>server.listen(path,resolve));
  const client=new DiscordPresenceClient({paths:[path],retryMs:10,intervalMs:10});
  try {
    client.configure('1565469835033321472');
    const song=buildDiscordActivity({id:'1',title:'First',primaryArtist:'Artist',artists:['Guest'],album:'Album'},0,120);
    client.setActivity(song);await until(()=>messages.some(m=>m.message.args?.activity?.details==='First'));
    await until(()=>messages.some(m=>m.op===4&&m.message.ping===1));assert.equal(client.status,'connected');
    for(const socket of sockets)socket.destroy();
    client.setActivity({...song,details:'Latest'});
    await until(()=>connections>=2&&messages.some(m=>m.message.args?.activity?.details==='Latest'));
    client.setActivity(null);await until(()=>messages.some(m=>m.message.args?.activity===null));
    client.disconnect();assert.equal(client.status,'disabled');
    const count=connections;await new Promise(resolve=>setTimeout(resolve,40));assert.equal(connections,count);
  } finally {client.disconnect();for(const socket of sockets)socket.destroy();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

function audioPayload(data: Buffer, extension: string) {
  if (extension === "flac") {
    let offset = 4;
    for (;;) {
      const last = !!(data[offset] & 128);
      const length = data.readUIntBE(offset + 1, 3);
      offset += 4 + length;
      if (last) return data.subarray(offset);
    }
  }
  let offset = 0;
  if (data.subarray(0, 3).toString() === "ID3")
    offset =
      10 + ((data[6] << 21) | (data[7] << 14) | (data[8] << 7) | data[9]);
  const end =
    data.subarray(-128, -125).toString() === "TAG"
      ? data.length - 128
      : data.length;
  return data.subarray(offset, end);
}

test("physical MP3/FLAC writes preserve audio payload and unchanged tags and clean up failed writes", async () => {
  const directory = await temporary();
  try {
    for (const extension of ["mp3", "flac"]) {
      const original = await readFile(
        resolve(`test/fixtures/tone.${extension}`),
      );
      const path = join(directory, `tone.${extension}`);
      await writeFile(path, original);
      await writeFileMetadata(path, {
        title: "Título 漢字",
        artist: "Artist",
        album: "Album",
        albumArtist: "Album artist",
        year: 2026,
        trackNumber: 3,
        discNumber: 2,
        genre: "Rock",
      });
      const written = await readFile(path);
      assert.deepEqual(
        audioPayload(written, extension),
        audioPayload(original, extension),
      );
      const { common } = await parseFile(path);
      assert.equal(common.title, "Título 漢字");
      assert.equal(common.albumartist, "Album artist");
      assert.equal(common.track.no, 3);
      assert.equal(common.disk.no, 2);
      await writeFileMetadata(path, { title: "Updated", year: 0 });
      const updated = await parseFile(path);
      assert.equal(updated.common.album, "Album");
      assert.equal(updated.common.artist, "Artist");
      assert.ok(!updated.common.year);
    }
    const corrupt = join(directory, "corrupt.flac");
    if (process.platform === "win32") {
      const readonlyFile = join(directory, "readonly.mp3");
      const bytes = await readFile(resolve("test/fixtures/tone.mp3"));
      await writeFile(readonlyFile, bytes);
      const { chmod } = await import("node:fs/promises");
      await chmod(readonlyFile, 0o444);
      try {
        await assert.rejects(
          writeFileMetadata(readonlyFile, { title: "Cannot save" }),
        );
        assert.deepEqual(await readFile(readonlyFile), bytes);
      } finally {
        await chmod(readonlyFile, 0o644);
      }
    }
    await writeFile(corrupt, "not audio");
    await assert.rejects(writeFileMetadata(corrupt, { title: "No" }));
    assert.equal(await readFile(corrupt, "utf8"), "not audio");
    const { readdir } = await import("node:fs/promises");
    assert.ok(
      !(await readdir(directory)).some((name) => name.includes(".mmplayer")),
    );
  } finally {
    await cleanup(directory);
  }
});

test("system media session updates metadata, timeline and speed without repeating metadata writes and clears empty queues", () => {
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "MediaMetadata",
  );
  let metadataWrites = 0;
  Object.defineProperty(globalThis, "MediaMetadata", {
    configurable: true,
    value: class {
      constructor(data: unknown) {
        metadataWrites++;
        Object.assign(this, data);
      }
    },
  });
  const positions: unknown[] = [],
    actions = new Map<string, () => void>();
  const session = {
    metadata: null,
    playbackState: "none",
    setActionHandler: (action: string, callback: () => void) =>
      actions.set(action, callback),
    setPositionState: (position: unknown) => positions.push(position),
  };
  try {
    let plays = 0;
    const integration = new SystemMediaSession(
      session as unknown as MediaSession,
      {
        play: () => {
          plays++;
        },
      },
    );
    const view = {
      track: {
        id: "one",
        title: "Song",
        artist: "Artist",
        album: "Album",
        cover: null,
        available: true,
      },
      playing: true,
      duration: 60,
      position: 12,
    } as import("../src/renderer/player").PlayerView;
    integration.update(view, 1);
    integration.update(view, 1);
    assert.equal(metadataWrites, 1);
    assert.equal(positions.length, 1);
    assert.equal(session.playbackState, "playing");
    integration.update({ ...view, position: 20, playing: false }, 1.5);
    assert.deepEqual(positions.at(-1), {
      duration: 60,
      position: 20,
      playbackRate: 1.5,
    });
    actions.get("play")!();
    assert.equal(plays, 1);
    integration.update({ ...view, track: null, playing: false }, 1);
    assert.equal(session.metadata, null);
    assert.equal(session.playbackState, "none");
    assert.equal(positions.at(-1), undefined);
  } finally {
    if (descriptor)
      Object.defineProperty(globalThis, "MediaMetadata", descriptor);
    else Reflect.deleteProperty(globalThis, "MediaMetadata");
  }
});

test("dropped files/folders deduplicate and metadata batches continue after a failed file without changing its DB values", async () => {
  const directory = await temporary();
  await mkdir(join(directory, "data"));
  const worker = new LibraryWorkerClient(
    resolve("build/libraryWorker.cjs"),
    join(directory, "data"),
    () => {},
  );
  try {
    await worker.request("initialize");
    const music = join(directory, "music");
    await mkdir(join(music, "nested"), { recursive: true });
    const good = join(music, "Good.wav"),
      bad = join(music, "nested", "Bad.wav");
    await writeFile(good, wav());
    await writeFile(bad, wav());
    await writeFile(join(music, "ignored.txt"), "not audio");
    const dropped = await worker.request<{ trackIds: string[] }>(
      "importPaths",
      [music, good],
    );
    assert.equal(new Set(dropped.trackIds).size, 2);
    const snapshot = await worker.request<LibrarySnapshot>("library");
    const track = snapshot.tracks.find((track) => track.title === "Good")!;
    await worker.request("favorite", { trackId: track.id });
    await writeFile(bad, "corrupt audio");
    const report = await worker.request<
      import("@mmplayer/platform").MetadataWriteResult[]
    >("writeMetadata", [
      { filePath: bad, metadata: { title: "Must not reach DB" } },
      { filePath: good, metadata: { title: "Saved on disk", year: 2026 } },
    ]);
    assert.equal(report[0].success, false);
    assert.equal(report[1].success, true);
    assert.equal((await parseFile(good)).common.title, "Saved on disk");
    const after = await worker.request<LibrarySnapshot>("library");
    assert.equal(
      after.tracks.find((t) => t.id === track.id)?.title,
      "Saved on disk",
    );
    assert.equal(after.tracks.find((t) => t.id === track.id)?.isFavorite, true);
    assert.equal(after.tracks.find((t) => t.id === track.id)?.year, 2026);
    await worker.request("writeMetadata", [
      { filePath: good, metadata: { year: 2025 } },
    ]);
    assert.equal(
      (await worker.request<LibrarySnapshot>("library")).tracks.find(
        (t) => t.id === track.id,
      )?.year,
      2025,
    );
    await worker.request("writeMetadata", [
      { filePath: good, metadata: { year: 0 } },
    ]);
    assert.equal(
      (await worker.request<LibrarySnapshot>("library")).tracks.find(
        (t) => t.id === track.id,
      )?.year,
      null,
    );
    assert.ok(after.tracks.some((t) => t.title === "Bad"));
    assert.ok(!after.tracks.some((t) => t.title === "Must not reach DB"));
  } finally {
    await worker.close();
    await cleanup(directory);
  }
});

test("contextual menus preserve parent data, replace siblings and dismiss one level at a time", async () => {
  const stack = new DesktopMenuStack();
  const anchor = { x: 1100, y: 650, width: 30, height: 30 };
  stack.interaction(anchor);
  stack.open("track-menu", { track: { id: "original-track" } });
  const parent = stack.getSnapshot()[0];
  stack.interaction(anchor, parent.id);
  stack.close(parent.id);
  stack.open("playlist-selector", { tracks: ["original-track"] });
  await Promise.resolve();
  assert.equal(stack.getSnapshot().length, 2);
  assert.equal(stack.getSnapshot()[0], parent);
  assert.equal(parent.props.track.id, "original-track");
  const child = stack.getSnapshot()[1];
  stack.interaction(anchor, child.id);
  stack.open("playlist-selector", { isCreatingDirectly: true });
  assert.equal(stack.getSnapshot().length, 3);
  assert.equal(stack.getSnapshot()[2].parentId, child.id);
  stack.close();
  await Promise.resolve();
  assert.equal(stack.getSnapshot().at(-1), child);
  stack.interaction(anchor, parent.id);
  stack.open("tag-manager", { targetId: "original-track" });
  assert.equal(stack.getSnapshot().length, 2);
  assert.equal(stack.getSnapshot()[1].type, "tag-manager");
  stack.clear();
  await Promise.resolve();
  assert.equal(stack.getSnapshot().length, 0);
  // Opening elsewhere must not reuse the previous menu's target or ancestry.
  stack.interaction(anchor);
  stack.open("track-menu", { track: { id: "other-track" } });
  assert.equal(stack.getSnapshot()[0].parentId, undefined);
  assert.equal(stack.getSnapshot()[0].props.track.id, "other-track");
});

test("floating menus flip on either edge and remain inside small resized windows", () => {
  assert.equal(
    positionOverlay(
      { x: 700, y: 300, width: 340, height: 40 },
      { width: 340, height: 400 },
      { width: 1440, height: 900 },
      true,
      "left",
    ).left,
    356,
  );
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 900, height: 640 },
    { width: 280, height: 240 },
  ]) {
    for (const x of [-200, 0, viewport.width - 25, viewport.width + 200]) {
      const p = positionOverlay(
        { x, y: viewport.height - 24, width: 24, height: 24 },
        { width: 340, height: 720 },
        viewport,
        true,
      );
      assert.ok(p.left >= 8 && p.top >= 8);
      assert.ok(p.left + p.width <= viewport.width - 8);
      assert.ok(p.top + p.maxHeight <= viewport.height - 8);
      if (viewport.width > 400 && x > 0) assert.ok(p.left + p.width < x);
    }
  }
});
test("shared screen models observe worker writes, preserve identity, and persist renderer edits without echoing changes", async () => {
  const directory = await temporary();
  const listeners = new Map<string, Set<(value: any) => void>>();
  const worker = new LibraryWorkerClient(
    resolve("build/libraryWorker.cjs"),
    directory,
    (event, data) =>
      listeners.get(event)?.forEach((listener) => listener(data)),
  );
  const bridge = {
    importDroppedFiles: async () => ({ trackIds: [], imported: 0 }),
    invoke: (command: string, input: unknown) => worker.request(command, input),
    on: (event: string, listener: (value: any) => void) => {
      let set = listeners.get(event);
      if (!set) listeners.set(event, (set = new Set()));
      set.add(listener);
      return () => set!.delete(listener);
    },
    onBeforeClose: () => () => {},
  } as DesktopBridge;
  const connection = createDesktopDatabase(bridge);
  let stop = () => {};
  try {
    await worker.request("initialize");
    const file = join(directory, "Shared screen.wav");
    await writeFile(file, wav());
    await worker.request("addRoots", [file]);
    const tracks = connection.database.get<Track>("tracks");
    const [track] = await tracks.query().fetch();
    const changes: { favorite: boolean; rating: number | null }[] = [];
    const subscription = track
      .observe()
      .subscribe((value) =>
        changes.push({ favorite: value.isFavorite, rating: value.rating }),
      );
    stop = () => subscription.unsubscribe();
    await worker.request("favorite", { trackId: track.id });
    assert.equal(track.isFavorite, true);
    assert.equal((await tracks.query().fetch())[0], track);
    const beforeEdit = changes.length;
    await track.updateRating(4.5);
    assert.equal(changes.length, beforeEdit + 1);
    assert.equal(
      (await worker.request<LibrarySnapshot>("library")).tracks[0].rating,
      4.5,
    );
    assert.equal(changes.at(-1)?.rating, 4.5);
    const tag = await connection.database.write(() =>
      connection.database.get<Tag>("tags").create((value) => {
        value.name = "Shared tag";
        value.color = "#123456";
      }),
    );
    assert.equal(
      (await worker.request<LibrarySnapshot>("library")).tags[0].name,
      "Shared tag",
    );
    await connection.database.write(() => tag.destroyPermanently());
    assert.equal(
      (await worker.request<LibrarySnapshot>("library")).tags.length,
      0,
    );
    await assert.rejects(
      bridge.invoke("database", {
        method: "find",
        args: ["invalid-table", "id"],
      }),
    );
  } finally {
    stop();
    connection.dispose();
    await worker.close();
    await cleanup(directory);
  }
});
async function temporary() {
  await mkdir(tempRoot, { recursive: true });
  return mkdtemp(join(tempRoot, "case-"));
}
async function cleanup(directory: string) {
  assert.ok(resolve(directory).startsWith(tempRoot + sep));
  await rm(directory, { recursive: true, force: true });
}
function wav(seconds = 1) {
  const rate = 8000,
    frames = rate * seconds,
    output = Buffer.alloc(44 + frames * 2);
  output.write("RIFF", 0);
  output.writeUInt32LE(output.length - 8, 4);
  output.write("WAVEfmt ", 8);
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(1, 22);
  output.writeUInt32LE(rate, 24);
  output.writeUInt32LE(rate * 2, 28);
  output.writeUInt16LE(2, 32);
  output.writeUInt16LE(16, 34);
  output.write("data", 36);
  output.writeUInt32LE(frames * 2, 40);
  for (let i = 0; i < frames; i++)
    output.writeInt16LE(
      Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 5000),
      44 + i * 2,
    );
  return output;
}

test("bulk physical writes publish progress, accept cancellation during a job and reconcile the library once", async () => {
  const directory = await temporary();
  await mkdir(join(directory, "data"));
  let scans = 0,
    cancellation: Promise<unknown> | undefined;
  const worker = new LibraryWorkerClient(
    resolve("build/libraryWorker.cjs"),
    join(directory, "data"),
    (event, data) => {
      if (
        event === "scan" &&
        (data as { active: boolean; completed: number }).active &&
        (data as { completed: number }).completed === 0
      )
        scans++;
      if (
        event === "metadataProgress" &&
        (data as { batchId: string }).batchId === "cancel-test" &&
        !cancellation
      )
        cancellation = worker.request("cancelMetadata", {
          batchId: "cancel-test",
        });
    },
  );
  try {
    await worker.request("initialize");
    const music = join(directory, "music");
    await mkdir(music);
    const paths = Array.from({ length: 30 }, (_, i) =>
      join(music, `Song ${i}.wav`),
    );
    await Promise.all(paths.map((path) => writeFile(path, wav())));
    await worker.request("importPaths", [music]);
    scans = 0;
    const results = await worker.request<
      import("@mmplayer/platform").MetadataWriteResult[]
    >("writeMetadata", {
      batchId: "cancel-test",
      items: paths.map((filePath, i) => ({
        filePath,
        metadata: { title: `Edited ${i}` },
      })),
    });
    await cancellation;
    assert.ok(results.length >= 10 && results.length < paths.length);
    assert.equal(scans, 1);
    assert.equal((await parseFile(paths.at(-1)!)).common.title, undefined);
    const snapshot = await worker.request<LibrarySnapshot>("library");
    assert.equal(snapshot.tracks.length, 30);
    assert.equal(
      snapshot.tracks.filter((track) => track.title.startsWith("Edited "))
        .length,
      results.length,
    );
  } finally {
    await worker.close();
    await cleanup(directory);
  }
});

test("real SQLite worker scans files, retains annotations and unavailable songs, and persists across sessions", async () => {
  const directory = await temporary();
  const music = join(directory, "music");
  const data = join(directory, "data");
  await mkdir(music);
  await mkdir(data);
  await writeFile(join(music, "Song.wav"), wav());
  await writeFile(join(music, "not-audio.txt"), "skip this");
  const events: string[] = [];
  let worker = new LibraryWorkerClient(
    resolve("build/libraryWorker.cjs"),
    data,
    (event) => events.push(event),
  );
  try {
    await worker.request("initialize");
    assert.equal(await worker.request("addRoots", [music]), 1);
    let snapshot = await worker.request<LibrarySnapshot>("library");
    assert.equal(snapshot.tracks.length, 1);
    assert.equal(snapshot.tracks[0].available, true);
    assert.equal(snapshot.tracks[0].title, "Song");
    assert.equal(snapshot.tracks[0].duration, 1);
    assert.ok(snapshot.tracks[0].fileUrl.startsWith("mmplayer-media://track/"));
    const id = snapshot.tracks[0].id;
    await worker.request("favorite", { trackId: id });
    await worker.request("rate", { trackId: id, rating: 4.5 });
    await assert.rejects(worker.request("rate", { trackId: id, rating: 6 }));
    const playlistId = await worker.request<string>("createPlaylist", {
      name: "Test list",
    });
    await worker.request("addToPlaylist", { playlistId, trackIds: [id, id] });
    const tagId = await worker.request("createTag", {
      name: "Test tag",
      color: "#123456",
    });
    await worker.request("toggleTag", { tagId, trackId: id });
    await worker.request("scan");
    snapshot = await worker.request<LibrarySnapshot>("library");
    assert.equal(snapshot.tracks[0].rating, 4.5);
    assert.equal(snapshot.tracks[0].isFavorite, true);
    assert.equal(snapshot.playlists[0].count, 2);
    assert.deepEqual(snapshot.tags[0].trackIds, [id]);
    assert.ok(events.filter((event) => event === "library").length >= 6);
    await rename(music, music + "-disconnected");
    await worker.request("scan");
    snapshot = await worker.request<LibrarySnapshot>("library");
    assert.equal(snapshot.tracks[0].available, false);
    assert.equal(snapshot.tracks[0].rating, 4.5);
    assert.equal(await worker.request("media", { id, kind: "track" }), null);
    assert.equal(
      await worker.request("media", {
        id: "../../settings.json",
        kind: "track",
      }),
      null,
    );
    await worker.close();
    worker = new LibraryWorkerClient(
      resolve("build/libraryWorker.cjs"),
      data,
      () => {},
    );
    await worker.request("initialize");
    snapshot = await worker.request<LibrarySnapshot>("library");
    assert.equal(snapshot.tracks[0].id, id);
    assert.equal(snapshot.tags[0].name, "Test tag");
    await rename(music + "-disconnected", music);
    await worker.request("scan");
    snapshot = await worker.request<LibrarySnapshot>("library");
    assert.equal(snapshot.tracks[0].available, true);
    await worker.request("removeFromPlaylist", { playlistId, trackIds: [id] });
    snapshot = await worker.request<LibrarySnapshot>("library");
    assert.equal(snapshot.playlists[0].count, 0);
    assert.equal(snapshot.tracks.length, 1);
    assert.equal(snapshot.tracks[0].isFavorite, true);
  } finally {
    await worker.close();
    await cleanup(directory);
  }
});

test("streaming supports precise ranges and rejects invalid identifiers and ranges", async () => {
  const directory = await temporary(),
    file = join(directory, "sound.wav");
  const content = wav();
  await writeFile(file, content);
  try {
    const lookup = async (id: string) => (id === "song" ? file : null);
    const response = await mediaResponse(
      new Request("mmplayer-media://track/song", {
        headers: { Range: "bytes=10-19" },
      }),
      lookup,
    );
    assert.equal(response.status, 206);
    assert.equal(
      response.headers.get("Content-Range"),
      `bytes 10-19/${content.length}`,
    );
    assert.deepEqual(
      Buffer.from(await response.arrayBuffer()),
      content.subarray(10, 20),
    );
    assert.equal(
      (
        await mediaResponse(
          new Request("mmplayer-media://track/song", {
            headers: { Range: "bytes=999999999-" },
          }),
          lookup,
        )
      ).status,
      416,
    );
    assert.equal(
      (
        await mediaResponse(
          new Request("mmplayer-media://track/%2E%2E%2Fsecret"),
          lookup,
        )
      ).status,
      404,
    );
    const head = await mediaResponse(
      new Request("mmplayer-media://track/song", { method: "HEAD" }),
      lookup,
    );
    assert.equal((await head.arrayBuffer()).byteLength, 0);
    assert.deepEqual(parseByteRange("bytes=-5", 100), { start: 95, end: 99 });
  } finally {
    await cleanup(directory);
  }
});

test("settings serialize competing writes and restore five independent queue sessions", async () => {
  const directory = await temporary();
  try {
    const settings = new SettingsFile(directory);
    await settings.load();
    const player = normalizePlayer({
      activeQueue: 3,
      queues: [
        undefined,
        {
          name: "Other",
          trackIds: ["a"],
          position: 12,
          accumulatedTime: 10,
          shuffle: true,
          repeat: "all",
        },
      ],
    });
    await Promise.all([
      settings.update({ sidebarWidth: 300 }),
      settings.update({ playerVisible: false }, player),
      settings.update({ language: "en", zoomFactor: 0.9 }),
    ]);
    const restored = await new SettingsFile(directory).load();
    assert.equal(restored.preferences.sidebarWidth, 300);
    assert.equal(restored.preferences.playerVisible, false);
    assert.equal(restored.preferences.language, "en");
    assert.equal(restored.preferences.zoomFactor, 0.9);
    assert.equal(normalizePreferences({ zoomFactor: NaN }).zoomFactor, 1);
    assert.equal(normalizePreferences({ zoomFactor: 9 }).zoomFactor, 1.3);
    assert.equal(normalizePreferences({ zoomFactor: 0.01 }).zoomFactor, 0.5);
    assert.equal(normalizePreferences({ zoomFactor: 1.5 }).zoomFactor, 1.3);
    assert.equal(
      "tableView" in normalizePreferences({ tableView: true } as never),
      false,
    );
    assert.equal(restored.player.queues.length, 5);
    assert.equal(restored.player.queues[1].accumulatedTime, 10);
    assert.equal(restored.player.queues[1].repeat, "all");
    assert.equal(restored.player.queues[2].shuffle, false);
    assert.equal(normalizePreferences({ playerWidth: NaN }).playerWidth, 360);
  } finally {
    await cleanup(directory);
  }
});

test("nested menus flip at viewport edges and pure mobile rules are shared", () => {
  assert.deepEqual(
    positionOverlay(
      { x: 1100, y: 700, width: 250, height: 30 },
      { width: 260, height: 350 },
      { width: 1366, height: 768 },
      true,
    ),
    { left: 836, top: 410, width: 260, maxHeight: 350 },
  );
  assert.deepEqual(parseLRC("[00:01.50][00:02]Line"), [
    { time: 1.5, text: "Line" },
    { time: 2, text: "Line" },
  ]);
  const segments = normalizeSkipSegments(
    [{ id: "a", startMs: 1000, endMs: 2000 }],
    10000,
  );
  assert.equal(resolveSkipPosition(1500, { enabled: true, segments }), 2000);
});

test("transport preserves a suspended listen and discards an obsolete transition after switching queues", async () => {
  const instances: FakeAudio[] = [];
  class FakeAudio extends EventTarget {
    paused = true;
    currentTime = 0;
    duration = 60;
    readyState = 4;
    seeking = false;
    volume = 1;
    src = "";
    preload = "";
    crossOrigin = "";
    constructor() {
      super();
      instances.push(this);
    }
    async play() {
      this.paused = false;
      this.dispatchEvent(new Event("play"));
    }
    pause() {
      if (!this.paused) {
        this.paused = true;
        this.dispatchEvent(new Event("pause"));
      }
    }
    removeAttribute() {
      this.src = "";
    }
    load() {}
  }
  const calls: { command: string; input: any }[] = [];
  let releaseListen: (() => void) | undefined;
  Object.defineProperty(globalThis, "Audio", {
    configurable: true,
    value: FakeAudio,
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener() {},
      mmplayer: {
        on: () => () => {},
        invoke: async (command: string, input: any) => {
          calls.push({ command, input });
          if (command === "listen" && releaseListen !== undefined)
            await new Promise<void>((resolve) => {
              releaseListen = resolve;
            });
        },
      },
    },
  });
  const { DesktopPlayer } = await import("../src/renderer/player");
  const transport = new DesktopPlayer(),
    audio = instances[0]!;
  const song = (id: string) =>
    ({
      id,
      title: id,
      available: true,
      duration: 60,
      fileUrl: `mmplayer-media://track/${id}`,
    }) as LibraryTrack;
  const state = emptyPlayer();
  Object.assign(state.queues[0], {
    trackIds: ["a", "b"],
    position: 12,
    accumulatedTime: 7,
  });
  transport.initialize(state, [song("a"), song("b")]);
  audio.dispatchEvent(new Event("loadedmetadata"));
  assert.equal(audio.currentTime, 12);
  await transport.play();
  transport.switchQueue(1);
  assert.equal(transport.getSnapshot().track, null);
  assert.equal(transport.getSnapshot().playing, false);
  assert.equal(calls.filter((call) => call.command === "listen").length, 0);
  transport.switchQueue(0);
  audio.dispatchEvent(new Event("loadedmetadata"));
  assert.equal(transport.getSnapshot().playing, false);
  assert.equal(audio.currentTime, 12);
  releaseListen = () => {};
  const advance = transport.next();
  await Promise.resolve();
  transport.switchQueue(1);
  releaseListen!();
  await advance;
  assert.equal(transport.getSnapshot().activeQueue, 1);
  assert.equal(transport.getSnapshot().track, null);
  assert.equal(state.queues[0].accumulatedTime, 0);
  assert.equal(state.queues[1].accumulatedTime, 0);
  assert.deepEqual(
    calls.filter((call) => call.command === "listen").map((call) => call.input),
    [{ trackId: "a", seconds: 7 }],
  );
  await transport.saveNow();
  releaseListen = undefined;
  const editState = emptyPlayer();
  editState.queues[0].trackIds = ['a', 'b', 'c'];
  transport.initialize(editState, [song('a'), song('b'), song('c')]);
  transport.add([song('b')], true);
  const entries = transport.getQueueTracks();
  assert.equal(new Set(entries.map(entry => entry.id)).size, 4, 'duplicate songs need distinct queue identities');
  assert.equal(entries[1].isManual, true);
  assert.equal(entries[2].isManual, false);
  assert.equal(entries[1].title, 'b');
  transport.removeQueueEntries([1]);
  assert.equal(transport.getQueueTracks()[1].id, entries[2].id, 'removing a duplicate must preserve the other entry');
  transport.insertQueueEntries([entries[1]], 1);
  assert.equal(transport.getQueueTracks()[1].id, entries[1].id, 'undo restores the removed instance');
  transport.moveQueueEntry(3, 2);
  assert.deepEqual(transport.getQueueTracks().map(entry => entry.libraryId), ['a', 'b', 'c', 'b']);
  assert.equal(transport.getSnapshot().track?.id, 'a', 'queue edits must preserve playback');
  await transport.skipTo(2);
  assert.equal(transport.getSnapshot().track?.id, 'c');
  assert.equal(transport.getSnapshot().queues[0].trackIds.length, 4, 'playing an entry must retain the queue');
  await transport.resetAllQueues();
  assert.ok(transport.getSnapshot().queues.every(queue => queue.trackIds.length === 0));
  await transport.saveNow();
});

test("multi-CD albums group into a single album and exclusions un-scan folders until re-added", async () => {
  const directory = await temporary();
  const music = join(directory, "music");
  const data = join(directory, "data");
  const wallCd1 = join(music, "The Wall", "CD 1");
  const wallCd2 = join(music, "The Wall", "CD 2");
  const extraFolder = join(music, "Extra");
  await mkdir(wallCd1, { recursive: true });
  await mkdir(wallCd2, { recursive: true });
  await mkdir(extraFolder, { recursive: true });
  await mkdir(data, { recursive: true });

  await writeFile(join(wallCd1, "01 Hey You.wav"), wav());
  await writeFile(join(wallCd2, "01 Waiting For The Worms.wav"), wav());
  await writeFile(join(extraFolder, "Extra Track.wav"), wav());

  const worker = new LibraryWorkerClient(
    resolve("build/libraryWorker.cjs"),
    data,
    () => {},
  );

  try {
    await worker.request("initialize");
    await worker.request("addRoots", [music]);
    let snapshot = await worker.request<LibrarySnapshot>("library");

    // All tracks scanned
    assert.equal(snapshot.tracks.length, 3);

    // Multi-CD albums grouped into a single album
    const wallAlbum = snapshot.albums.find((a) =>
      a.name.toLowerCase().includes("wall"),
    );
    assert.ok(wallAlbum, "The Wall album should exist");
    assert.equal(
      wallAlbum.count,
      2,
      "Both CD1 and CD2 tracks should belong to the same album",
    );

    const cd1Track = snapshot.tracks.find((t) => t.title.includes("Hey You"));
    const cd2Track = snapshot.tracks.find((t) => t.title.includes("Waiting"));
    assert.equal(cd1Track?.albumId, wallAlbum.id);
    assert.equal(cd2Track?.albumId, wallAlbum.id);
    assert.equal(cd1Track?.discNumber, 1);
    assert.equal(cd2Track?.discNumber, 2);

    // Unscan / Exclude folder
    await worker.request("excludeFolders", [extraFolder]);
    snapshot = await worker.request<LibrarySnapshot>("library");
    assert.equal(
      snapshot.tracks.length,
      2,
      "Excluded folder tracks should be removed from DB",
    );
    assert.ok(!snapshot.tracks.some((t) => t.title.includes("Extra Track")));

    // Re-adding the folder via addRoots un-excludes it and brings tracks back
    await worker.request("addRoots", [extraFolder]);
    snapshot = await worker.request<LibrarySnapshot>("library");
    assert.equal(
      snapshot.tracks.length,
      3,
      "Re-added folder tracks should be restored",
    );
    assert.ok(snapshot.tracks.some((t) => t.title.includes("Extra Track")));

    // Exclude individual song
    const extraTrack = snapshot.tracks.find((t) =>
      t.title.includes("Extra Track"),
    )!;
    await worker.request("excludeSongs", [extraTrack.id]);
    snapshot = await worker.request<LibrarySnapshot>("library");
    assert.equal(snapshot.tracks.length, 2, "Excluded song should be removed");
    assert.ok(!snapshot.tracks.some((t) => t.id === extraTrack.id));
  } finally {
    await worker.close();
    await cleanup(directory);
  }
});

test("desktop zoom is absolute and panel layout adapts to the logical viewport without losing saved widths", () => {
  assert.equal(normalizeDesktopZoom(), 1);
  assert.equal(normalizeDesktopZoom(NaN), 1);
  assert.equal(normalizeDesktopZoom(Infinity), 1);
  assert.equal(stepDesktopZoom(1, 1), 1.1);
  assert.equal(stepDesktopZoom(1, -1), 0.9);
  assert.equal(stepDesktopZoom(0.5, -1), 0.5);
  assert.equal(stepDesktopZoom(1.3, 1), 1.3);
  assert.equal(stepDesktopZoom(1.2, 1), 1.3);
  assert.equal(normalizeDesktopZoom(2), 1.3);
  for (const [width, height] of [
    [1440, 900],
    [1920, 1080],
    [1366, 768],
    [1280, 720],
    [900, 640],
    [1440, 640],
    [960, 1000],
  ]) {
    for (const zoom of [0.5, 1, 1.2, 1.3]) {
      const logicalWidth = width / zoom;
      for (const sidebar of [72, 224, 360]) {
        for (const player of [290, 360, 520]) {
          const layout = desktopPanelLayout(logicalWidth, sidebar, player, true);
          assert.ok(logicalWidth - layout.sidebarWidth - layout.playerWidth >= 280);
          assert.ok(layout.sidebarWidth <= Math.max(72, sidebar));
          assert.ok(layout.playerWidth <= player);
          const hidden = desktopPanelLayout(logicalWidth, sidebar, player, false);
          assert.equal(hidden.playerWidth, 0);
          assert.equal(hidden.playerVisible, false);
        }
      }
    }
  }
  assert.deepEqual(desktopPanelLayout(1440, 224, 360, true), {
    sidebarWidth: 224, playerWidth: 360, playerVisible: true,
  });
});

// ============================================================================
// MOBILE PARITY TESTS: AUDIO ENGINE & EFFECTS (SECTION 1.1)
// ============================================================================
import {
  readReplayGainFromBuffer,
  readReplayGainTags,
  ReplayGainScanCache,
} from "../src/main/replayGainReader";
import {
  calculateReplayGainMultiplier,
  processReplayGainPcm16,
  player,
} from "../src/renderer/player";
import { EqualizerService } from "../../../src/services/EqualizerService";
import { changeEqualizerBandFromTouch } from "../../../src/utils/equalizerControls";
import {
  initializeEqualizer,
  getEqualizerBandFrequencies,
  getEqualizerBandLevelRange,
  getEqualizerNumberOfBands,
  releaseEqualizer,
  brightenCoverColorForVisualizer,
} from "../src/renderer/ports/equalizer";
import { initializeReplayGain } from "../../../src/services/ReplayGainService";
import {
  CrossfadeService,
  initializeCrossfade,
} from "../../../src/services/CrossfadeService";
import {
  getCrossfadePolicy,
  normalizeCrossfadeSeconds,
} from "../../../src/utils/crossfadePolicy";
import { resolveVisualizerColor } from "../../../src/utils/visualizerColors";
import { useSettingsStore } from "../../../src/store/useSettingsStore";
import { usePlayerStore } from "../src/renderer/ports/playerStore";
import { useCastStore } from "../src/renderer/ports/castStore";
import { useMultipleQueuesStore } from "../src/renderer/ports/queues";
import { useABRepeatStore } from "../src/renderer/ports/abRepeat";
import TrackPlayer, {
  Event as TrackPlayerEvent,
  State,
  getIsFadingOut,
} from "../src/renderer/ports/trackPlayer";
import { ScannerService } from "../src/renderer/ports/scannerService";
import { database } from "../src/renderer/ports/database";

const semitonesToPitch = (st: number) => Math.pow(2, st / 12);
const pitchToSemitones = (pitch: number) => Math.round(12 * Math.log2(pitch));

class FakeWebAudioParam {
  value = 0;
  setTargetAtTime(target: number) {
    this.value = target;
  }
}

class FakeBiquadFilterNode {
  type = "peaking";
  frequency = new FakeWebAudioParam();
  Q = new FakeWebAudioParam();
  gain = new FakeWebAudioParam();
  connect(dest: unknown) {
    return dest;
  }
}

class FakeGainNode {
  gain = new FakeWebAudioParam();
  connect(dest: unknown) {
    return dest;
  }
}

class FakeDelayNode {
  delayTime = new FakeWebAudioParam();
  connect(dest: unknown) {
    return dest;
  }
}

class FakeAnalyserNode {
  fftSize = 256;
  smoothingTimeConstant = 0.78;
  frequencyBinCount = 128;
  connect(dest: unknown) {
    return dest;
  }
  getByteFrequencyData(arr: Uint8Array) {
    arr.fill(128);
  }
  getByteTimeDomainData(arr: Uint8Array) {
    arr.fill(128);
  }
}

class FakeAudioContext {
  state: "running" | "suspended" = "running";
  destination = {};
  resume() {
    this.state = "running";
    return Promise.resolve();
  }
  createMediaElementSource() {
    return { connect: (dest: unknown) => dest };
  }
  createGain() {
    return new FakeGainNode();
  }
  createBiquadFilter() {
    return new FakeBiquadFilterNode();
  }
  createDelay() {
    return new FakeDelayNode();
  }
  createAnalyser() {
    return new FakeAnalyserNode();
  }
}

class FakeAudioElement {
  preload = "auto";
  crossOrigin = "anonymous";
  src = "";
  currentTime = 0;
  duration = 180;
  volume = 1;
  playbackRate = 1;
  preservesPitch = true;
  paused = true;
  playCalls = 0;
  pauseCalls = 0;
  private listeners = new Map<string, Set<() => void>>();
  addEventListener(event: string, cb: () => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
  }
  emit(event: string) {
    this.listeners.get(event)?.forEach((cb) => cb());
  }
  load() {}
  play() {
    this.paused = false;
    this.playCalls += 1;
    this.emit("play");
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
    this.pauseCalls += 1;
    this.emit("pause");
  }
  removeAttribute(attr: string) {
    if (attr === "src") this.src = "";
  }
}

function installFakeBrowserAudioEnvironment() {
  const g = globalThis as Record<string, unknown>;
  g.Audio = FakeAudioElement;
  g.AudioContext = FakeAudioContext;
  if (!g.window) {
    g.window = {
      AudioContext: FakeAudioContext,
      mmplayer: {
        invoke: async () => undefined,
        onSystemMediaCommand: () => () => {},
        updateSystemMedia: () => {},
      },
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
      setInterval: globalThis.setInterval.bind(globalThis),
      clearInterval: globalThis.clearInterval.bind(globalThis),
    };
  } else {
    (g.window as Record<string, unknown>).AudioContext = FakeAudioContext;
    (g.window as Record<string, unknown>).setTimeout =
      globalThis.setTimeout.bind(globalThis);
    (g.window as Record<string, unknown>).clearTimeout =
      globalThis.clearTimeout.bind(globalThis);
    (g.window as Record<string, unknown>).setInterval =
      globalThis.setInterval.bind(globalThis);
    (g.window as Record<string, unknown>).clearInterval =
      globalThis.clearInterval.bind(globalThis);
  }
}

// --- Binary Tag Builders for ReplayGain parity tests ---
function synchsafe(value: number): Buffer {
  return Buffer.from([
    (value >>> 21) & 0x7f,
    (value >>> 14) & 0x7f,
    (value >>> 7) & 0x7f,
    value & 0x7f,
  ]);
}

function uint32BE(value: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(value >>> 0, 0);
  return b;
}

function uint64BE(value: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64BE(value, 0);
  return b;
}

function uint32LE(value: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(value >>> 0, 0);
  return b;
}

function encodeId3String(value: string, encoding: number): Buffer {
  switch (encoding) {
    case 0:
      return Buffer.from(value, "latin1");
    case 1:
      return Buffer.concat([
        Buffer.from([0xff, 0xfe]),
        Buffer.from(value, "utf16le"),
      ]);
    case 2: {
      const le = Buffer.from(value, "utf16le");
      const be = Buffer.alloc(le.length);
      for (let i = 0; i < le.length; i += 2) {
        be[i] = le[i + 1];
        be[i + 1] = le[i];
      }
      return be;
    }
    case 3:
      return Buffer.from(value, "utf8");
    default:
      throw new Error(`Unsupported encoding ${encoding}`);
  }
}

function id3Terminator(encoding: number): Buffer {
  return encoding === 1 || encoding === 2
    ? Buffer.from([0x00, 0x00])
    : Buffer.from([0x00]);
}

function txxxFrame(
  version: number,
  encoding: number,
  description: string,
  value: string,
): Buffer {
  const body = Buffer.concat([
    Buffer.from([encoding]),
    encodeId3String(description, encoding),
    id3Terminator(encoding),
    encodeId3String(value, encoding),
  ]);
  const size = version === 4 ? synchsafe(body.length) : uint32BE(body.length);
  return Buffer.concat([
    Buffer.from("TXXX", "latin1"),
    size,
    Buffer.from([0x00, 0x00]),
    body,
  ]);
}

function id3Tag(version: number, frames: Buffer[]): Buffer {
  const payload = Buffer.concat(frames);
  return Buffer.concat([
    Buffer.from("ID3", "latin1"),
    Buffer.from([version, 0x00, 0x00]),
    synchsafe(payload.length),
    payload,
  ]);
}

function vorbisCommentsPayload(
  comments: string[],
  framingBit = false,
): Buffer {
  const vendor = Buffer.from("MMPlayerTest", "utf8");
  const encoded = comments.map((c) => {
    const b = Buffer.from(c, "utf8");
    return Buffer.concat([uint32LE(b.length), b]);
  });
  return Buffer.concat([
    uint32LE(vendor.length),
    vendor,
    uint32LE(comments.length),
    ...encoded,
    framingBit ? Buffer.from([1]) : Buffer.alloc(0),
  ]);
}

function flacWithComments(comments: string[]): Buffer {
  const streamInfo = Buffer.alloc(34);
  const vc = vorbisCommentsPayload(comments);
  return Buffer.concat([
    Buffer.from("fLaC", "latin1"),
    Buffer.from([0x00, 0x00, 0x00, 34]),
    streamInfo,
    Buffer.from([
      0x84,
      (vc.length >>> 16) & 0xff,
      (vc.length >>> 8) & 0xff,
      vc.length & 0xff,
    ]),
    vc,
  ]);
}

function oggPage(packets: Buffer[], continued = false): Buffer {
  const lacing: number[] = [];
  for (const packet of packets) {
    let remaining = packet.length;
    while (remaining >= 255) {
      lacing.push(255);
      remaining -= 255;
    }
    lacing.push(remaining);
  }
  const header = Buffer.alloc(27);
  header.write("OggS", 0, "latin1");
  header[5] = continued ? 0x01 : 0x00;
  header[26] = lacing.length;
  return Buffer.concat([header, Buffer.from(lacing), ...packets]);
}

function oggStream(
  prefix: Buffer,
  comments: string[],
  framingBit: boolean,
  splitAfter?: number,
): Buffer {
  const packet = Buffer.concat([
    prefix,
    vorbisCommentsPayload(comments, framingBit),
  ]);
  if (splitAfter == null) {
    return oggPage([Buffer.from("head", "latin1"), packet]);
  }
  const alignedSplit = Math.max(255, Math.floor(splitAfter / 255) * 255);
  const first = packet.subarray(0, alignedSplit);
  const second = packet.subarray(alignedSplit);
  const firstLacing = new Array(first.length / 255).fill(255);
  const firstHeader = Buffer.alloc(27);
  firstHeader.write("OggS", 0, "latin1");
  firstHeader[5] = 0x00;
  firstHeader[26] = firstLacing.length;
  const page1 = Buffer.concat([
    firstHeader,
    Buffer.from(firstLacing),
    first,
  ]);
  return Buffer.concat([
    oggPage([Buffer.from("head", "latin1")]),
    page1,
    oggPage([second], true),
  ]);
}

function atom(type: string, payload: Buffer, extended = false): Buffer {
  const typeBytes = Buffer.from(type, "latin1");
  if (extended) {
    return Buffer.concat([
      uint32BE(1),
      typeBytes,
      uint64BE(BigInt(payload.length + 16)),
      payload,
    ]);
  }
  return Buffer.concat([uint32BE(payload.length + 8), typeBytes, payload]);
}

function freeformAtom(name: string, value: string, extended = false): Buffer {
  const mean = atom(
    "mean",
    Buffer.concat([
      Buffer.from([0, 0, 0, 0]),
      Buffer.from("com.apple.iTunes", "utf8"),
    ]),
  );
  const nameAtom = atom(
    "name",
    Buffer.concat([Buffer.from([0, 0, 0, 0]), Buffer.from(name, "utf8")]),
  );
  const dataAtom = atom(
    "data",
    Buffer.concat([
      Buffer.from([0, 0, 0, 1, 0, 0, 0, 0]),
      Buffer.from(value, "utf8"),
    ]),
    extended,
  );
  return atom("----", Buffer.concat([mean, nameAtom, dataAtom]), extended);
}

function m4aWithReplayGain(
  gain: string | null,
  peak: string | null,
  tailMoov = false,
  extended = false,
): Buffer {
  const items: Buffer[] = [];
  if (gain != null)
    items.push(freeformAtom("replaygain_track_gain", gain, extended));
  if (peak != null)
    items.push(freeformAtom("replaygain_track_peak", peak, extended));
  const ilst = atom("ilst", Buffer.concat(items), extended);
  const meta = atom(
    "meta",
    Buffer.concat([Buffer.from([0, 0, 0, 0]), ilst]),
    extended,
  );
  const udta = atom("udta", meta, extended);
  const moov = atom("moov", udta, extended);
  const ftyp = atom("ftyp", Buffer.from("M4A \x00\x00\x00\x00", "latin1"));
  const mdat = atom("mdat", Buffer.alloc(128));
  return tailMoov
    ? Buffer.concat([ftyp, mdat, moov])
    : Buffer.concat([ftyp, moov, mdat]);
}

test("ReplayGainScanCache: first scan reads every file and reuses gain, peak, and absent tags, and invalidates on file change or incomplete tag", async () => {
  const dir = await mkdtemp(join(tempRoot, "rg-cache-"));
  try {
    const f1 = join(dir, "a.mp3");
    const f2 = join(dir, "b.flac");
    const f3 = join(dir, "c.ogg");
    const f4 = join(dir, "d.mp3");

    await writeFile(
      f1,
      id3Tag(4, [
        txxxFrame(4, 3, "replaygain_track_gain", "-6.5 dB"),
        txxxFrame(4, 3, "replaygain_track_peak", "0.92"),
      ]),
    );
    await writeFile(f2, flacWithComments(["REPLAYGAIN_TRACK_GAIN=+2.25 dB"]));
    await writeFile(
      f3,
      oggStream(
        Buffer.from([0x03, ...Buffer.from("vorbis", "latin1")]),
        ["REPLAYGAIN_TRACK_PEAK=0.80"],
        true,
      ),
    );
    await writeFile(f4, id3Tag(4, [txxxFrame(4, 3, "OTHER_TAG", "noop")]));

    const reads = new Map<string, number>();
    const store = new Map<string, string>();
    const cache = new ReplayGainScanCache(
      (k: string) => store.get(k) ?? null,
      (k: string, v: string) => {
        store.set(k, v);
      },
      async (p: string) => {
        reads.set(p, (reads.get(p) ?? 0) + 1);
        return readReplayGainTags(p);
      },
    );

    const r1 = await cache.read(f1);
    assert.ok(Math.abs((r1.gain ?? 0) - -6.5) < 0.0001);
    assert.ok(Math.abs((r1.peak ?? 0) - 0.92) < 0.0001);
    assert.equal(reads.get(f1), 1);

    const r2 = await cache.read(f2);
    assert.ok(Math.abs((r2.gain ?? 0) - 2.25) < 0.0001);
    assert.equal(r2.peak, null);
    assert.equal(reads.get(f2), 1);

    const r3 = await cache.read(f3);
    assert.equal(r3.gain, null);
    assert.ok(Math.abs((r3.peak ?? 0) - 0.8) < 0.0001);
    assert.equal(reads.get(f3), 1);

    const r4 = await cache.read(f4);
    assert.equal(r4.gain, null);
    assert.equal(r4.peak, null);
    assert.equal(reads.get(f4), 1);

    // Second scan reuses cached values without rereading files
    for (const f of [f1, f2, f3, f4]) {
      await cache.read(f);
      assert.equal(reads.get(f), 1);
    }

    // Old parser version or corrupt cache entry triggers replacement read
    store.set(f1, "0|100|200|-1.0|0.5");
    await cache.read(f1);
    assert.equal(reads.get(f1), 2);

    store.set(f1, "corrupt-entry");
    await cache.read(f1);
    assert.equal(reads.get(f1), 3);

    // Incomplete file ("ID3") is retried instead of cached as tag-free
    const partial = join(dir, "partial.mp3");
    await writeFile(partial, Buffer.from("ID3", "latin1"));
    const partialRes = await cache.read(partial);
    assert.equal(partialRes.gain, null);
    assert.equal(partialRes.peak, null);
    assert.equal(store.has(partial), false);

    await writeFile(
      partial,
      id3Tag(4, [
        txxxFrame(4, 3, "replaygain_track_gain", "-5.25 dB"),
        txxxFrame(4, 3, "replaygain_track_peak", "0.84"),
      ]),
    );
    const completedRes = await cache.read(partial);
    assert.ok(Math.abs((completedRes.gain ?? 0) - -5.25) < 0.0001);
    assert.ok(Math.abs((completedRes.peak ?? 0) - 0.84) < 0.0001);
    assert.equal(store.has(partial), true);
  } finally {
    await cleanup(dir);
  }
});

test("ReplayGainReader: parses ID3v2.3/2.4, FLAC, Ogg Vorbis/Opus, and M4A gain & peak across all encodings and edge cases", () => {
  // ID3v2.3 & ID3v2.4 across encodings 0..3 and peakFirst false/true
  for (const version of [3, 4]) {
    for (const encoding of [0, 1, 2, 3]) {
      for (const peakFirst of [false, true]) {
        const gainFrame = txxxFrame(
          version,
          encoding,
          "REPLAYGAIN_TRACK_GAIN",
          "-7.35 dB",
        );
        const peakFrame = txxxFrame(
          version,
          encoding,
          "REPLAYGAIN_TRACK_PEAK",
          "0.912345",
        );
        const frames = peakFirst
          ? [peakFrame, gainFrame]
          : [gainFrame, peakFrame];
        const parsed = readReplayGainFromBuffer(id3Tag(version, frames));
        assert.ok(Math.abs((parsed.gain ?? 0) - -7.35) < 0.0001);
        assert.ok(Math.abs((parsed.peak ?? 0) - 0.912345) < 0.000001);
        assert.equal(parsed.readSucceeded, true);
      }
    }
  }

  // FLAC Vorbis comments
  const flacParsed = readReplayGainFromBuffer(
    flacWithComments([
      "TITLE=Test",
      "REPLAYGAIN_TRACK_GAIN=+3.25 dB",
      "REPLAYGAIN_TRACK_PEAK=0.875",
    ]),
  );
  assert.ok(Math.abs((flacParsed.gain ?? 0) - 3.25) < 0.0001);
  assert.ok(Math.abs((flacParsed.peak ?? 0) - 0.875) < 0.0001);

  // Ogg Vorbis & Opus reassemble comments spanning pages
  const vorbisSplit = readReplayGainFromBuffer(
    oggStream(
      Buffer.from([0x03, ...Buffer.from("vorbis", "latin1")]),
      [
        "PADDING=" + "x".repeat(300),
        "REPLAYGAIN_TRACK_PEAK=0.901",
        "REPLAYGAIN_TRACK_GAIN=-4.50 dB",
      ],
      true,
      120,
    ),
  );
  assert.ok(Math.abs((vorbisSplit.gain ?? 0) - -4.5) < 0.0001);
  assert.ok(Math.abs((vorbisSplit.peak ?? 0) - 0.901) < 0.0001);

  const opusSplit = readReplayGainFromBuffer(
    oggStream(
      Buffer.from("OpusTags", "latin1"),
      [
        "PADDING=" + "y".repeat(300),
        "REPLAYGAIN_TRACK_GAIN=-2.00 dB",
        "REPLAYGAIN_TRACK_PEAK=0.777",
      ],
      false,
      90,
    ),
  );
  assert.ok(Math.abs((opusSplit.gain ?? 0) - -2.0) < 0.0001);
  assert.ok(Math.abs((opusSplit.peak ?? 0) - 0.777) < 0.0001);

  // M4A freeform atoms (head/tail moov, standard/extended 64-bit sizes)
  for (const tailMoov of [false, true]) {
    for (const extended of [false, true]) {
      const m4aParsed = readReplayGainFromBuffer(
        m4aWithReplayGain("-6.12 dB", "0.9654", tailMoov, extended),
      );
      assert.ok(Math.abs((m4aParsed.gain ?? 0) - -6.12) < 0.0001);
      assert.ok(Math.abs((m4aParsed.peak ?? 0) - 0.9654) < 0.0001);
    }
  }

  // Peak-only metadata and peaks above unity
  const peakOnly = readReplayGainFromBuffer(
    id3Tag(4, [txxxFrame(4, 3, "replaygain_track_peak", "1.18")]),
  );
  assert.equal(peakOnly.gain, null);
  assert.ok(Math.abs((peakOnly.peak ?? 0) - 1.18) < 0.0001);

  // Invalid / non-finite / negative peak rejected
  for (const invalid of ["NaN", "Infinity", "-Infinity", "abc", ""]) {
    const res = readReplayGainFromBuffer(
      id3Tag(4, [
        txxxFrame(4, 3, "replaygain_track_gain", invalid),
        txxxFrame(4, 3, "replaygain_track_peak", invalid),
      ]),
    );
    assert.equal(res.gain, null);
    assert.equal(res.peak, null);
  }
  for (const badPeak of ["0", "-0.5"]) {
    const res = readReplayGainFromBuffer(
      id3Tag(4, [txxxFrame(4, 3, "replaygain_track_peak", badPeak)]),
    );
    assert.equal(res.peak, null);
  }
});

test("ReplayGainMath & DesktopPlayer: gain amplification, attenuation, peak limiting, missing peaks, PCM clamping, and track transitions", () => {
  // Positive gain amplifies quiet audio
  const ampMult = calculateReplayGainMultiplier(true, 6.0, 0.4, 0.0, 0.0);
  assert.ok(Math.abs(ampMult - Math.pow(10, 6 / 20)) < 0.0005);

  const quietPcm = processReplayGainPcm16(
    new Int16Array([4000, -4000]),
    ampMult,
  );
  assert.ok(Math.abs(quietPcm[0] - 7981) <= 2);
  assert.ok(Math.abs(quietPcm[1] - -7981) <= 2);

  // Negative gain attenuates loud audio
  const attenMult = calculateReplayGainMultiplier(true, -6.0, 1.0, 0.0, 0.0);
  assert.ok(Math.abs(attenMult - Math.pow(10, -6 / 20)) < 0.0005);

  // Gain + preamp is peak-limited so normalized audio never exceeds full scale
  const limitedMult = calculateReplayGainMultiplier(true, 8.0, 0.8, 4.0, 0.0);
  assert.ok(Math.abs(limitedMult - 1.25) < 0.0001);
  const peakSamples = processReplayGainPcm16(
    new Int16Array([26214, -26214]),
    limitedMult,
  );
  assert.ok(Math.abs(peakSamples[0]) <= 32767);
  assert.ok(Math.abs(peakSamples[1]) <= 32768);

  // Peaks above full scale are attenuated even when net gain is negative
  const clippedPeakMult = calculateReplayGainMultiplier(
    true,
    -1.0,
    1.25,
    0.0,
    0.0,
  );
  assert.ok(Math.abs(clippedPeakMult - 0.8) < 0.0001);

  // Missing peaks prevent unverified boosts while preserving attenuation
  assert.equal(calculateReplayGainMultiplier(true, 6.0, null, 3.0, 4.0), 1.0);
  assert.ok(
    Math.abs(
      calculateReplayGainMultiplier(true, -6.0, null, 0.0, 0.0) -
        Math.pow(10, -6 / 20),
    ) < 0.0005,
  );

  // Disabled normalization leaves audio bit-exact
  const original = new Int16Array([0, 1, -1, 12345, -23456, 32767, -32768]);
  const disabledMult = calculateReplayGainMultiplier(
    false,
    -12.0,
    0.5,
    -6.0,
    -6.0,
  );
  assert.equal(disabledMult, 1.0);
  const copy = processReplayGainPcm16(original, disabledMult);
  assert.deepEqual(copy, original);

  // Extreme amplification clamps to 16-bit PCM bounds without integer wraparound
  const extreme = processReplayGainPcm16(
    new Int16Array([30000, -30000]),
    4.0,
  );
  assert.equal(extreme[0], 32767);
  assert.equal(extreme[1], -32768);
});

test("EqualizerService + DesktopPlayer: 6-band WebAudio EQ, touch slider conversion, bass boost, playback state reattachment, and hydration", async () => {
  installFakeBrowserAudioEnvironment();

  assert.equal(await initializeEqualizer(0), true);
  assert.equal(await getEqualizerNumberOfBands(), 6);
  assert.deepEqual(await getEqualizerBandFrequencies(), [
    60, 170, 350, 1000, 3500, 10000,
  ]);
  const range = await getEqualizerBandLevelRange();
  assert.deepEqual(range, {
    min: -1500,
    max: 1500,
  });

  useSettingsStore.setState({
    isEqualizerEnabled: true,
    equalizerBands: [0, 0, 0, 0, 0, 0],
    bassBoostStrength: 0,
  });
  await EqualizerService.initialize();

  // Moving every frequency band control applies the expected level to settings and DesktopPlayer
  const touchPositions = [0, 45, 75, 90, 135, 180];
  const expectedLevels = [1500, 750, 250, 0, -750, -1500];
  for (let idx = 0; idx < touchPositions.length; idx++) {
    await changeEqualizerBandFromTouch(idx, touchPositions[idx], 180, range);
  }
  assert.deepEqual(useSettingsStore.getState().equalizerBands, expectedLevels);
  assert.deepEqual(
    player.getAudioSettingsSnapshot().eqGains,
    expectedLevels.map((mb) => mb / 100),
  );

  // Clamping gestures outside track and ignoring invalid height / NaN
  await changeEqualizerBandFromTouch(0, -50, 180, range);
  await changeEqualizerBandFromTouch(1, 260, 180, range);
  await changeEqualizerBandFromTouch(2, 40, 0, range);
  await changeEqualizerBandFromTouch(3, Number.NaN, 180, range);
  assert.equal(player.getAudioSettingsSnapshot().eqGains[0], 15);
  assert.equal(player.getAudioSettingsSnapshot().eqGains[1], -15);

  // Bass boost clamps to 0..1000 and updates DesktopPlayer
  await EqualizerService.setBassBoost(650);
  assert.equal(useSettingsStore.getState().bassBoostStrength, 650);
  assert.equal(player.getAudioSettingsSnapshot().bassBoostStrength, 650);

  await EqualizerService.setBassBoost(1500);
  assert.equal(useSettingsStore.getState().bassBoostStrength, 1000);
  assert.equal(player.getAudioSettingsSnapshot().bassBoostStrength, 1000);

  await EqualizerService.setBassBoost(-200);
  assert.equal(useSettingsStore.getState().bassBoostStrength, 0);
  assert.equal(player.getAudioSettingsSnapshot().bassBoostStrength, 0);

  // Event.PlaybackState and Event.PlaybackActiveTrackChanged reattach saved effects
  useSettingsStore.setState({
    isEqualizerEnabled: true,
    equalizerBands: [500, 300, 0, -200, 400, 600],
    bassBoostStrength: 700,
  });
  const unsub = EqualizerService.subscribeToPlayback();
  await TrackPlayer.add([
    {
      id: "eq-track-1",
      url: "C:/music/eq1.mp3",
      title: "EQ Track 1",
      artist: "Artist",
      duration: 120,
    },
  ]);
  await TrackPlayer.play(true);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(player.getAudioSettingsSnapshot().eqEnabled, true);
  assert.deepEqual(player.getAudioSettingsSnapshot().eqGains, [
    5, 3, 0, -2, 4, 6,
  ]);
  assert.equal(player.getAudioSettingsSnapshot().bassBoostStrength, 700);
  unsub();

  // Disabling EQ sets eqEnabled=false while preserving configured levels
  await EqualizerService.setEnabled(false);
  assert.equal(useSettingsStore.getState().isEqualizerEnabled, false);
  assert.equal(player.getAudioSettingsSnapshot().eqEnabled, false);
  assert.equal(await releaseEqualizer(), true);
});

test("ReplayGainService + ScannerService: syncs settings to DesktopPlayer and runs deep ReplayGain scan with batch DB updates", async () => {
  installFakeBrowserAudioEnvironment();

  useSettingsStore.setState({
    isNormalizationEnabled: true,
    preampLevel: 1.5,
    fallbackGainDB: -3.5,
  });
  await initializeReplayGain();
  assert.equal(player.getAudioSettingsSnapshot().replayGainEnabled, true);
  assert.equal(player.getAudioSettingsSnapshot().replayGainPreamp, 1.5);
  assert.equal(player.getAudioSettingsSnapshot().replayGainFallback, -3.5);

  // Load tracks with and without ReplayGain metadata in DesktopPlayer
  const state = emptyPlayer();
  state.queues[0].trackIds = ["rg-1", "rg-2"];
  player.initialize(state, [
    {
      id: "rg-1",
      title: "Tagged Loud",
      artist: "Artist",
      album: "Album",
      albumId: "alb-1",
      artistId: "art-1",
      genre: "Pop",
      duration: 180,
      trackNumber: 1,
      discNumber: 1,
      year: 2024,
      isFavorite: false,
      lyricsLRC: null,
      skipSegments: null,
      filePath: "C:/music/rg1.mp3",
      fileUrl: "mmplayer-media://track/rg-1",
      folderPath: "C:/music",
      folderName: "music",
      cover: null,
      rating: 0,
      playCount: 0,
      skipCount: 0,
      lastPlayed: null,
      dateAdded: 1,
      mtimeMs: 1,
      size: 1000,
      available: true,
      replayGain: -7.5,
      replayPeak: 0.95,
    } as unknown as LibraryTrack,
    {
      id: "rg-2",
      title: "Untagged",
      artist: "Artist",
      album: "Album",
      albumId: "alb-1",
      artistId: "art-1",
      genre: "Pop",
      duration: 180,
      trackNumber: 2,
      discNumber: 1,
      year: 2024,
      isFavorite: false,
      lyricsLRC: null,
      skipSegments: null,
      filePath: "C:/music/rg2.mp3",
      fileUrl: "mmplayer-media://track/rg-2",
      folderPath: "C:/music",
      folderName: "music",
      cover: null,
      rating: 0,
      playCount: 0,
      skipCount: 0,
      lastPlayed: null,
      dateAdded: 1,
      mtimeMs: 1,
      size: 1000,
      available: true,
      replayGain: null,
      replayPeak: null,
    } as unknown as LibraryTrack,
  ]);

  const expectedTaggedMult = calculateReplayGainMultiplier(
    true,
    -7.5,
    0.95,
    1.5,
    -3.5,
  );
  assert.ok(
    Math.abs(
      player.getAudioSettingsSnapshot().replayGainMultiplier -
        expectedTaggedMult,
    ) < 0.0001,
  );

  await TrackPlayer.skipToNext();
  const expectedUntaggedMult = calculateReplayGainMultiplier(
    true,
    null,
    null,
    1.5,
    -3.5,
  );
  assert.ok(
    Math.abs(
      player.getAudioSettingsSnapshot().replayGainMultiplier -
        expectedUntaggedMult,
    ) < 0.0001,
  );

  useSettingsStore.setState({
    isNormalizationEnabled: false,
    preampLevel: -2.0,
    fallbackGainDB: -4.0,
  });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(player.getAudioSettingsSnapshot().replayGainEnabled, false);
  assert.equal(player.getAudioSettingsSnapshot().replayGainPreamp, -2.0);
  assert.equal(player.getAudioSettingsSnapshot().replayGainFallback, -4.0);
  assert.equal(player.getAudioSettingsSnapshot().replayGainMultiplier, 1.0);

  // ScannerService.runDeepReplayGainScan updates tracks missing replay_gain or replay_peak via IPC readReplayGain
  const rgDir = await temporary();
  const rgWorker = new LibraryWorkerClient(
    resolve("build/libraryWorker.cjs"),
    rgDir,
    () => {},
  );
  const g = globalThis as Record<string, unknown>;
  const prevInvoke = (g.window as { mmplayer: { invoke: unknown } }).mmplayer
    .invoke;
  (
    g.window as {
      mmplayer: {
        invoke: (cmd: string, payload?: unknown) => Promise<unknown>;
      };
    }
  ).mmplayer.invoke = async (cmd: string, payload?: unknown) => {
    if (cmd === "readReplayGain") {
      const { uri } = payload as { uri: string };
      if (uri.includes("scan1.mp3")) return { gain: -6.25, peak: 0.88 };
      if (uri.includes("scan2.flac")) return { gain: -5.0, peak: 0.91 };
    }
    return rgWorker.request(cmd, payload);
  };

  try {
    await rgWorker.request("initialize");
    const tracksColl = database.get<Track>("tracks");
    let tr1!: Track;
    let tr2!: Track;
    await database.write(async () => {
      tr1 = await tracksColl.create((t: Track) => {
        t.title = "Needs Scan 1";
        t.fileUrl = "C:/music/scan1.mp3";
        t.replayGain = null;
        t.replayPeak = null;
      });
      tr2 = await tracksColl.create((t: Track) => {
        t.title = "Needs Peak Only";
        t.fileUrl = "C:/music/scan2.flac";
        t.replayGain = -5.0;
        t.replayPeak = null;
      });
    });

    const progressCalls: Array<[number, number]> = [];
    const updatedCount = await ScannerService.runDeepReplayGainScan((c, tot) =>
      progressCalls.push([c, tot]),
    );
    assert.equal(updatedCount, 2);
    assert.ok(progressCalls.length > 0);
    const updated1 = await tracksColl.find(tr1.id);
    const updated2 = await tracksColl.find(tr2.id);
    assert.equal(updated1.replayGain, -6.25);
    assert.equal(updated1.replayPeak, 0.88);
    assert.equal(updated2.replayGain, -5.0);
    assert.equal(updated2.replayPeak, 0.91);

    // Second run returns 0 because all tracks now have both gain and peak
    const secondRun = await ScannerService.runDeepReplayGainScan();
    assert.equal(secondRun, 0);
  } finally {
    (g.window as { mmplayer: { invoke: unknown } }).mmplayer.invoke =
      prevInvoke;
    await rgWorker.close();
    await cleanup(rgDir);
  }
});

test("CrossfadePolicy + CrossfadeService + DesktopPlayer: policy guards, suspension across Cast/lyrics/switching/A-B, and dual-deck crossfade", async () => {
  installFakeBrowserAudioEnvironment();

  assert.equal(normalizeCrossfadeSeconds(Number.NaN), 0);
  assert.equal(normalizeCrossfadeSeconds(-4), 0);
  assert.equal(normalizeCrossfadeSeconds(5.6), 6);
  assert.equal(normalizeCrossfadeSeconds(25), 12);

  const basePolicyInput = {
    seconds: 6,
    casting: false,
    switchingQueue: false,
    restoring: false,
    syncingLyrics: false,
    hasABPoint: false,
    blocked: false,
  };
  assert.deepEqual(getCrossfadePolicy(basePolicyInput), {
    seconds: 6,
    allowed: true,
  });

  for (const override of [
    { casting: true },
    { switchingQueue: true },
    { restoring: true },
    { syncingLyrics: true },
    { hasABPoint: true },
    { blocked: true },
  ]) {
    assert.deepEqual(getCrossfadePolicy({ ...basePolicyInput, ...override }), {
      seconds: 6,
      allowed: false,
    });
  }

  // CrossfadeService synchronization with DesktopPlayer
  useSettingsStore.setState({ crossfadeSeconds: 6 });
  useCastStore.setState({
    isServerRunning: false,
    isLocalCastActive: false,
    isChromecastConnected: false,
  });
  useMultipleQueuesStore.setState({ isSwitching: false });
  usePlayerStore.setState({
    isRestoring: false,
    isSyncingLyrics: false,
    activeTrack: { id: "cf-1", title: "T1", artist: "A", duration: 180 },
  });
  useABRepeatStore.setState({ pointA: null, pointB: null });

  await initializeCrossfade();
  assert.equal(player.getAudioSettingsSnapshot().crossfadeSeconds, 6);
  assert.equal(player.getAudioSettingsSnapshot().crossfadeAllowed, true);

  // Blocking and nested barriers
  const releaseA = await CrossfadeService.block();
  const releaseB = await CrossfadeService.block();
  assert.equal(player.getAudioSettingsSnapshot().crossfadeAllowed, false);

  releaseA();
  await CrossfadeService.flush();
  assert.equal(player.getAudioSettingsSnapshot().crossfadeAllowed, false);

  releaseB();
  await CrossfadeService.flush();
  assert.equal(player.getAudioSettingsSnapshot().crossfadeAllowed, true);

  // Suspending on Cast, Lyrics Sync, Queue Switch, and A-B Repeat
  useCastStore.setState({ isLocalCastActive: true });
  await CrossfadeService.flush();
  assert.equal(player.getAudioSettingsSnapshot().crossfadeAllowed, false);
  useCastStore.setState({ isLocalCastActive: false });

  usePlayerStore.setState({ isSyncingLyrics: true });
  await CrossfadeService.flush();
  assert.equal(player.getAudioSettingsSnapshot().crossfadeAllowed, false);
  usePlayerStore.setState({ isSyncingLyrics: false });

  useABRepeatStore.getState().setPointA(12);
  await CrossfadeService.flush();
  assert.equal(player.getAudioSettingsSnapshot().crossfadeAllowed, false);
  useABRepeatStore.getState().clearAB();
  await CrossfadeService.flush();
  assert.equal(player.getAudioSettingsSnapshot().crossfadeAllowed, true);
});

test("TrackPlayer Smooth Play/Pause Fade: 400ms fade-out/in, logical pause state during fade, mid-fade resume, and bypassFade", async () => {
  installFakeBrowserAudioEnvironment();

  player.setFadeEnabledProvider(() => useSettingsStore.getState().isFadeEnabled);
  useSettingsStore.setState({ isFadeEnabled: true });

  await TrackPlayer.setQueue([
    {
      id: "fade-1",
      url: "C:/music/fade1.mp3",
      title: "Fade Song",
      artist: "Artist",
      duration: 200,
    },
  ]);
  await TrackPlayer.setVolume(0.8);

  // Play starts fade-in to target volume
  await TrackPlayer.play();
  assert.equal(getIsFadingOut(), false);
  const playingState = await TrackPlayer.getPlaybackState();
  assert.equal(playingState.state, State.Playing);

  // Pause with fade enabled immediately marks getIsFadingOut()=true and State.Paused while ramping down over 400ms
  const pausePromise = TrackPlayer.pause();
  assert.equal(getIsFadingOut(), true);
  const midFadeState = await TrackPlayer.getPlaybackState();
  assert.equal(midFadeState.state, State.Paused);
  await pausePromise;
  assert.equal(getIsFadingOut(), false);
  assert.equal(await TrackPlayer.getVolume(), 0.8);

  // Calling play() mid-fade cancels pause fade and keeps playing
  await TrackPlayer.play(true);
  const interruptedPause = TrackPlayer.pause();
  assert.equal(getIsFadingOut(), true);
  await TrackPlayer.play();
  await interruptedPause;
  assert.equal(getIsFadingOut(), false);
  assert.equal((await TrackPlayer.getPlaybackState()).state, State.Playing);

  // bypassFade=true pauses immediately without fade
  await TrackPlayer.pause(true);
  assert.equal(getIsFadingOut(), false);
  assert.equal((await TrackPlayer.getPlaybackState()).state, State.Paused);
});

test("PlayerStore Speed, Independent Pitch, and Vinyl Mode parity", async () => {
  installFakeBrowserAudioEnvironment();

  assert.ok(Math.abs(semitonesToPitch(12) - 2.0) < 0.0001);
  assert.ok(Math.abs(semitonesToPitch(-12) - 0.5) < 0.0001);
  assert.equal(pitchToSemitones(2.0), 12);
  assert.equal(pitchToSemitones(0.5), -12);
  assert.equal(pitchToSemitones(1.0), 0);

  await usePlayerStore.getState().setVinylModeEnabled(false);
  await usePlayerStore.getState().setPlaybackSpeed(1.25);
  await usePlayerStore.getState().setPlaybackPitch(semitonesToPitch(3));

  assert.equal(usePlayerStore.getState().playbackSpeed, 1.25);
  assert.equal(pitchToSemitones(usePlayerStore.getState().playbackPitch), 3);
  assert.equal(player.getAudioSettingsSnapshot().speed, 1.25);
  assert.ok(
    Math.abs(player.getAudioSettingsSnapshot().pitch - semitonesToPitch(3)) <
      0.0001,
  );
  assert.equal(player.getAudioSettingsSnapshot().vinylMode, false);

  // Enabling Vinyl Mode links pitch to playbackSpeed
  await usePlayerStore.getState().setVinylModeEnabled(true);
  assert.equal(usePlayerStore.getState().isVinylModeEnabled, true);
  assert.equal(usePlayerStore.getState().playbackPitch, 1.25);
  assert.equal(player.getAudioSettingsSnapshot().vinylMode, true);
});

test("Visualizer colors and WebAudio AnalyserNode provisioning", () => {
  installFakeBrowserAudioEnvironment();

  assert.equal(resolveVisualizerColor("cover", "#1DB954", "#123456"), "cover");
  assert.equal(
    resolveVisualizerColor("rainbow", "#1DB954", "#123456"),
    "rainbow",
  );
  assert.equal(
    resolveVisualizerColor("accent", "#1DB954", "#123456"),
    "#1DB954",
  );
  assert.equal(
    resolveVisualizerColor("custom", "#1DB954", "#abcdef"),
    "#ABCDEF",
  );

  // Brighten dark cover color for visualizer contrast
  const brightened = brightenCoverColorForVisualizer("#1a0d05");
  assert.match(brightened, /^#[0-9a-f]{6}$/i);
  assert.notEqual(brightened.toLowerCase(), "#1a0d05");

  const analyser = player.getAnalyser();
  assert.ok(analyser, "DesktopPlayer should provision a WebAudio AnalyserNode");
  assert.equal(TrackPlayerEvent.PlaybackState, "state");
});

// ============================================================================
// MOBILE PARITY TESTS: QUEUES, SHUFFLE, AUTOPLAY & HISTORY/TAGS (SECTIONS 1.2 & 1.3)
// ============================================================================
import { ShuffleService } from "../../../src/services/ShuffleService";
import { HistoryService } from "../../../src/services/HistoryService";
import { ActivityChartsService } from "../../../src/services/ActivityChartsService";
import {
  PlaybackListenService,
  evaluateListenDuration,
} from "../../../src/services/PlaybackListenService";
import { PlaybackTagSnapshotService } from "../../../src/services/PlaybackTagSnapshotService";
import { useToastStore } from "../../../src/store/useToastStore";
import {
  consumeUserQueueTransition,
  applyNativeManualQueueSize,
} from "../src/renderer/ports/playerStore";
import type Album from "../../../src/database/models/Album";
import type PlaybackHistory from "../../../src/database/models/PlaybackHistory";
import type PlaybackHistoryTag from "../../../src/database/models/PlaybackHistoryTag";
import type AlbumTag from "../../../src/database/models/AlbumTag";
import { Q } from "@nozbe/watermelondb";
import { getChartTotals } from "../../../src/utils/activityCharts";

function makeLibraryTrack(
  id: string,
  overrides: Partial<LibraryTrack> = {},
): LibraryTrack {
  return {
    id,
    title: `Title ${id}`,
    artist: "Artist",
    artistId: "art-1",
    album: "Album",
    albumId: "alb-1",
    duration: 180,
    cover: null,
    fileUrl: `mmplayer-media://track/${id}`,
    available: true,
    isFavorite: false,
    rating: null,
    genre: "Rock",
    year: 2025,
    lyricsLRC: null,
    skipSegments: null,
    trackNumber: 1,
    discNumber: 1,
    replayGain: null,
    replayPeak: null,
    isExcludedFromShuffle: false,
    ...overrides,
  };
}

test("Section 1.2: Shuffle toggle saves original queue order, excludes shuffle-excluded tracks, and restores original order when untoggled", async () => {
  installFakeBrowserAudioEnvironment();

  const tracks = [
    makeLibraryTrack("s1"),
    makeLibraryTrack("s2"),
    makeLibraryTrack("s3"),
    makeLibraryTrack("s4"),
    makeLibraryTrack("s-excluded", { isExcludedFromShuffle: true }),
    makeLibraryTrack("s-blacklisted", {
      fileUrl: "mmplayer-media://track/blacklisted",
    }),
  ];

  useSettingsStore.setState({
    excludedSongs: ["mmplayer-media://track/blacklisted"],
  });

  const state = emptyPlayer();
  state.queues[0].trackIds = tracks.map((t) => t.id);
  state.queues[0].index = 1; // Currently playing s2
  player.initialize(state, tracks);
  usePlayerStore.setState({
    isShuffleEnabled: false,
    isShuffling: false,
    shuffleOriginalQueue: [],
  });

  // Enable shuffle via usePlayerStore.toggleShuffle()
  await usePlayerStore.getState().toggleShuffle();

  const shuffledSnap = player.getSnapshot();
  const shuffledQueue = shuffledSnap.queues[shuffledSnap.activeQueue];
  assert.equal(shuffledQueue.shuffle, true);
  assert.equal(usePlayerStore.getState().isShuffleEnabled, true);
  // Active track s2 remains at index 0
  assert.equal(shuffledQueue.index, 0);
  assert.equal(shuffledQueue.trackIds[0], "s2");
  // Original trackIds are preserved in shuffleOriginalTrackIds
  assert.deepEqual(
    shuffledQueue.shuffleOriginalTrackIds,
    tracks.map((t) => t.id),
  );
  // Excluded tracks (s-excluded and s-blacklisted) are filtered out of shuffled upcoming tracks
  assert.ok(!shuffledQueue.trackIds.includes("s-excluded"));
  assert.ok(!shuffledQueue.trackIds.includes("s-blacklisted"));
  assert.equal(shuffledQueue.trackIds.length, 4); // s2 + s1, s3, s4

  // Disable shuffle: restores original queue order relative to current track s2 -> [s2, s3, s4, s-excluded, s-blacklisted, s1]
  await usePlayerStore.getState().toggleShuffle();

  const restoredSnap = player.getSnapshot();
  const restoredQueue = restoredSnap.queues[restoredSnap.activeQueue];
  assert.equal(restoredQueue.shuffle, false);
  assert.equal(usePlayerStore.getState().isShuffleEnabled, false);
  assert.equal(restoredQueue.index, 0);
  assert.deepEqual(restoredQueue.trackIds, [
    "s2",
    "s3",
    "s4",
    "s-excluded",
    "s-blacklisted",
    "s1",
  ]);
  assert.deepEqual(restoredQueue.shuffleOriginalTrackIds, []);

  useSettingsStore.setState({ excludedSongs: [] });
});

test("Section 1.2: queueAddBehavior controls addToQueueEnd and addMultipleToQueueEnd (user_queue vs context_queue)", async () => {
  installFakeBrowserAudioEnvironment();

  const tracks = [
    makeLibraryTrack("q1"),
    makeLibraryTrack("q2"),
    makeLibraryTrack("q3"),
    makeLibraryTrack("u1"),
    makeLibraryTrack("u2"),
    makeLibraryTrack("c1"),
  ];

  const g = globalThis as Record<string, unknown>;
  const prevInvoke = (g.window as { mmplayer: { invoke: unknown } }).mmplayer
    .invoke;
  (
    g.window as {
      mmplayer: { invoke: (cmd: string) => Promise<unknown> };
    }
  ).mmplayer.invoke = async (cmd: string) => {
    if (cmd === "library") {
      return {
        tracks,
        albums: [],
        artists: [],
        playlists: [],
        tags: [],
      };
    }
    return undefined;
  };

  try {
    const state = emptyPlayer();
    state.queues[0].trackIds = ["q1", "q2", "q3"];
    state.queues[0].index = 0; // Playing q1, context upcoming: q2, q3
    player.initialize(state, tracks);

    // 1. queueAddBehavior = "user_queue"
    useSettingsStore.setState({ queueAddBehavior: "user_queue" });
    await usePlayerStore.getState().addToQueueEnd({ id: "u1" } as Track);
    await usePlayerStore.getState().addMultipleToQueueEnd([
      { id: "u2" } as Track,
    ]);

    let entries = player.getQueueTracks();
    // u1 and u2 should be inserted right after active track q1 (before context tracks q2, q3) and marked isManual = true
    assert.deepEqual(
      entries.map((e) => e.libraryId),
      ["q1", "u1", "u2", "q2", "q3"],
    );
    assert.equal(entries[1].isManual, true);
    assert.equal(entries[2].isManual, true);
    assert.equal(entries[3].isManual, false);
    assert.equal(entries[4].isManual, false);
    assert.equal(usePlayerStore.getState().userQueueSize, 2);

    // 2. queueAddBehavior = "context_queue"
    useSettingsStore.setState({ queueAddBehavior: "context_queue" });
    await usePlayerStore.getState().addToQueueEnd({ id: "c1" } as Track);

    entries = player.getQueueTracks();
    // c1 should be appended at the very end of the context queue and marked isManual = false
    assert.deepEqual(
      entries.map((e) => e.libraryId),
      ["q1", "u1", "u2", "q2", "q3", "c1"],
    );
    assert.equal(entries[5].isManual, false);
    assert.equal(
      usePlayerStore.getState().userQueueSize,
      2,
      "adding to context_queue must not inflate userQueueSize",
    );

    // clearUserQueue removes only manual tracks (u1, u2)
    await usePlayerStore.getState().clearUserQueue();
    entries = player.getQueueTracks();
    assert.deepEqual(
      entries.map((e) => e.libraryId),
      ["q1", "q2", "q3", "c1"],
    );
    assert.equal(usePlayerStore.getState().userQueueSize, 0);

    // clearContextQueue removes non-manual tracks after active index
    await usePlayerStore.getState().addToQueueNext({ id: "u1" } as Track);
    await usePlayerStore.getState().clearContextQueue();
    entries = player.getQueueTracks();
    assert.deepEqual(
      entries.map((e) => e.libraryId),
      ["q1", "u1"],
    );
  } finally {
    (g.window as { mmplayer: { invoke: unknown } }).mmplayer.invoke =
      prevInvoke;
  }
});

test("Section 1.2: shuffleOnEnd triggers ShuffleService random autoplay when queue finishes or skipToNext is called at end", async () => {
  installFakeBrowserAudioEnvironment();

  const tracks = [
    makeLibraryTrack("end1"),
    makeLibraryTrack("end2"),
    makeLibraryTrack("elig1"),
    makeLibraryTrack("elig2"),
  ];

  const g = globalThis as Record<string, unknown>;
  const prevInvoke = (g.window as { mmplayer: { invoke: unknown } }).mmplayer
    .invoke;
  (
    g.window as {
      mmplayer: { invoke: (cmd: string) => Promise<unknown> };
    }
  ).mmplayer.invoke = async (cmd: string) => {
    if (cmd === "library") {
      return {
        tracks,
        albums: [],
        artists: [],
        playlists: [],
        tags: [],
      };
    }
    return undefined;
  };

  const origGetEligible = ShuffleService.getEligibleShuffleTracks;
  let eligibleCalls = 0;
  ShuffleService.getEligibleShuffleTracks = async () => {
    eligibleCalls++;
    return [
      { id: "elig1", title: "Eligible 1", fileUrl: tracks[2].fileUrl } as Track,
      { id: "elig2", title: "Eligible 2", fileUrl: tracks[3].fileUrl } as Track,
    ];
  };

  try {
    const state = emptyPlayer();
    state.queues[0].trackIds = ["end1", "end2"];
    state.queues[0].index = 1; // At last track
    state.queues[0].repeat = "off";
    state.queues[0].shuffleOnEnd = true;
    player.initialize(state, tracks);

    // Verify hasNext is true when at end of queue and shuffleOnEnd is enabled
    await usePlayerStore.getState().updateQueueStatus();
    assert.equal(usePlayerStore.getState().hasNext, true);

    // Trigger natural queue end via player.next(true)
    await player.next(true);

    assert.equal(eligibleCalls, 1);
    assert.equal(usePlayerStore.getState().playbackContext, "random_queue_end");
    assert.equal(usePlayerStore.getState().isShuffleEnabled, true);
    assert.equal(
      useToastStore.getState().icon,
      "shuffle",
      "Toast notification should be shown with shuffle icon",
    );
    const activeAfterAutoplay = player.getSnapshot().track?.id;
    assert.ok(
      activeAfterAutoplay === "elig1" || activeAfterAutoplay === "elig2",
    );
  } finally {
    ShuffleService.getEligibleShuffleTracks = origGetEligible;
    (g.window as { mmplayer: { invoke: unknown } }).mmplayer.invoke =
      prevInvoke;
  }
});

test("Section 1.2 & 1.3: Real SQLite worker enforces 50%/10s listen threshold, captures track & album tag snapshots, and supports ShuffleService exclusions", async () => {
  const directory = await temporary();
  const music = join(directory, "music");
  const data = join(directory, "data");
  await mkdir(music, { recursive: true });
  await mkdir(data, { recursive: true });

  // Create a 30-second WAV file so minimum threshold is 15 seconds (50% of 30s)
  await writeFile(join(music, "ThirtySec.wav"), wav(30));
  await writeFile(join(music, "SecondSong.wav"), wav(30));

  const listeners = new Map<string, Set<(value: any) => void>>();
  const worker = new LibraryWorkerClient(
    resolve("build/libraryWorker.cjs"),
    data,
    (event, payload) =>
      listeners.get(event)?.forEach((listener) => listener(payload)),
  );
  const bridge = {
    importDroppedFiles: async () => ({ trackIds: [], imported: 0 }),
    invoke: (command: string, input: unknown) => worker.request(command, input),
    on: (event: string, listener: (value: any) => void) => {
      let set = listeners.get(event);
      if (!set) listeners.set(event, (set = new Set()));
      set.add(listener);
      return () => set!.delete(listener);
    },
    onBeforeClose: () => () => {},
  } as DesktopBridge;

  const g = globalThis as Record<string, unknown>;
  const prevInvoke = (g.window as { mmplayer: { invoke: unknown } }).mmplayer
    .invoke;
  (g.window as { mmplayer: { invoke: unknown } }).mmplayer.invoke =
    bridge.invoke;

  try {
    await worker.request("initialize");
    await worker.request("addRoots", [music]);
    const snapshot = await worker.request<LibrarySnapshot>("library");
    assert.equal(snapshot.tracks.length, 2);

    const track1 = snapshot.tracks.find((t) => t.title === "ThirtySec")!;
    const track2 = snapshot.tracks.find((t) => t.title === "SecondSong")!;
    assert.equal(track1.duration, 30);

    // Create two tags: one for the track, one for the album
    const trackTagId = await worker.request<string>("createTag", {
      name: "Synthwave",
      color: "#ff0055",
    });
    const albumTagId = await worker.request<string>("createTag", {
      name: "Concept Album",
      color: "#00aa88",
    });
    await worker.request("toggleTag", {
      tagId: trackTagId,
      trackId: track1.id,
    });

    // Attach albumTagId to track1's album via WatermelonDB
    await database.write(async () => {
      await database.get<AlbumTag>("album_tags").create((link) => {
        link.album.id = track1.albumId;
        link.tag.id = albumTagId;
      });
    });

    // 1. Quick skip (0.5s or 8s < 15s required) MUST NOT record a listen in playback_history
    await worker.request("listen", { trackId: track1.id, seconds: 0.5 });
    await worker.request("listen", { trackId: track1.id, seconds: 8 });

    let historyRows = await database
      .get<PlaybackHistory>("playback_history")
      .query()
      .fetch();
    assert.equal(
      historyRows.length,
      0,
      "Quick skips under 50% duration / 10s must not be logged to playback_history",
    );

    // 2. Valid listen (>= 50% duration, e.g. 20s, and capped if > 30s) records history AND captures playback_history_tags
    await worker.request("listen", { trackId: track1.id, seconds: 45 });

    historyRows = await database
      .get<PlaybackHistory>("playback_history")
      .query()
      .fetch();
    assert.equal(historyRows.length, 1);
    assert.equal(historyRows[0].itemId, track1.id);
    assert.equal(
      historyRows[0].durationPlayed,
      30,
      "Duration played should be capped to track duration (30s)",
    );
    assert.equal(
      historyRows[0].tagsCaptured,
      true,
      "tagsCaptured must be true when recorded in PC",
    );

    const historyTags = await database
      .get<PlaybackHistoryTag>("playback_history_tags")
      .query(Q.where("history_id", historyRows[0].id))
      .fetch();
    assert.equal(historyTags.length, 2);
    const byScope = new Map(historyTags.map((ht) => [ht.scope, ht.tagId]));
    assert.equal(byScope.get("track"), trackTagId);
    assert.equal(byScope.get("album"), albumTagId);

    // Verify ActivityChartsService returns the tag stats for both track and album scopes
    const now = new Date(Date.now() + 60000);
    const trackTagStats = await ActivityChartsService.getStats(
      null,
      now,
      now,
      undefined,
      { tagId: trackTagId, scope: "track" },
    );
    assert.deepEqual(getChartTotals(trackTagStats.hours), {
      seconds: 30,
      plays: 1,
    });

    const albumTagStats = await ActivityChartsService.getStats(
      null,
      now,
      now,
      undefined,
      { tagId: albumTagId, scope: "album" },
    );
    assert.deepEqual(getChartTotals(albumTagStats.hours), {
      seconds: 30,
      plays: 1,
    });

    // 3. ShuffleService exclusions work against real desktop DB and update snapshot.isExcludedFromShuffle
    const dbTrack2 = await database.get<Track>("tracks").find(track2.id);
    await ShuffleService.toggleTrackExclusion(dbTrack2);
    assert.equal(dbTrack2.isExcludedFromShuffle, true);

    const eligible = await ShuffleService.getEligibleShuffleTracks();
    assert.deepEqual(
      eligible.map((t) => t.id),
      [track1.id],
    );

    const snapAfterExcl = await worker.request<LibrarySnapshot>("library");
    assert.equal(
      snapAfterExcl.tracks.find((t) => t.id === track2.id)
        ?.isExcludedFromShuffle,
      true,
    );
    assert.equal(
      snapAfterExcl.tracks.find((t) => t.id === track1.id)
        ?.isExcludedFromShuffle,
      false,
    );

    // Album exclusion also marks tracks as excluded in ShuffleService and snapshot
    await ShuffleService.includeTrack(dbTrack2);
    const dbAlbum = await database.get<Album>("albums").find(track1.albumId);
    await ShuffleService.toggleAlbumExclusion(dbAlbum);
    assert.equal((await ShuffleService.getEligibleShuffleTracks()).length, 0);
    await ShuffleService.includeAlbum(dbAlbum);
    assert.equal((await ShuffleService.getEligibleShuffleTracks()).length, 2);

    // 4. Recents persistence across restart & refreshRecentsFromDatabase
    usePlayerStore.setState({ recentMedia: [], recentPlaylists: [] });
    usePlayerStore.getState().addMediaToRecents({
      id: track1.id,
      type: "track",
      title: "Stale Title",
      subtitle: "Stale Artist",
      imageUrl: null,
    });
    usePlayerStore.getState().addPlaylistToRecents({
      id: "pl-1",
      name: "My Playlist",
      description: "Desc",
      imageUrl: null,
    });
    // Wait for async saveRecentsState
    await usePlayerStore.getState().saveRecentsState();

    // Simulate app restart by clearing memory state and calling restoreRecentsState + refreshRecentsFromDatabase
    usePlayerStore.setState({ recentMedia: [], recentPlaylists: [] });
    await usePlayerStore.getState().restoreRecentsState();
    assert.equal(usePlayerStore.getState().recentMedia.length, 1);
    assert.equal(usePlayerStore.getState().recentPlaylists.length, 1);
    assert.equal(usePlayerStore.getState().recentPlaylists[0].name, "My Playlist");

    await usePlayerStore.getState().refreshRecentsFromDatabase();
    assert.equal(
      usePlayerStore.getState().recentMedia[0].title,
      "ThirtySec",
      "refreshRecentsFromDatabase should refresh track title from DB",
    );
  } finally {
    (g.window as { mmplayer: { invoke: unknown } }).mmplayer.invoke =
      prevInvoke;
    await worker.close();
    await cleanup(directory);
  }
});

test("Section 1.2 & 1.3: Shared PlaybackListenService, consumeUserQueueTransition, and applyNativeManualQueueSize unit parity", () => {
  // evaluateListenDuration unit checks
  assert.deepEqual(evaluateListenDuration(180, 5), {
    seconds: 5,
    minimum: 90,
    eligible: false,
  });
  assert.deepEqual(evaluateListenDuration(180, 95), {
    seconds: 95,
    minimum: 90,
    eligible: true,
  });
  assert.deepEqual(evaluateListenDuration(180, 300), {
    seconds: 180,
    minimum: 90,
    eligible: true,
  });
  assert.deepEqual(evaluateListenDuration(10, 6), {
    seconds: 6,
    minimum: 5,
    eligible: false, // < 10s absolute minimum
  });
  assert.deepEqual(evaluateListenDuration(0, 15), {
    seconds: 15,
    minimum: 20,
    eligible: false,
  });
  assert.deepEqual(evaluateListenDuration(0, 25), {
    seconds: 25,
    minimum: 20,
    eligible: true,
  });

  // consumeUserQueueTransition deduplication & crossfade handling
  usePlayerStore.setState({ userQueueSize: 5 });
  const event = {
    track: { id: "manual-next" },
    lastTrack: { id: "manual-prev" },
    index: 2,
    lastIndex: 1,
  };
  consumeUserQueueTransition(event);
  consumeUserQueueTransition({ ...event });
  assert.equal(usePlayerStore.getState().userQueueSize, 4);

  // applyNativeManualQueueSize rejects stale revisions
  applyNativeManualQueueSize(2, 10);
  applyNativeManualQueueSize(5, 9);
  assert.equal(usePlayerStore.getState().userQueueSize, 2);
  applyNativeManualQueueSize(1, 11);
  assert.equal(usePlayerStore.getState().userQueueSize, 1);
});

// ============================================================================
// MOBILE PARITY TESTS: TIMESTAMPS (SKIP SEGMENTS) & A-B REPEAT (SECTION 1.4)
// ============================================================================
import {
  EMPTY_SKIP_CONFIG,
  evaluateABButtonPress,
  formatTimestampInput,
  hasAudibleABRange,
  parseSkipConfig,
  parseTimestampInput,
  shouldTriggerABLoop,
} from "@mmplayer/core/timestamps";
import { TimestampService } from "../src/renderer/ports/timestampService";
import { useTimestampStore } from "../../../src/store/useTimestampStore";

test("Section 1.4: TrackTimestamps pure functions parity (normalizeSkipSegments, parseSkipConfig, resolveSkipPosition, hasAudibleABRange, format/parseTimestampInput)", () => {
  const seg = (startMs: number, endMs: number, id = `${startMs}`) => ({
    id,
    startMs,
    endMs,
  });

  // Sorts and merges overlapping and adjacent sections without mutating source
  const input = [seg(4000, 6000), seg(1000, 3000), seg(2500, 4000)];
  assert.deepEqual(normalizeSkipSegments(input, 10000), [seg(1000, 6000)]);
  assert.equal(input[1].endMs, 3000);

  // Rejects invalid or whole-song skip
  for (const [start, end] of [
    [0, 0],
    [1000, 500],
    [-1, 1000],
    [0, 10001],
    [NaN, 1000],
    [0, Infinity],
    [0, 10000],
  ] as const) {
    assert.throws(() => normalizeSkipSegments([seg(start, end)], 10000));
  }

  // Leaves old libraries and corrupt or outdated rules playable
  for (const raw of [null, undefined, "", "{invalid", '{"segments":{}}']) {
    assert.deepEqual(parseSkipConfig(raw), EMPTY_SKIP_CONFIG);
  }
  assert.deepEqual(
    parseSkipConfig(JSON.stringify({ segments: [seg(1000, 8000)] }), 5000),
    EMPTY_SKIP_CONFIG,
  );

  // Half-open intervals, disabled rules, and hasAudibleABRange
  const cfg = { enabled: true, segments: [seg(1000, 3000)] };
  assert.equal(resolveSkipPosition(999, cfg), 999);
  assert.equal(resolveSkipPosition(1000, cfg), 3000);
  assert.equal(resolveSkipPosition(2999, cfg), 3000);
  assert.equal(resolveSkipPosition(3000, cfg), 3000);
  assert.equal(resolveSkipPosition(2000, { ...cfg, enabled: false }), 2000);
  assert.equal(hasAudibleABRange(1, 2, cfg), false);
  assert.equal(hasAudibleABRange(1, 4, cfg), true);

  // Parses and formats timestamps in milliseconds
  for (const [text, expected] of [
    ["0:00", 0],
    ["1:02.125", 62125],
    ["02:59,5", 179500],
    ["100:00", 6000000],
  ] as const) {
    assert.equal(parseTimestampInput(text), expected);
    assert.equal(parseTimestampInput(formatTimestampInput(expected)), expected);
  }
  for (const bad of ["-1:00", "1:60", "1:2:3", "", "abc", "0:10.1234"]) {
    assert.equal(parseTimestampInput(bad), null);
  }
});

test("Section 1.4: TimestampService.initialize updates useTimestampStore on track change, observes live DB updates, and configures DesktopPlayer", async () => {
  installFakeBrowserAudioEnvironment();

  const segConfig = {
    enabled: true,
    segments: [{ id: "intro", startMs: 10000, endMs: 25000 }],
  };
  const updatedConfig = {
    enabled: true,
    segments: [
      { id: "intro", startMs: 10000, endMs: 25000 },
      { id: "outro", startMs: 150000, endMs: 175000 },
    ],
  };

  const track1 = makeLibraryTrack("ts-track-1", {
    duration: 180,
    skipSegments: JSON.stringify(segConfig),
  });
  const track2 = makeLibraryTrack("ts-track-2", {
    duration: 180,
    skipSegments: null,
  });

  const savedCalls: Array<{ trackId: string; skipSegments: string | null }> =
    [];
  const g = globalThis as Record<string, unknown>;
  const prevInvoke = (g.window as { mmplayer: { invoke: unknown } }).mmplayer
    .invoke;
  (
    g.window as {
      mmplayer: {
        invoke: (cmd: string, payload?: unknown) => Promise<unknown>;
      };
    }
  ).mmplayer.invoke = async (cmd: string, payload?: unknown) => {
    if (cmd === "saveTimestamps") {
      const p = payload as { trackId: string; skipSegments: string | null };
      savedCalls.push(p);
      return undefined;
    }
    if (cmd === "library") {
      return {
        tracks: [track1, track2],
        albums: [],
        artists: [],
        playlists: [],
        tags: [],
      };
    }
    return undefined;
  };

  const origFind = database.get<Track>("tracks").find.bind(
    database.get<Track>("tracks"),
  );
  let observerCallback: ((model: any) => void) | null = null;
  let unsubscribedCount = 0;

  (database.get<Track>("tracks") as any).find = async (id: string) => {
    const raw = id === "ts-track-1" ? track1 : track2;
    return {
      id: raw.id,
      duration: raw.duration,
      skipSegments: raw.skipSegments,
      observe: () => ({
        subscribe: (cb: (model: any) => void) => {
          observerCallback = cb;
          cb({
            id: raw.id,
            duration: raw.duration,
            skipSegments: raw.skipSegments,
          });
          return {
            unsubscribe: () => {
              unsubscribedCount += 1;
            },
          };
        },
      }),
    };
  };

  try {
    useTimestampStore.setState({
      trackId: null,
      config: EMPTY_SKIP_CONFIG,
      previewTrackId: null,
      previewConfig: null,
    });
    useABRepeatStore.getState().reset();

    const state = emptyPlayer();
    state.queues[0].trackIds = ["ts-track-1", "ts-track-2"];
    state.queues[0].index = 0;
    player.initialize(state, [track1, track2]);

    await TimestampService.initialize();
    for (let i = 0; i < 8; i++) await Promise.resolve();

    // 1. useTimestampStore is populated for active track ts-track-1
    assert.equal(useTimestampStore.getState().trackId, "ts-track-1");
    assert.deepEqual(useTimestampStore.getState().config, segConfig);

    // 2. Live DB observer update immediately updates useTimestampStore
    assert.ok(observerCallback, "WatermelonDB track observer should be active");
    (observerCallback as (model: any) => void)({
      id: "ts-track-1",
      duration: 180,
      skipSegments: JSON.stringify(updatedConfig),
    });
    assert.deepEqual(useTimestampStore.getState().config, updatedConfig);

    // 3. Changing active track disposes previous observer and loads new track's config
    await player.skipTo(1);
    for (let i = 0; i < 8; i++) await Promise.resolve();
    assert.ok(
      unsubscribedCount >= 1,
      "Previous track observer must be unsubscribed on track change",
    );
    assert.equal(useTimestampStore.getState().trackId, "ts-track-2");
    assert.deepEqual(useTimestampStore.getState().config, EMPTY_SKIP_CONFIG);

    // Switch back to ts-track-1
    await player.skipTo(0);
    for (let i = 0; i < 8; i++) await Promise.resolve();
    assert.equal(useTimestampStore.getState().trackId, "ts-track-1");

    // 4. TimestampService.save validates ranges and active A-B loop before persisting
    await assert.rejects(
      TimestampService.save({ id: "ts-track-1", duration: 180 } as Track, {
        enabled: true,
        segments: [{ id: "bad", startMs: 30000, endMs: 10000 }],
      }),
      /range/,
    );
    assert.equal(savedCalls.length, 0);

    // Rejects when active A-B range [12s, 18s] would be completely silenced by [10s, 25s]
    useABRepeatStore.getState().setPointA(12);
    useABRepeatStore.getState().setPointB(18);
    await assert.rejects(
      TimestampService.save(
        { id: "ts-track-1", duration: 180 } as Track,
        segConfig,
      ),
      /ab_range/,
    );
    assert.equal(savedCalls.length, 0);
    useABRepeatStore.getState().reset();

    // Valid save persists normalized config, updates useTimestampStore and player track metadata
    await TimestampService.save(
      { id: "ts-track-1", duration: 180 } as Track,
      segConfig,
    );
    assert.equal(savedCalls.length, 1);
    assert.equal(savedCalls[0].trackId, "ts-track-1");
    assert.deepEqual(
      JSON.parse((savedCalls[0] as any).value),
      segConfig,
    );
    assert.deepEqual(useTimestampStore.getState().config, segConfig);

    // 5. Manual seek into a skip segment vs automatic seek (seekAutomatically)
    await player.play(true);
    // Automatic seek into [10s, 25s] at 12s does NOT set manuallyEnteredSegment -> next tick skips to 25s
    await TimestampService.seekAutomatically(12);
    (player as any).tick();
    assert.equal(
      player.getSnapshot().position,
      25,
      "Automatic seek into a skip segment should immediately jump to segment end (25s)",
    );

    // Manual seek into [10s, 25s] at 15s sets manuallyEnteredSegment -> allows playing inside the segment
    player.seek(15, false);
    (player as any).tick();
    assert.equal(
      player.getSnapshot().position,
      15,
      "Manual seek into a skip segment should allow playback inside that segment without skipping",
    );

    // 6. Blocking timestamps during Lyrics Sync
    usePlayerStore.setState({ isSyncingLyrics: true });
    await TimestampService.seekAutomatically(12);
    (player as any).tick();
    assert.equal(
      player.getSnapshot().position,
      12,
      "Skip segments must be blocked while syncing lyrics",
    );
    usePlayerStore.setState({ isSyncingLyrics: false });
    await player.pause(true);
  } finally {
    (database.get<Track>("tracks") as any).find = origFind;
    (g.window as { mmplayer: { invoke: unknown } }).mmplayer.invoke =
      prevInvoke;
  }
});

test("Section 1.4: useABRepeatStore full parity (handleButtonPress, hasAudibleABRange validation, handleLongPress, clearAB, reset, and checkLoop)", async () => {
  installFakeBrowserAudioEnvironment();

  const segConfig = {
    enabled: true,
    segments: [{ id: "muted-middle", startMs: 20000, endMs: 40000 }],
  };
  const track = makeLibraryTrack("ab-track-1", {
    duration: 180,
    skipSegments: JSON.stringify(segConfig),
  });

  const state = emptyPlayer();
  state.queues[0].trackIds = ["ab-track-1"];
  state.queues[0].index = 0;
  player.initialize(state, [track]);

  useTimestampStore.setState({
    trackId: "ab-track-1",
    config: segConfig,
    previewTrackId: null,
    previewConfig: null,
  });
  useABRepeatStore.getState().reset();
  useCastStore.setState({
    isServerRunning: false,
    isLocalCastActive: false,
    isChromecastConnected: false,
  });

  // 1. First press sets pointA
  await useABRepeatStore.getState().handleButtonPress(22);
  assert.equal(useABRepeatStore.getState().pointA, 22);
  assert.equal(useABRepeatStore.getState().pointB, null);
  assert.equal(useToastStore.getState().icon, "flag-outline");

  // 2. Second press at position <= pointA updates pointA instead of setting invalid pointB
  await useABRepeatStore.getState().handleButtonPress(18);
  assert.equal(useABRepeatStore.getState().pointA, 18);
  assert.equal(useABRepeatStore.getState().pointB, null);

  // Move pointA into muted range [20s, 40s] at 22s, then try setting pointB at 35s (entirely inside [20s, 40s])
  useABRepeatStore.getState().setPointA(22);
  await useABRepeatStore.getState().handleButtonPress(35);
  assert.equal(
    useABRepeatStore.getState().pointB,
    null,
    "Point B must be rejected when the A-B range is completely covered by a skip segment",
  );
  assert.equal(useToastStore.getState().icon, "warning");

  // 3. Second press with audible range [22s, 50s] (40s..50s is audible) sets pointB
  await useABRepeatStore.getState().handleButtonPress(50);
  assert.equal(useABRepeatStore.getState().pointA, 22);
  assert.equal(useABRepeatStore.getState().pointB, 50);
  assert.equal(useToastStore.getState().icon, "repeat");

  // 4. checkLoop(currentPosition) seeks automatically to pointA (which resolves past skip segment [20s, 40s] -> 40s) when >= pointB or < pointA - 0.5
  assert.equal(shouldTriggerABLoop(50.1, 22, 50), 22);
  assert.equal(shouldTriggerABLoop(21.0, 22, 50), 22);
  assert.equal(shouldTriggerABLoop(45.0, 22, 50), null);

  await player.play(true);
  player.seek(51, false);
  await useABRepeatStore.getState().checkLoop(51);
  assert.equal(player.getSnapshot().position, 22);
  (player as any).tick();
  assert.equal(player.getSnapshot().position, 40);
  await player.pause(true);

  // 5. Third press clears A-B repeat
  await useABRepeatStore.getState().handleButtonPress(42);
  assert.equal(useABRepeatStore.getState().pointA, null);
  assert.equal(useABRepeatStore.getState().pointB, null);
  assert.equal(useToastStore.getState().icon, "close-outline");

  // 6. handleLongPress and reset() clear A-B points
  useABRepeatStore.getState().setPointA(10);
  useABRepeatStore.getState().setPointB(30);
  useABRepeatStore.getState().handleLongPress();
  assert.equal(useABRepeatStore.getState().pointA, null);
  assert.equal(useABRepeatStore.getState().pointB, null);

  useABRepeatStore.getState().setPointA(5);
  useABRepeatStore.getState().setPointB(15);
  useABRepeatStore.getState().reset();
  assert.equal(useABRepeatStore.getState().pointA, null);
  assert.equal(useABRepeatStore.getState().pointB, null);

  // Pure evaluateABButtonPress unit check
  assert.deepEqual(evaluateABButtonPress(null, null, 10, EMPTY_SKIP_CONFIG), {
    type: "set_a",
    pointA: 10,
    pointB: null,
    toastKey: "toasts.ab_point_a_set",
    toastIcon: "flag-outline",
    haptic: "light",
  });
  assert.deepEqual(evaluateABButtonPress(10, null, 8, EMPTY_SKIP_CONFIG), {
    type: "update_a",
    pointA: 8,
    pointB: null,
    toastKey: "toasts.ab_point_a_updated",
    toastIcon: "flag-outline",
    haptic: "light",
  });
  assert.deepEqual(evaluateABButtonPress(22, null, 35, segConfig), {
    type: "reject_b_muted",
    pointA: 22,
    pointB: null,
    toastKey: "timestamps.ab_range",
    toastIcon: "warning",
    haptic: "none",
  });
  assert.deepEqual(evaluateABButtonPress(22, null, 50, segConfig), {
    type: "set_b",
    pointA: 22,
    pointB: 50,
    toastKey: "toasts.ab_point_b_set",
    toastIcon: "repeat",
    haptic: "light",
  });
  assert.deepEqual(evaluateABButtonPress(22, 50, 30, segConfig), {
    type: "clear",
    pointA: null,
    pointB: null,
    toastKey: "toasts.ab_deactivated",
    toastIcon: "close-outline",
    haptic: "light",
  });
});

// ============================================================================
// MOBILE PARITY TESTS: METADATA COVER ART, DEEZER ARTWORK & MEDIA ASSETS (SECTIONS 1.5, 1.6, 1.7)
// ============================================================================
import * as DesktopFileSystem from "../src/renderer/ports/fileSystem";
import { MetadataEditorService } from "../src/renderer/ports/metadataEditor";
import { generateVideoThumbnail } from "../src/renderer/ports/audioFiles";
import {
  AlbumCoverService,
  isMissingAlbumCover,
  selectAlbumCover,
} from "../../../src/services/AlbumCoverService";
import { ArtistImageService } from "../../../src/services/ArtistImageService";
import {
  MediaAssetService,
  cleanupTempSource,
} from "../../../src/services/MediaAssetService";
import { StorageService, formatBytes } from "../../../src/services/StorageService";

const SAMPLE_JPEG_BYTES = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
);

test("Section 1.5: MetadataEditorService & writeMetadata embed external cover art from local files, staged mmplayer-media:// cache files, data: URIs, and blob: URIs, update WatermelonDB Album.coverUrl, and clear covers", async () => {
  const directory = await temporary();
  const music = join(directory, "music");
  const data = join(directory, "data");
  await mkdir(music, { recursive: true });
  await mkdir(data, { recursive: true });

  const mp3Fixture = await readFile(resolve("test/fixtures/tone.mp3"));
  const songPath = join(music, "CoverTest.mp3");
  await writeFile(songPath, mp3Fixture);

  const externalCoverPath = join(directory, "external_cover.jpg");
  await writeFile(externalCoverPath, SAMPLE_JPEG_BYTES);

  const listeners = new Map<string, Set<(value: any) => void>>();
  const worker = new LibraryWorkerClient(
    resolve("build/libraryWorker.cjs"),
    data,
    (event, payload) =>
      listeners.get(event)?.forEach((listener) => listener(payload)),
  );
  const bridge = {
    importDroppedFiles: async () => ({ trackIds: [], imported: 0 }),
    invoke: (command: string, input: unknown) => worker.request(command, input),
    on: (event: string, listener: (value: any) => void) => {
      let set = listeners.get(event);
      if (!set) listeners.set(event, (set = new Set()));
      set.add(listener);
      return () => set!.delete(listener);
    },
    onBeforeClose: () => () => {},
  } as DesktopBridge;

  const g = globalThis as Record<string, unknown>;
  const prevInvoke = (g.window as { mmplayer: { invoke: unknown } }).mmplayer
    .invoke;
  const prevOn = (g.window as { mmplayer: { on?: unknown } }).mmplayer.on;
  const prevFetch = globalThis.fetch;
  (g.window as { mmplayer: { invoke: unknown; on: unknown } }).mmplayer.invoke =
    bridge.invoke;
  (g.window as { mmplayer: { invoke: unknown; on: unknown } }).mmplayer.on =
    bridge.on;

  try {
    await worker.request("initialize");
    await worker.request("addRoots", [music]);
    let snapshot = await worker.request<LibrarySnapshot>("library");
    assert.equal(snapshot.tracks.length, 1);
    const track = snapshot.tracks[0];
    assert.equal(track.cover, null);

    // 1. Save external local cover image path via MetadataEditorService
    await MetadataEditorService.saveMetadata(
      [{ fileUrl: track.fileUrl }],
      { title: "With Local Cover", coverArtPath: externalCoverPath },
      false,
      false,
    );

    const parsed1 = await parseFile(songPath);
    assert.equal(parsed1.common.title, "With Local Cover");
    assert.equal(
      parsed1.common.picture?.length,
      1,
      "External local cover image must be embedded into physical MP3 tags",
    );
    assert.deepEqual(
      Buffer.from(parsed1.common.picture![0].data),
      SAMPLE_JPEG_BYTES,
    );

    snapshot = await worker.request<LibrarySnapshot>("library");
    assert.equal(
      snapshot.tracks[0].cover,
      `mmplayer-media://cover/${encodeURIComponent(track.id)}`,
    );
    const dbAlbum1 = await database
      .get<Album>("albums")
      .find(snapshot.tracks[0].albumId);
    assert.ok(
      dbAlbum1.coverUrl?.startsWith(
        `mmplayer-media://cover/${encodeURIComponent(track.id)}`,
      ),
      "Album.coverUrl in WatermelonDB must be updated to the new embedded cover",
    );

    // Verify mmplayer-media://cover/<id> serves the newly extracted cover
    const coverRes = await mediaResponse(
      new Request(`mmplayer-media://cover/${encodeURIComponent(track.id)}`),
      (id, kind) => worker.request("media", { id, kind }),
    );
    assert.equal(coverRes.status, 200);
    assert.deepEqual(
      Buffer.from(await coverRes.arrayBuffer()),
      SAMPLE_JPEG_BYTES,
    );

    // 2. Clear cover via coverArtPath = ""
    await MetadataEditorService.saveMetadata(
      [{ fileUrl: track.fileUrl }],
      { coverArtPath: "" },
      false,
      false,
    );
    const parsedCleared = await parseFile(songPath);
    assert.equal(parsedCleared.common.picture ?? undefined, undefined);
    const dbAlbumCleared = await database
      .get<Album>("albums")
      .find(snapshot.tracks[0].albumId);
    assert.equal(dbAlbumCleared.coverUrl, null);

    // 3. Save cover from blob: URL (as returned by DocumentPicker on web/Electron)
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const urlStr = String(input);
      if (urlStr.startsWith("blob:")) {
        return new Response(SAMPLE_JPEG_BYTES, {
          status: 200,
          headers: { "Content-Type": "image/jpeg" },
        });
      }
      return prevFetch(input);
    }) as typeof fetch;

    await MetadataEditorService.saveMetadata(
      [{ fileUrl: track.fileUrl }],
      { coverArtPath: "blob:mmplayer://app/picked-cover-123" },
      false,
      false,
    );
    const parsedBlob = await parseFile(songPath);
    assert.equal(
      parsedBlob.common.picture?.length,
      1,
      "blob: cover URI selected from DocumentPicker must be staged and embedded into physical file",
    );
    const dbAlbumBlob = await database
      .get<Album>("albums")
      .find(snapshot.tracks[0].albumId);
    assert.ok(
      dbAlbumBlob.coverUrl?.startsWith(
        `mmplayer-media://cover/${encodeURIComponent(track.id)}`,
      ),
    );

    // 4. Save cover from mmplayer-media://asset/cache/... (as returned by AlbumCoverService.downloadCover in MetadataEditorSheet)
    const cachedCoverUri = `${DesktopFileSystem.cacheDirectory}deezer_staged_cover.jpg`;
    await DesktopFileSystem.writeAsStringAsync(
      cachedCoverUri,
      SAMPLE_JPEG_BYTES.toString("base64"),
      { encoding: DesktopFileSystem.EncodingType.Base64 },
    );
    await MetadataEditorService.saveMetadata(
      [{ fileUrl: track.fileUrl }],
      { title: "With Deezer Cover", coverArtPath: cachedCoverUri },
      false,
      false,
    );
    const parsedDeezer = await parseFile(songPath);
    assert.equal(parsedDeezer.common.title, "With Deezer Cover");
    assert.equal(parsedDeezer.common.picture?.length, 1);
  } finally {
    globalThis.fetch = prevFetch;
    (g.window as { mmplayer: { invoke: unknown; on: unknown } }).mmplayer.invoke =
      prevInvoke;
    (g.window as { mmplayer: { invoke: unknown; on: unknown } }).mmplayer.on =
      prevOn;
    await worker.close();
    await cleanup(directory);
  }
});

test("Section 1.6 & 1.7: Deezer AlbumCoverService & ArtistImageService, MediaAssetService (Avatar, Artist, Playlist, CD, Canvas videos), StorageService, and mmplayer-media://asset protocol parity", async () => {
  const directory = await temporary();
  const music = join(directory, "music");
  const data = join(directory, "data");
  await mkdir(music, { recursive: true });
  await mkdir(data, { recursive: true });

  const mp3Fixture = await readFile(resolve("test/fixtures/tone.mp3"));
  const trackFile = join(music, "DiscoveryTrack.mp3");
  await writeFile(trackFile, mp3Fixture);
  await writeFileMetadata(trackFile, {
    title: "One More Time",
    artist: "Daft Punk",
    album: "Discovery",
    albumArtist: "Daft Punk",
  });

  const listeners = new Map<string, Set<(value: any) => void>>();
  const worker = new LibraryWorkerClient(
    resolve("build/libraryWorker.cjs"),
    data,
    (event, payload) =>
      listeners.get(event)?.forEach((listener) => listener(payload)),
  );
  const bridge = {
    importDroppedFiles: async () => ({ trackIds: [], imported: 0 }),
    invoke: (command: string, input: unknown) => worker.request(command, input),
    on: (event: string, listener: (value: any) => void) => {
      let set = listeners.get(event);
      if (!set) listeners.set(event, (set = new Set()));
      set.add(listener);
      return () => set!.delete(listener);
    },
    onBeforeClose: () => () => {},
  } as DesktopBridge;

  const g = globalThis as Record<string, unknown>;
  const prevInvoke = (g.window as { mmplayer: { invoke: unknown } }).mmplayer
    .invoke;
  const prevOn = (g.window as { mmplayer: { on?: unknown } }).mmplayer.on;
  const prevFetch = globalThis.fetch;
  (g.window as { mmplayer: { invoke: unknown; on: unknown } }).mmplayer.invoke =
    bridge.invoke;
  (g.window as { mmplayer: { invoke: unknown; on: unknown } }).mmplayer.on =
    bridge.on;

  // Mock global fetch and a local HTTP server for worker downloadAsync
  const { createServer } = await import("node:http");
  const server = createServer((req, res) => {
    if (req.url?.includes("cover.jpg") || req.url?.includes("artist.jpg")) {
      res.writeHead(200, { "Content-Type": "image/jpeg" });
      res.end(SAMPLE_JPEG_BYTES);
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolveListen) =>
    server.listen(0, "127.0.0.1", () => resolveListen()),
  );
  const port = (server.address() as { port: number }).port;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = String(input);
    if (urlStr.startsWith("https://api.deezer.com/search/album")) {
      return new Response(
        JSON.stringify({
          data: [
            {
              title: "Discovery",
              artist: { name: "Daft Punk" },
              cover_xl: "https://e-cdn-images.dzcdn.net/images/cover/cover.jpg",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (urlStr.startsWith("https://api.deezer.com/search/artist")) {
      return new Response(
        JSON.stringify({
          data: [
            {
              name: "Daft Punk",
              picture_xl:
                "https://e-cdn-images.dzcdn.net/images/artist/artist.jpg",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (urlStr.startsWith("blob:")) {
      return new Response(Buffer.from("fake-mp4-video-payload-12345"), {
        status: 200,
        headers: { "Content-Type": "video/mp4" },
      });
    }
    return prevFetch(input, init);
  }) as typeof fetch;

  // Intercept download op to route https://e-cdn-images.dzcdn.net to our local test HTTP server
  const rawInvoke = bridge.invoke;
  (g.window as { mmplayer: { invoke: unknown } }).mmplayer.invoke = async (
    cmd: string,
    input: any,
  ) => {
    if (
      cmd === "fileSystem" &&
      input?.op === "download" &&
      typeof input.url === "string"
    ) {
      const localUrl = input.url.replace(
        "https://e-cdn-images.dzcdn.net",
        `http://127.0.0.1:${port}`,
      );
      return rawInvoke("fileSystem" as any, { ...input, url: localUrl });
    }
    return rawInvoke(cmd as any, input);
  };

  try {
    await worker.request("initialize");
    await worker.request("addRoots", [music]);
    const snapshot = await worker.request<LibrarySnapshot>("library");
    assert.equal(snapshot.tracks.length, 1);
    assert.equal(snapshot.albums.length, 1);
    assert.equal(snapshot.artists.length, 1);

    const albumId = snapshot.albums[0].id;
    const artistId = snapshot.artists[0].id;
    const trackId = snapshot.tracks[0].id;

    // --- Section 1.6: Deezer AlbumCoverService & ArtistImageService ---
    assert.equal(isMissingAlbumCover(null), true);
    assert.equal(
      selectAlbumCover(
        [
          {
            title: "Discovery (Deluxe Edition)",
            artist: { name: "Daft Punk" },
            cover_xl: "https://e-cdn-images.dzcdn.net/deluxe.jpg",
          },
          {
            title: "Discovery",
            artist: { name: "Daft Punk" },
            cover_xl: "https://e-cdn-images.dzcdn.net/exact.jpg",
          },
        ],
        "Discovery",
        "Daft Punk",
      ),
      "https://e-cdn-images.dzcdn.net/exact.jpg",
    );

    const albumSummary = await AlbumCoverService.processMissingAlbumCovers();
    assert.deepEqual(albumSummary, {
      downloaded: 1,
      notFound: 0,
      failed: 0,
      skipped: 0,
    });

    const dbAlbum = await database.get<Album>("albums").find(albumId);
    assert.ok(
      dbAlbum.coverUrl?.startsWith(
        "mmplayer-media://asset/documents/media_assets/album_covers/album_",
      ),
      `Expected persistent mmplayer-media://asset album cover URL, got ${dbAlbum.coverUrl}`,
    );

    // Verify mmplayer-media://asset/... serves the saved album cover over HTTP protocol handler
    const albumAssetRes = await mediaResponse(
      new Request(dbAlbum.coverUrl!.split("?")[0]),
      (id, kind) => worker.request("media", { id, kind }),
    );
    assert.equal(albumAssetRes.status, 200);
    assert.equal(albumAssetRes.headers.get("Content-Type"), "image/jpeg");
    assert.deepEqual(
      Buffer.from(await albumAssetRes.arrayBuffer()),
      SAMPLE_JPEG_BYTES,
    );

    // ArtistImageService downloads and persists artist image
    useSettingsStore.setState({
      artistImageDownloadMode: "all",
      artistImageBackgroundDownload: true,
    });
    await ArtistImageService.processMissingArtistImages();
    const dbArtist = await database.get<Artist>("artists").find(artistId);
    assert.ok(
      dbArtist.imageUrl?.startsWith(
        "mmplayer-media://asset/documents/media_assets/artist_images/artist_",
      ),
      `Expected persistent mmplayer-media://asset artist image URL, got ${dbArtist.imageUrl}`,
    );

    // --- Section 1.7: MediaAssetService (Avatar, Artist, Playlist, CD) & Canvas Videos ---
    const extPhoto = join(directory, "custom.png");
    await writeFile(extPhoto, SAMPLE_JPEG_BYTES);

    const avatarUri = await MediaAssetService.saveUserAvatar(
      extPhoto,
      "avatar.png",
    );
    assert.ok(
      avatarUri.startsWith(
        "mmplayer-media://asset/documents/media_assets/user_avatar/user_avatar.png?t=",
      ),
    );
    assert.equal(
      (await DesktopFileSystem.getInfoAsync(avatarUri)).exists,
      true,
    );

    const playlistId = await worker.request<string>("createPlaylist", {
      name: "Custom Cover Playlist",
    });
    const playlistCoverUri = await MediaAssetService.savePlaylistCover(
      playlistId,
      extPhoto,
      "pl.png",
    );
    assert.ok(
      playlistCoverUri.startsWith(
        `mmplayer-media://asset/documents/media_assets/playlist_covers/playlist_${playlistId}.png?t=`,
      ),
    );

    const cdCoverUri = await MediaAssetService.saveAlbumCDCover(
      albumId,
      extPhoto,
      "cd.png",
    );
    assert.ok(
      cdCoverUri.startsWith(
        `mmplayer-media://asset/documents/media_assets/cd_covers/album_cd_${albumId}.png?t=`,
      ),
    );

    // Saving the same persistent URI bumps cache-buster without deleting the file
    const reSavedCd = await MediaAssetService.saveAlbumCDCover(
      albumId,
      cdCoverUri,
    );
    assert.ok(reSavedCd.startsWith(cdCoverUri.split("?")[0]));
    assert.equal(
      (await DesktopFileSystem.getInfoAsync(reSavedCd)).exists,
      true,
    );

    // Canvas Video upload from blob: URI (DocumentPicker on desktop), MD5 deduplication, thumbnail generation, assignment & deletion
    const blobVideoUri = "blob:mmplayer://app/canvas-video-test";
    const dupBefore = await MediaAssetService.checkCanvasDuplicate(blobVideoUri);
    assert.equal(dupBefore.isDuplicate, false);
    assert.ok(
      typeof dupBefore.md5 === "string" && dupBefore.md5.length === 32,
      "MD5 must be computed for blob: video URIs",
    );

    const savedCanvasUri = await MediaAssetService.saveNewCanvasVideo(
      blobVideoUri,
      dupBefore.md5,
    );
    assert.equal(
      savedCanvasUri,
      `mmplayer-media://asset/documents/media_assets/canvas_videos/canvas_${dupBefore.md5}.mp4`,
    );

    // Verify duplicate check now detects the uploaded video by MD5
    const dupAfter = await MediaAssetService.checkCanvasDuplicate(blobVideoUri);
    assert.equal(dupAfter.isDuplicate, true);
    assert.equal(dupAfter.existingVideo?.uri, savedCanvasUri);

    // Verify getAllUploadedCanvasVideos returns the video with its generated thumbnail
    const uploadedVideos = await MediaAssetService.getAllUploadedCanvasVideos();
    assert.equal(uploadedVideos.length, 1);
    assert.equal(uploadedVideos[0].uri, savedCanvasUri);
    assert.equal(uploadedVideos[0].md5, dupBefore.md5);
    assert.ok(
      uploadedVideos[0].thumbnailUri?.startsWith(
        "mmplayer-media://asset/documents/media_assets/canvas_thumbnails/",
      ),
      "Canvas video thumbnail must be generated and persisted on desktop",
    );
    assert.equal(
      (await DesktopFileSystem.getInfoAsync(uploadedVideos[0].thumbnailUri!))
        .exists,
      true,
    );

    // Verify mmplayer-media://asset/... serves the Canvas video with byte range support (206 Partial Content)
    const videoRangeRes = await mediaResponse(
      new Request(savedCanvasUri, { headers: { Range: "bytes=0-3" } }),
      (id, kind) => worker.request("media", { id, kind }),
    );
    assert.equal(videoRangeRes.status, 206);
    assert.equal(videoRangeRes.headers.get("Content-Type"), "video/mp4");
    assert.equal(
      Buffer.from(await videoRangeRes.arrayBuffer()).toString("utf8"),
      "fake",
    );

    // Assign Canvas video to track in WatermelonDB
    const dbTrack = await database.get<Track>("tracks").find(trackId);
    await MediaAssetService.assignCanvasToTracks([dbTrack], savedCanvasUri);
    assert.equal(dbTrack.bgVideo, savedCanvasUri);

    // StorageService breakdown calculates sizes on desktop
    const breakdown = await StorageService.getStorageBreakdown();
    assert.ok(breakdown.artistImagesBytes > 0);
    assert.ok(breakdown.albumCoversBytes > 0);
    assert.ok(breakdown.playlistCoversBytes > 0);
    assert.ok(breakdown.cdCoversBytes > 0);
    assert.ok(breakdown.canvasVideosBytes > 0);
    assert.ok(breakdown.mmplayerTotalBytes > 0);
    assert.equal(formatBytes(1024), "1 KB");

    // Delete Canvas video unassigns track.bgVideo and removes video + thumbnail
    await MediaAssetService.deleteCanvasVideo(savedCanvasUri);
    const dbTrackAfterDelete = await database.get<Track>("tracks").find(trackId);
    assert.equal(dbTrackAfterDelete.bgVideo, null);
    assert.equal(
      (await MediaAssetService.getAllUploadedCanvasVideos()).length,
      0,
    );

    // Remove custom images and cleanup temp source
    await MediaAssetService.removeUserAvatar();
    assert.equal(
      (await DesktopFileSystem.getInfoAsync(avatarUri)).exists,
      false,
    );
    await MediaAssetService.removePlaylistCover(playlistId);
    assert.equal(
      (await DesktopFileSystem.getInfoAsync(playlistCoverUri)).exists,
      false,
    );
    await MediaAssetService.removeAlbumCDCover(albumId);
    assert.equal(
      (await DesktopFileSystem.getInfoAsync(cdCoverUri)).exists,
      false,
    );

    const tempCacheFile = `${DesktopFileSystem.cacheDirectory}temp_picker_file.jpg`;
    await DesktopFileSystem.writeAsStringAsync(tempCacheFile, "temp");
    assert.equal(
      (await DesktopFileSystem.getInfoAsync(tempCacheFile)).exists,
      true,
    );
    await cleanupTempSource(tempCacheFile);
    assert.equal(
      (await DesktopFileSystem.getInfoAsync(tempCacheFile)).exists,
      false,
    );

    // generateVideoThumbnail standalone call
    const thumbUri = await generateVideoThumbnail(
      savedCanvasUri,
      `${DesktopFileSystem.cacheDirectory}standalone_thumb.jpg`,
    );
    assert.ok(thumbUri);
    assert.equal((await DesktopFileSystem.getInfoAsync(thumbUri!)).exists, true);
  } finally {
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    globalThis.fetch = prevFetch;
    (g.window as { mmplayer: { invoke: unknown; on: unknown } }).mmplayer.invoke =
      prevInvoke;
    (g.window as { mmplayer: { invoke: unknown; on: unknown } }).mmplayer.on =
      prevOn;
    await worker.close();
    await cleanup(directory);
  }
});






test("desktop archives round-trip binary media, validate CRC and reject unsafe entries", async () => {
  const root = await temporary();
  try {
    const input = join(root, "source"); await mkdir(join(input, "assets"), { recursive: true });
    await writeFile(join(input, "database.json"), '{"tracks":[]}');
    const bytes = Buffer.from([0, 255, 128, 1, 2]); await writeFile(join(input, "assets", "0.mp4"), bytes);
    const archive = join(root, "copy.zip"); await createArchive([input], archive);
    assert.equal(await archiveSize(archive), Buffer.byteLength('{"tracks":[]}') + bytes.length);
    const output = join(root, "restored"); await extractArchive(archive, output);
    assert.deepEqual(await readFile(join(output, "assets", "0.mp4")), bytes);
    await assert.rejects(extractArchive(archive, output), /EEXIST/);
    for (const name of ["CON.mp3", "Song.mp3 ", "a:b.mp3"]) {
      const file = new yazl.ZipFile(); file.addBuffer(Buffer.from("bad"), name.replace(":", "_"));
      const chunks: Buffer[] = []; file.outputStream.on("data", chunk => chunks.push(chunk));
      const complete = new Promise<void>(resolve => file.outputStream.on("end", resolve)); file.end(); await complete;
      let bad = Buffer.concat(chunks);
      if (name.includes(":")) bad = Buffer.from(bad.toString("latin1").replaceAll("a_b.mp3", "a:b.mp3"), "latin1");
      const path = join(root, "bad.zip"); await writeFile(path, bad);
      await assert.rejects(extractArchive(path, join(root, "unsafe")));
    }
    const corrupt = Buffer.from(await readFile(archive));corrupt[0] = 0;
    await writeFile(join(root,"corrupt.zip"),corrupt);
    await assert.rejects(extractArchive(join(root,"corrupt.zip"),join(root,"corrupt-output")));
  } finally { await cleanup(root); }
});

test("Android backup tracks remap uniquely to PC IDs, paths, playlists, tags and history", () => {
  const base = { artists: [{ id: "a", name: "Artist" }], albums: [{ id: "b", title: "Album" }] };
  const row = { id: "android", file_url: "content://android/123", title: "Song", artist_id: "a", album_id: "b", duration: 12 };
  const incoming = { ...base, tracks: [row], playlist_tracks: [{ id: "link", track_id: "android" }], track_tags: [{ id: "tag", track_id: "android" }], playback_history: [{ id: "listen", item_type: "track", item_id: "android" }] };
  const current = { ...base, tracks: [{ ...row, id: "pc-hash", file_url: "file:///C:/Music/song.mp3" }] };
  const mapped = remapBackupTracks(incoming, current);
  assert.equal(mapped.matched, 1);assert.equal(mapped.data.tracks[0].id,"pc-hash");
  assert.equal(mapped.data.tracks[0].file_url,current.tracks[0].file_url);
  assert.equal(mapped.data.playlist_tracks[0].track_id,"pc-hash");assert.equal(mapped.data.track_tags[0].track_id,"pc-hash");assert.equal(mapped.data.playback_history[0].item_id,"pc-hash");
  assert.equal(incoming.tracks[0].id,"android");
  const ambiguous = remapBackupTracks(incoming,{...current,tracks:[...current.tracks,{...current.tracks[0],id:"other"}]});
  assert.equal(ambiguous.matched,0);assert.equal(ambiguous.unmatched,1);
});


test("desktop storage reports real drive capacity and checks physical files behind virtual audio URIs", async () => {
  const directory = await temporary(), data = join(directory,"data"), file = join(directory,"Song.wav");
  await mkdir(data);const bytes = wav();await writeFile(file,bytes);
  const worker = new LibraryWorkerClient(resolve("build/libraryWorker.cjs"),data,()=>{});
  try {
    await worker.request("initialize");await worker.request("importPaths",[file]);
    const snapshot = await worker.request<LibrarySnapshot>("library"),uri=snapshot.tracks[0].fileUrl;
    const { pathToFileURL } = await import("node:url");const physicalUri=pathToFileURL(file).href;
    assert.equal(await worker.request('trackExportPath', physicalUri), file);
    const unrelated = join(directory, 'private.txt');await writeFile(unrelated, 'not an indexed song');
    await assert.rejects(worker.request('trackExportPath', pathToFileURL(unrelated).href), /not available in the library/);
    const { statfs } = await import("node:fs/promises");const expected=await statfs(data);
    const disk = await worker.request<{totalBytes:number;freeBytes:number;usedBytes:number}>("fileSystem",{op:"diskStats"});
    assert.equal(disk.totalBytes,Number(expected.blocks)*Number(expected.bsize));
    assert.equal(disk.usedBytes+disk.freeBytes,disk.totalBytes);assert.ok(disk.freeBytes>0);
    const info=await worker.request<{exists:boolean;size:number}>("fileSystem",{op:"getInfo",uri});assert.equal(info.size,bytes.length);
    const inputs=[uri,physicalUri,file,data,join(directory,"missing.wav"),"mmplayer-media://track/missing","mmplayer-media://asset/%zz"];
    assert.deepEqual(await worker.request("fileSystem",{op:"checkFiles",uris:inputs}),[true,true,true,false,false,false,false]);
    await rename(file,file+".moved");
    assert.deepEqual(await worker.request("fileSystem",{op:"checkFiles",uris:[uri,physicalUri,file]}),[false,false,false]);
    assert.equal((await worker.request<{exists:boolean}>("fileSystem",{op:"getInfo",uri})).exists,false);
    assert.deepEqual(await worker.request("fileSystem",{op:"checkFiles",uris:[]}),[]);
    await assert.rejects(worker.request("fileSystem",{op:"checkFiles",uris:[null]}),/Invalid file list/);
  } finally {await worker.close();await cleanup(directory);}
});


test("pinned shortcuts persist and collaborator repair replaces stale credits without changing user metadata", async () => {
  const directory = await temporary(), data = join(directory, "data"), file = join(directory, "collaboration.mp3");
  await mkdir(data);
  await writeFile(file, await readFile(resolve("test/fixtures/tone.mp3")));
  await writeFileMetadata(file, { title: "Physical title", artist: "Primary; Guest; Primary", album: "Collaboration" });
  const worker = new LibraryWorkerClient(resolve("build/libraryWorker.cjs"), data, () => {});
  const bridge = { invoke: (command: string, input: unknown) => worker.request(command, input), on: () => () => {} } as unknown as DesktopBridge;
  const { database } = createDesktopDatabase(bridge);
  try {
    await worker.request("initialize"); await worker.request("importPaths", [file]);
    let snapshot = await worker.request<LibrarySnapshot>("library");
    const first = snapshot.tracks[0];
    assert.equal(first.artist, "Primary, Guest");
    const track = await database.get<Track>("tracks").find(first.id);
    const playlistId = await worker.request<string>("createPlaylist", { name: "Pinned list" });
    const playlist = await database.get<any>("playlists").find(playlistId);
    await database.write(async () => {
      await track.update(record => { record.title = "User title"; record.lyricsLRC = "[00:01]Kept"; record.rating = 4; });
      await playlist.update((record: any) => { record.isPinned = true; });
    });
    snapshot = await worker.request<LibrarySnapshot>("library");
    assert.equal(snapshot.playlists.find(item => item.id === playlistId)?.isPinned, true);
    await writeFileMetadata(file, { artist: "Primary; New Guest" });
    assert.equal(await worker.request("repairCollaborators"), 1);
    snapshot = await worker.request<LibrarySnapshot>("library");
    assert.equal(snapshot.tracks[0].artist, "Primary, New Guest");
    assert.equal(snapshot.tracks[0].title, "User title");
    assert.equal(snapshot.tracks[0].lyricsLRC, "[00:01]Kept"); assert.equal(snapshot.tracks[0].rating, 4);
    await worker.request("repairCollaborators");
    snapshot = await worker.request<LibrarySnapshot>("library"); assert.equal(snapshot.tracks[0].artist, "Primary, New Guest");
    await writeFileMetadata(file, { artist: "Primary" }); await worker.request("scan");
    snapshot = await worker.request<LibrarySnapshot>("library"); assert.equal(snapshot.tracks[0].artist, "Primary");
    const settings = new SettingsFile(data); await settings.load();
    const shortcuts = [{ kind: "tag" as const, id: "tag-1", name: "Etiqueta" }, { kind: "folder" as const, id: "file:///C:/Music", name: "Music" }];
    await settings.update({ pinnedShortcuts: shortcuts });
    assert.deepEqual((await new SettingsFile(data).load()).preferences.pinnedShortcuts, shortcuts);
    assert.deepEqual(normalizePreferences({ pinnedShortcuts: [shortcuts[0], shortcuts[0], null, { kind: "bad" }] as any }).pinnedShortcuts, [shortcuts[0]]);
  } finally { await worker.close(); await cleanup(directory); }
});


test("unsaved desktop documents block navigation and resume the exact confirmed transition", () => {
  const transitions: string[] = []; let confirm: (() => void) | undefined;
  const unregister = registerDesktopLeaveGuard(proceed => { confirm = proceed; });
  requestDesktopNavigation(() => transitions.push("back"));
  assert.equal(transitions.length, 0);
  // Cancelling simply leaves the transition pending; a new navigation request
  // must prompt again and confirm its own destination.
  requestDesktopNavigation(() => transitions.push("sidebar"));
  confirm!(); assert.deepEqual(transitions, ["sidebar"]);
  unregister(); requestDesktopNavigation(() => transitions.push("clean"));
  assert.deepEqual(transitions, ["sidebar", "clean"]);
});
