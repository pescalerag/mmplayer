import { open, stat } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";

export interface ReplayGainTags {
  gain: number | null;
  peak: number | null;
  readSucceeded?: boolean;
}

const MAX_METADATA = 32 * 1024 * 1024;

function acceptTag(tags: ReplayGainTags, key: string, value: string) {
  const cleaned = value
    .trim()
    .replace(/\s*dB$/i, "")
    .trim()
    .replace(/\0+$/, "");
  if (!cleaned) return;
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return;
  const normKey = key.trim().toUpperCase();
  if (normKey === "REPLAYGAIN_TRACK_GAIN") {
    tags.gain = num;
  } else if (normKey === "REPLAYGAIN_TRACK_PEAK") {
    if (num > 0) tags.peak = num;
  } else if (normKey === "REPLAYGAIN_ALBUM_GAIN") {
    if (tags.gain === null) tags.gain = num;
  } else if (normKey === "REPLAYGAIN_ALBUM_PEAK") {
    if (tags.peak === null && num > 0) tags.peak = num;
  }
}

function synchsafe(buf: Buffer, offset: number): number {
  return (
    ((buf[offset] & 127) << 21) |
    ((buf[offset + 1] & 127) << 14) |
    ((buf[offset + 2] & 127) << 7) |
    (buf[offset + 3] & 127)
  );
}

function deUnsync(buf: Buffer): Buffer {
  const out: number[] = [];
  let i = 0;
  while (i < buf.length) {
    const val = buf[i++];
    out.push(val);
    if (val === 0xff && i < buf.length && buf[i] === 0x00) {
      i++;
    }
  }
  return Buffer.from(out);
}

function decodeId3String(buf: Buffer, encoding: number): string {
  if (encoding === 1) {
    if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
      const swapped = Buffer.allocUnsafe(buf.length - 2);
      for (let i = 2; i + 1 < buf.length; i += 2) {
        swapped[i - 2] = buf[i + 1];
        swapped[i - 1] = buf[i];
      }
      return swapped.toString("utf16le");
    }
    if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
      return buf.subarray(2).toString("utf16le");
    }
    return buf.toString("utf16le");
  }
  if (encoding === 2) {
    const swapped = Buffer.allocUnsafe(buf.length - (buf.length % 2));
    for (let i = 0; i + 1 < buf.length; i += 2) {
      swapped[i] = buf[i + 1];
      swapped[i + 1] = buf[i];
    }
    return swapped.toString("utf16le");
  }
  if (encoding === 3) {
    return buf.toString("utf8");
  }
  return buf.toString("latin1");
}

function readId3Buffer(buf: Buffer, tags: ReplayGainTags): boolean {
  if (buf.length < 10) return false;
  const version = buf[3];
  if (version !== 3 && version !== 4) return true;
  const size = synchsafe(buf, 6);
  if (size < 1 || size > MAX_METADATA || size > buf.length - 10) return false;
  let payload: Buffer = Buffer.from(buf.subarray(10, 10 + size));
  if (version === 3 && (buf[5] & 128) !== 0) {
    payload = deUnsync(payload);
  }
  let pos = 0;
  if ((buf[5] & 64) !== 0) {
    if (payload.length < 4) return false;
    const extSize =
      version === 4 ? synchsafe(payload, 0) : payload.readInt32BE(0) + 4;
    if (extSize < 4 || extSize > payload.length) return false;
    pos = extSize;
  }
  while (pos + 10 <= payload.length) {
    const id = payload.subarray(pos, pos + 4).toString("ascii");
    const length =
      version === 4
        ? synchsafe(payload, pos + 4)
        : payload.readInt32BE(pos + 4);
    const flags = payload[pos + 9] & 255;
    pos += 10;
    if (length <= 0 || length > payload.length - pos) break;
    if (
      id !== "TXXX" ||
      (version === 3 && (flags & 0xe0) !== 0) ||
      (version === 4 && (flags & 0x4d) !== 0)
    ) {
      pos += length;
      continue;
    }
    let body: Buffer = Buffer.from(payload.subarray(pos, pos + length));
    pos += length;
    if (version === 4 && ((flags & 2) !== 0 || (buf[5] & 128) !== 0)) {
      body = deUnsync(body);
    }
    if (body.length < 2) continue;
    const encoding = body[0];
    const wide = encoding === 1 || encoding === 2;
    let end = 1;
    while (
      end < body.length &&
      !(
        body[end] === 0 &&
        (!wide || (end + 1 < body.length && body[end + 1] === 0))
      )
    ) {
      end += wide ? 2 : 1;
    }
    const start = end + (wide ? 2 : 1);
    if (start >= body.length) continue;
    const key = decodeId3String(body.subarray(1, end), encoding);
    const val = decodeId3String(body.subarray(start), encoding).replace(
      /\0+$/,
      "",
    );
    acceptTag(tags, key, val);
  }
  return true;
}

function readCommentsBuffer(bytes: Buffer, tags: ReplayGainTags) {
  if (bytes.length < 8) return;
  const vendorSize = bytes.readInt32LE(0);
  if (vendorSize < 0 || vendorSize > bytes.length - 8) return;
  let pos = 4 + vendorSize;
  const count = bytes.readInt32LE(pos);
  pos += 4;
  if (count < 0) return;
  const maxCount = Math.min(count, Math.floor(bytes.length / 4));
  for (let i = 0; i < maxCount; i++) {
    if (pos + 4 > bytes.length) return;
    const size = bytes.readInt32LE(pos);
    pos += 4;
    if (size < 0 || size > bytes.length - pos) return;
    const comment = bytes.subarray(pos, pos + size).toString("utf8");
    pos += size;
    const sep = comment.indexOf("=");
    if (sep > 0) {
      acceptTag(tags, comment.slice(0, sep), comment.slice(sep + 1));
    }
  }
}

function readFlacBuffer(buf: Buffer, tags: ReplayGainTags): boolean {
  if (buf.length < 8) return false;
  let pos = 4;
  while (pos + 4 <= buf.length) {
    const header = buf[pos];
    const length =
      (buf[pos + 1] << 16) | (buf[pos + 2] << 8) | buf[pos + 3];
    pos += 4;
    if (length > buf.length - pos) return false;
    if ((header & 127) === 4) {
      readCommentsBuffer(buf.subarray(pos, pos + length), tags);
    }
    pos += length;
    if ((header & 128) !== 0) return true;
  }
  return true;
}

function readOggBuffer(buf: Buffer, tags: ReplayGainTags): boolean {
  if (buf.length < 27) return false;
  let pos = 0;
  const chunks: Buffer[] = [];
  let totalPacketSize = 0;
  let serial: number | null = null;
  const limit = Math.min(buf.length, MAX_METADATA);
  while (pos < limit) {
    if (pos + 27 > buf.length) return false;
    if (buf.subarray(pos, pos + 4).toString("ascii") !== "OggS") return true;
    const pageSerial = buf.readInt32LE(pos + 14);
    if (serial === null) serial = pageSerial;
    const numSegments = buf[pos + 26] & 255;
    pos += 27;
    if (pos + numSegments > buf.length) return false;
    const lacing = buf.subarray(pos, pos + numSegments);
    pos += numSegments;
    for (let i = 0; i < lacing.length; i++) {
      const segLen = lacing[i] & 255;
      if (pos + segLen > buf.length) return false;
      const segment = buf.subarray(pos, pos + segLen);
      pos += segLen;
      if (pageSerial !== serial) continue;
      chunks.push(segment);
      totalPacketSize += segLen;
      if (totalPacketSize > MAX_METADATA) return true;
      if (segLen < 255) {
        const packet = Buffer.concat(chunks);
        chunks.length = 0;
        totalPacketSize = 0;
        const prefix = packet.subarray(0, 8).toString("ascii");
        const offset =
          prefix === "OpusTags"
            ? 8
            : prefix.startsWith("\x03vorbis")
              ? 7
              : 0;
        if (offset > 0) {
          readCommentsBuffer(packet.subarray(offset), tags);
          return true;
        }
      }
    }
  }
  return true;
}

function readMp4FreeformBuffer(
  buf: Buffer,
  start: number,
  end: number,
  tags: ReplayGainTags,
) {
  let position = start;
  let domain: string | null = null;
  let name: string | null = null;
  let value: string | null = null;
  while (position <= end - 8) {
    let size = buf.readUInt32BE(position);
    const type = buf.subarray(position + 4, position + 8).toString("latin1");
    let headerSize = 8;
    if (size === 1) {
      if (position > end - 16) return;
      size = Number(buf.readBigInt64BE(position + 8));
      headerSize = 16;
    } else if (size === 0) {
      size = end - position;
    }
    if (size < headerSize || size > end - position) return;
    const skip = type === "data" ? 8 : 4;
    const length = size - headerSize - skip;
    if (
      (type === "mean" || type === "name" || type === "data") &&
      length >= 0 &&
      length <= MAX_METADATA
    ) {
      const text = buf
        .subarray(position + headerSize + skip, position + headerSize + skip + length)
        .toString("utf8")
        .replace(/\0+$/, "");
      if (type === "mean") domain = text;
      else if (type === "name") name = text;
      else if (type === "data") value = text;
    }
    position += size;
  }
  if (domain === "com.apple.iTunes" && name !== null && value !== null) {
    acceptTag(tags, name, value);
  }
}

function readMp4Buffer(
  buf: Buffer,
  start: number,
  end: number,
  tags: ReplayGainTags,
  depth = 0,
): boolean {
  if (depth > 8) return true;
  if (end < 8 && depth === 0) return false;
  let position = start;
  while (position <= end - 8) {
    let size = buf.readUInt32BE(position);
    const type = buf.subarray(position + 4, position + 8).toString("latin1");
    let headerSize = 8;
    if (size === 1) {
      if (position > end - 16) return true;
      const bigSize = buf.readBigInt64BE(position + 8);
      size = Number(bigSize);
      headerSize = 16;
    } else if (size === 0) {
      size = end - position;
    }
    if (size < headerSize || size > end - position) return true;
    const body = position + headerSize;
    const atomEnd = position + size;
    if (type === "moov" || type === "udta" || type === "ilst") {
      readMp4Buffer(buf, body, atomEnd, tags, depth + 1);
    } else if (type === "meta") {
      if (atomEnd - body >= 4) {
        readMp4Buffer(buf, body + 4, atomEnd, tags, depth + 1);
      }
    } else if (type === "----") {
      readMp4FreeformBuffer(buf, body, atomEnd, tags);
    }
    position = atomEnd;
  }
  return true;
}

export function readReplayGainFromBuffer(buf: Buffer): ReplayGainTags {
  const tags: ReplayGainTags = { gain: null, peak: null, readSucceeded: true };
  if (buf.length < 4) {
    tags.readSucceeded = false;
    return tags;
  }
  try {
    const magic3 = buf.subarray(0, 3).toString("ascii");
    const magic4 = buf.subarray(0, 4).toString("ascii");
    let ok = true;
    if (magic3 === "ID3") {
      ok = readId3Buffer(buf, tags);
    } else if (magic4 === "fLaC") {
      ok = readFlacBuffer(buf, tags);
    } else if (magic4 === "OggS") {
      ok = readOggBuffer(buf, tags);
    } else {
      ok = readMp4Buffer(buf, 0, buf.length, tags, 0);
    }
    tags.readSucceeded = ok;
  } catch {
    tags.readSucceeded = false;
  }
  return tags;
}

async function readMp4File(
  handle: FileHandle,
  start: number,
  end: number,
  tags: ReplayGainTags,
  depth = 0,
): Promise<void> {
  if (depth > 8) return;
  let position = start;
  const header = Buffer.allocUnsafe(16);
  while (position <= end - 8) {
    const { bytesRead } = await handle.read(header, 0, 8, position);
    if (bytesRead < 8) return;
    let size = header.readUInt32BE(0);
    const type = header.subarray(4, 8).toString("latin1");
    let headerSize = 8;
    if (size === 1) {
      if (position > end - 16) return;
      const ext = await handle.read(header, 8, 8, position + 8);
      if (ext.bytesRead < 8) return;
      size = Number(header.readBigInt64BE(8));
      headerSize = 16;
    } else if (size === 0) {
      size = end - position;
    }
    if (size < headerSize || size > end - position) return;
    const body = position + headerSize;
    const atomEnd = position + size;
    if (type === "moov" || type === "udta" || type === "ilst") {
      await readMp4File(handle, body, atomEnd, tags, depth + 1);
    } else if (type === "meta") {
      if (atomEnd - body >= 4) {
        await readMp4File(handle, body + 4, atomEnd, tags, depth + 1);
      }
    } else if (type === "----") {
      const len = atomEnd - body;
      if (len > 0 && len <= MAX_METADATA) {
        const atomBuf = Buffer.allocUnsafe(len);
        const res = await handle.read(atomBuf, 0, len, body);
        if (res.bytesRead === len) {
          readMp4FreeformBuffer(atomBuf, 0, len, tags);
        }
      }
    }
    position = atomEnd;
  }
}

export async function readReplayGainTags(
  filePath: string,
): Promise<ReplayGainTags> {
  const tags: ReplayGainTags = { gain: null, peak: null, readSucceeded: true };
  let handle: FileHandle | undefined;
  try {
    handle = await open(filePath, "r");
    const info = await handle.stat();
    if (info.size < 4) {
      tags.readSucceeded = false;
      return tags;
    }
    const magic = Buffer.allocUnsafe(10);
    const { bytesRead } = await handle.read(magic, 0, Math.min(10, info.size), 0);
    if (bytesRead < 4) {
      tags.readSucceeded = false;
      return tags;
    }
    const magic3 = magic.subarray(0, 3).toString("ascii");
    const magic4 = magic.subarray(0, 4).toString("ascii");
    if (magic3 === "ID3") {
      if (bytesRead < 10) {
        tags.readSucceeded = false;
        return tags;
      }
      const size = synchsafe(magic, 6);
      if (size < 1 || size > MAX_METADATA || 10 + size > info.size) {
        tags.readSucceeded = false;
        return tags;
      }
      const full = Buffer.allocUnsafe(10 + size);
      magic.copy(full, 0, 0, 10);
      const bodyRead = await handle.read(full, 10, size, 10);
      if (bodyRead.bytesRead < size) {
        tags.readSucceeded = false;
        return tags;
      }
      tags.readSucceeded = readId3Buffer(full, tags);
    } else if (magic4 === "fLaC" || magic4 === "OggS") {
      const readLen = Math.min(info.size, MAX_METADATA);
      const buf = Buffer.allocUnsafe(readLen);
      const res = await handle.read(buf, 0, readLen, 0);
      const slice = buf.subarray(0, res.bytesRead);
      tags.readSucceeded =
        magic4 === "fLaC"
          ? readFlacBuffer(slice, tags)
          : readOggBuffer(slice, tags);
    } else {
      await readMp4File(handle, 0, info.size, tags, 0);
    }
  } catch {
    tags.readSucceeded = false;
  } finally {
    await handle?.close().catch(() => {});
  }
  return tags;
}

export class ReplayGainScanCache {
  private static readonly VERSION = "1";
  constructor(
    private readonly get: (key: string) => string | undefined | null,
    private readonly put: (key: string, value: string) => void,
    private readonly reader: (path: string) => Promise<ReplayGainTags> = readReplayGainTags,
  ) {}

  async read(filePath: string): Promise<ReplayGainTags> {
    let modified = 0;
    let size = 0;
    let cacheable = false;
    try {
      const info = await stat(filePath);
      modified = Math.trunc(info.mtimeMs);
      size = info.size;
      cacheable = modified > 0 && size > 0 && info.isFile();
    } catch {
      cacheable = false;
    }

    if (cacheable) {
      const cached = this.get(filePath);
      const fields = cached?.split("|");
      if (
        fields &&
        fields.length === 5 &&
        fields[0] === ReplayGainScanCache.VERSION &&
        Number(fields[1]) === modified &&
        Number(fields[2]) === size
      ) {
        const parsedGain = Number(fields[3]);
        const gain =
          fields[3] !== "null" && Number.isFinite(parsedGain)
            ? parsedGain
            : null;
        const parsedPeak = Number(fields[4]);
        const peak =
          fields[4] !== "null" && Number.isFinite(parsedPeak) && parsedPeak > 0
            ? parsedPeak
            : null;
        if (
          (fields[3] === "null" || gain !== null) &&
          (fields[4] === "null" || peak !== null)
        ) {
          return { gain, peak, readSucceeded: true };
        }
      }
    }

    const tags = await this.reader(filePath);
    if (cacheable && tags.readSucceeded !== false) {
      try {
        const after = await stat(filePath);
        if (Math.trunc(after.mtimeMs) === modified && after.size === size) {
          this.put(
            filePath,
            `${ReplayGainScanCache.VERSION}|${modified}|${size}|${tags.gain}|${tags.peak}`,
          );
        }
      } catch {
        // Ignore stat race
      }
    }
    return tags;
  }
}
