import type { FileSystemRequest } from "@mmplayer/platform";

export const documentDirectory = "mmplayer-media://asset/documents/";
export const cacheDirectory = "mmplayer-media://asset/app-cache/";
export const bundleDirectory = "mmplayer://app/";

export const EncodingType = {
  UTF8: "utf8",
  Base64: "base64",
} as const;

export const FileSystemSessionType = {
  BACKGROUND: 0,
  FOREGROUND: 1,
} as const;

export const FileSystemUploadType = {
  BINARY_CONTENT: 0,
  MULTIPART: 1,
} as const;

export interface FileInfo {
  exists: boolean;
  uri: string;
  size?: number;
  isDirectory: boolean;
  modificationTime?: number;
  md5?: string;
}

export interface FileSystemDownloadResult {
  uri: string;
  status: number;
  headers: Record<string, string>;
  mimeType?: string | null;
  md5?: string;
}

function invokeFS<T = unknown>(request: FileSystemRequest): Promise<T> {
  const bridge = (globalThis as any).window?.mmplayer;
  if (!bridge?.invoke) {
    throw new Error("Desktop fileSystem bridge is unavailable");
  }
  return bridge.invoke("fileSystem", request) as Promise<T>;
}

function isInlineOrBlobUri(uri: string): boolean {
  return uri.startsWith("blob:") || uri.startsWith("data:");
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(buffer).toString("base64");
  }
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// Pure JS MD5 (RFC 1321) for blob:/data: URIs in browser renderer
function computeMd5Hex(bytes: Uint8Array): string {
  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i++) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0;
  }
  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const origBitLen = bytes.length * 8;
  const padLen = ((56 - ((bytes.length + 1) % 64)) + 64) % 64;
  const totalLen = bytes.length + 1 + padLen + 8;
  const msg = new Uint8Array(totalLen);
  msg.set(bytes, 0);
  msg[bytes.length] = 0x80;
  const view = new DataView(msg.buffer);
  view.setUint32(totalLen - 8, origBitLen >>> 0, true);
  view.setUint32(totalLen - 4, Math.floor(origBitLen / 0x100000000) >>> 0, true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let offset = 0; offset < totalLen; offset += 64) {
    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;
    for (let i = 0; i < 64; i++) {
      let F = 0;
      let g = 0;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      const word = view.getUint32(offset + g * 4, true);
      const temp = D;
      D = C;
      C = B;
      const sum = (A + F + K[i] + word) >>> 0;
      const shift = S[i];
      const rotated = ((sum << shift) | (sum >>> (32 - shift))) >>> 0;
      B = (B + rotated) >>> 0;
      A = temp;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const out = new Uint8Array(16);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, a0, true);
  outView.setUint32(4, b0, true);
  outView.setUint32(8, c0, true);
  outView.setUint32(12, d0, true);
  return Array.from(out)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getInfoAsync(
  fileUri: string,
  options: { md5?: boolean; size?: boolean } = {},
): Promise<FileInfo> {
  if (!fileUri) {
    return { exists: false, isDirectory: false, uri: "" };
  }
  if (isInlineOrBlobUri(fileUri)) {
    try {
      const response = await fetch(fileUri);
      if (!response.ok) {
        return { exists: false, isDirectory: false, uri: fileUri };
      }
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const info: FileInfo = {
        exists: true,
        isDirectory: false,
        size: bytes.byteLength,
        modificationTime: Math.floor(Date.now() / 1000),
        uri: fileUri,
      };
      if (options.md5) {
        info.md5 = computeMd5Hex(bytes);
      }
      return info;
    } catch {
      return { exists: false, isDirectory: false, uri: fileUri };
    }
  }
  return invokeFS<FileInfo>({
    op: "getInfo",
    uri: fileUri,
    md5: Boolean(options.md5),
  });
}

export async function makeDirectoryAsync(
  fileUri: string,
  options: { intermediates?: boolean } = {},
): Promise<void> {
  await invokeFS({
    op: "makeDirectory",
    uri: fileUri,
    intermediates: options.intermediates !== false,
  });
}

export async function readDirectoryAsync(fileUri: string): Promise<string[]> {
  return invokeFS<string[]>({ op: "readDirectory", uri: fileUri });
}

export async function copyAsync(options: {
  from: string;
  to: string;
}): Promise<void> {
  if (isInlineOrBlobUri(options.from)) {
    if (options.from.startsWith("data:")) {
      const comma = options.from.indexOf(",");
      const base64 = comma >= 0 ? options.from.slice(comma + 1) : options.from;
      await invokeFS({ op: "writeBase64", uri: options.to, base64 });
      return;
    }
    const response = await fetch(options.from);
    if (!response.ok) {
      throw new Error(`Failed to read source blob URI: ${options.from}`);
    }
    const buffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    await invokeFS({ op: "writeBase64", uri: options.to, base64 });
    return;
  }
  await invokeFS({ op: "copy", from: options.from, to: options.to });
}

export async function moveAsync(options: {
  from: string;
  to: string;
}): Promise<void> {
  if (isInlineOrBlobUri(options.from)) {
    await copyAsync(options);
    return;
  }
  await invokeFS({ op: "move", from: options.from, to: options.to });
}

export async function deleteAsync(
  fileUri: string,
  options: { idempotent?: boolean } = {},
): Promise<void> {
  if (!fileUri) return;
  if (fileUri.startsWith("blob:")) {
    try {
      URL.revokeObjectURL(fileUri);
    } catch {
      // Ignore
    }
    return;
  }
  if (fileUri.startsWith("data:")) return;
  await invokeFS({
    op: "delete",
    uri: fileUri,
    idempotent: Boolean(options.idempotent),
  });
}

export async function readAsStringAsync(
  fileUri: string,
  options: { encoding?: "utf8" | "base64" | string } = {},
): Promise<string> {
  const encoding = options.encoding === "base64" ? "base64" : "utf8";
  if (isInlineOrBlobUri(fileUri)) {
    const response = await fetch(fileUri);
    if (encoding === "base64") {
      return arrayBufferToBase64(await response.arrayBuffer());
    }
    return response.text();
  }
  return invokeFS<string>({
    op: "readString",
    uri: fileUri,
    encoding,
  });
}

export async function writeAsStringAsync(
  fileUri: string,
  contents: string,
  options: { encoding?: "utf8" | "base64" | string } = {},
): Promise<void> {
  const encoding = options.encoding === "base64" ? "base64" : "utf8";
  await invokeFS({
    op: "writeString",
    uri: fileUri,
    contents,
    encoding,
  });
}

export async function downloadAsync(
  uri: string,
  fileUri: string,
  _options: Record<string, unknown> = {},
): Promise<FileSystemDownloadResult> {
  return invokeFS<FileSystemDownloadResult>({
    op: "download",
    url: uri,
    uri: fileUri,
  });
}

export async function getFreeDiskStorageAsync(): Promise<number> {
  return (await invokeFS<{ freeBytes: number }>({ op: "diskStats" })).freeBytes;
}

export async function getTotalDiskCapacityAsync(): Promise<number> {
  return (await invokeFS<{ totalBytes: number }>({ op: "diskStats" })).totalBytes;
}

export default {
  documentDirectory,
  cacheDirectory,
  bundleDirectory,
  EncodingType,
  FileSystemSessionType,
  FileSystemUploadType,
  getInfoAsync,
  makeDirectoryAsync,
  readDirectoryAsync,
  copyAsync,
  moveAsync,
  deleteAsync,
  readAsStringAsync,
  writeAsStringAsync,
  downloadAsync,
  getFreeDiskStorageAsync,
  getTotalDiskCapacityAsync,
};
