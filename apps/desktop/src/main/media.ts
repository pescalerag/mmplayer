import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname } from "node:path";
import { Readable } from "node:stream";

export function parseByteRange(
  header: string | null,
  size: number,
): { start: number; end: number } | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || size === 0)
    throw Error("Invalid range");
  const start = match[1]
    ? Number(match[1])
    : Math.max(0, size - Number(match[2]));
  const end =
    match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start > end ||
    start >= size
  )
    throw Error("Invalid range");
  return { start, end };
}
export async function mediaResponse(
  request: Request,
  locate: (
    id: string,
    kind: "track" | "cover" | "asset",
  ) => Promise<string | null>,
): Promise<Response> {
  const url = new URL(request.url);
  if (
    !["GET", "HEAD"].includes(request.method) ||
    !["track", "cover", "asset"].includes(url.hostname)
  )
    return new Response(null, { status: 404 });
  let id: string;
  try {
    id = decodeURIComponent(url.pathname.slice(1));
  } catch {
    return new Response(null, { status: 400 });
  }
  if (url.hostname === "asset") {
    const segments = id.split("/").filter(Boolean);
    if (
      segments.length === 0 ||
      segments.some(
        (seg) =>
          seg === "." || seg === ".." || !/^[\w.-]{1,200}$/.test(seg),
      )
    )
      return new Response(null, { status: 404 });
    id = segments.join("/");
  } else if (!/^[\w-]{1,200}$/.test(id)) {
    return new Response(null, { status: 404 });
  }
  const path = await locate(id, url.hostname as "track" | "cover" | "asset");
  if (!path) return new Response(null, { status: 404 });
  try {
    const { size } = await stat(path);
    let range;
    try {
      range = parseByteRange(request.headers.get("range"), size);
    } catch {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }
    const types: Record<string, string> = {
      ".mp3": "audio/mpeg",
      ".flac": "audio/flac",
      ".ogg": "audio/ogg",
      ".opus": "audio/ogg",
      ".m4a": "audio/mp4",
      ".aac": "audio/aac",
      ".wav": "audio/wav",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".bmp": "image/bmp",
      ".mp4": "video/mp4",
      ".m4v": "video/mp4",
      ".webm": "video/webm",
      ".mov": "video/quicktime",
      ".mkv": "video/x-matroska",
      ".3gp": "video/3gpp",
    };
    const headers: Record<string, string> = {
      "Access-Control-Allow-Origin": "mmplayer://app",
      "Accept-Ranges": "bytes",
      "Content-Type":
        types[extname(path).toLowerCase()] || "application/octet-stream",
      "Content-Length": String(range ? range.end - range.start + 1 : size),
    };
    if (range)
      headers["Content-Range"] = `bytes ${range.start}-${range.end}/${size}`;
    const stream =
      request.method === "HEAD" || size === 0
        ? null
        : (Readable.toWeb(
            createReadStream(path, range || {}),
          ) as ReadableStream<Uint8Array>);
    return new Response(stream, { status: range ? 206 : 200, headers });
  } catch {
    return new Response(null, { status: 404 });
  }
}
