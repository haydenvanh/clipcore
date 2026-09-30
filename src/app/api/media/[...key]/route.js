import { Readable } from "node:stream";
import { driver, statObject, readStream, safeFilename, CONTENT_TYPE_BY_EXTENSION } from "@/lib/storage";
import { parseRange } from "@/lib/range";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Only these top-level folders are ever served. */
const SERVABLE_PREFIXES = ["sources/", "clips/", "captions/"];

/**
 * Serve a stored object from local storage.
 *
 * Range requests are not optional here: <video> seeks by requesting byte
 * ranges, and Safari refuses to play a video at all from a server that ignores
 * them.
 */
export async function GET(req, { params }) {
  if (driver !== "local") {
    return new Response("Media is served from object storage in this configuration.", { status: 404 });
  }

  const { key: parts } = await params;
  const key = Array.isArray(parts) ? parts.map(decodeURIComponent).join("/") : "";

  if (!SERVABLE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
    return new Response("Not found", { status: 404 });
  }

  let stat;
  try {
    stat = await statObject(key);
  } catch {
    // localPath() throws for keys that escape the storage root.
    return new Response("Not found", { status: 404 });
  }
  if (!stat) return new Response("Not found", { status: 404 });

  const extension = key.split(".").pop().toLowerCase();
  const contentType = CONTENT_TYPE_BY_EXTENSION[extension] || "application/octet-stream";

  const url = new URL(req.url);
  const headers = new Headers({
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  });

  if (url.searchParams.get("download") === "1") {
    const name = safeFilename(url.searchParams.get("name") || key.split("/").pop());
    const withExtension = name.toLowerCase().endsWith(`.${extension}`) ? name : `${name}.${extension}`;
    headers.set("Content-Disposition", `attachment; filename="${withExtension}"`);
  }

  const range = parseRange(req.headers.get("range"), stat.size);

  if (range?.invalid) {
    headers.set("Content-Range", `bytes */${stat.size}`);
    return new Response(null, { status: 416, headers });
  }

  if (range) {
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${stat.size}`);
    headers.set("Content-Length", String(range.end - range.start + 1));
    return new Response(Readable.toWeb(readStream(key, range)), { status: 206, headers });
  }

  headers.set("Content-Length", String(stat.size));
  return new Response(Readable.toWeb(readStream(key)), { status: 200, headers });
}
