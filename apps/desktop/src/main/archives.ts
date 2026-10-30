import { createWriteStream } from "node:fs";
import { mkdir, readdir, lstat, statfs, rm } from "node:fs/promises";
import { basename, dirname, join, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { crc32 } from "node:zlib";
import * as yauzl from "yauzl";
import * as yazl from "yazl";

function safeName(name: string) {
  // Apply Windows rules on every host, including case-insensitive collisions.
  if (!name || name.includes("\\") || name.startsWith("/") || name.split("/").some(part => part &&
      (part === "." || part === ".." || /[<>:"|?*\x00-\x1f]/.test(part) || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))))
    throw Error("music_zip.unsafe_path");
}
async function openArchive(source: string) {
  const zip = await new Promise<yauzl.ZipFile>((resolve, reject) => yauzl.open(source, { lazyEntries: true, autoClose: false, strictFileNames: true }, (error, value) => error ? reject(error) : resolve(value!)));
  try {
    const entries = await new Promise<yauzl.Entry[]>((resolve, reject) => {
      const entries: yauzl.Entry[] = [], names = new Set<string>();
      zip.on("error", reject);
      zip.on("entry", (entry: yauzl.Entry) => {
        try {
          safeName(entry.fileName);
          const key = entry.fileName.replace(/\/$/, "").toLowerCase();
          if (names.has(key) || entries.length >= 100000 || (entry.generalPurposeBitFlag & 1) ||
              ((entry.externalFileAttributes >>> 16) & 0xf000) === 0xa000 || !Number.isSafeInteger(entry.uncompressedSize)) throw Error("music_zip.invalid_archive");
          names.add(key); entries.push(entry); zip.readEntry();
        } catch (error) { reject(error); }
      });
      zip.on("end", () => resolve(entries)); zip.readEntry();
    });
    const size = entries.reduce((sum, entry) => sum + entry.uncompressedSize, 0);
    if (!Number.isSafeInteger(size)) throw Error("music_zip.invalid_archive");
    return { zip, entries, size };
  } catch (error) { zip.close(); throw error; }
}
export async function archiveSize(source: string) {
  const archive = await openArchive(source); archive.zip.close(); return archive.size;
}
export async function extractArchive(source: string, target: string, progress = (_done: number, _total: number) => {}) {
  const archive = await openArchive(source);
  try {
    await mkdir(target, { recursive: true });
    const disk = await statfs(target);
    if (archive.size > Number(disk.bavail) * Number(disk.bsize)) throw Error("music_zip.not_enough_space");
    let done = 0;
    const total = archive.entries.filter(item => !item.fileName.endsWith("/")).length;
    for (const entry of archive.entries) {
      const destination = resolve(target, entry.fileName), root = resolve(target);
      if (!destination.startsWith(root + sep)) throw Error("music_zip.unsafe_path");
      if (entry.fileName.endsWith("/")) { await mkdir(destination, { recursive: true }); continue; }
      await mkdir(dirname(destination), { recursive: true });
      // Exclusive creation prevents overwriting files or following pre-existing links.
      const stream = await new Promise<NodeJS.ReadableStream>((resolve, reject) => archive.zip.openReadStream(entry, (error, stream) => error ? reject(error) : resolve(stream!)));
      let checksum = 0;
      const verify = new Transform({ transform(chunk, _encoding, callback) { checksum = crc32(chunk, checksum); callback(null, chunk); } });
      await pipeline(stream, verify, createWriteStream(destination, { flags: "wx" }));
      if (checksum !== entry.crc32) { await rm(destination, { force: true }); throw Error("music_zip.invalid_archive"); }
      progress(++done, total);
    }
    return { files: total };
  } finally { archive.zip.close(); }
}
export async function createArchive(sources: string[], target: string) {
  const zip = new yazl.ZipFile();
  await mkdir(dirname(target), { recursive: true });
  async function add(path: string, name: string) {
    const info = await lstat(path);
    if (info.isSymbolicLink()) throw Error("Cannot archive symbolic links");
    if (info.isDirectory()) {
      for (const child of await readdir(path)) await add(join(path, child), name ? name + "/" + child : child);
    } else if (info.isFile()) { safeName(name); zip.addFile(path, name); }
  }
  for (const path of sources) await add(path, sources.length === 1 && (await lstat(path)).isDirectory() ? "" : basename(path));
  const output = createWriteStream(target, { flags: "wx" });
  zip.on("error", error => (zip.outputStream as import("node:stream").Readable).destroy(error));
  const complete = pipeline(zip.outputStream, output); zip.end();
  try { await complete; } catch (error) { await rm(target, { force: true }); throw error; }
}
