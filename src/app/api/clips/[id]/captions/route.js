import { prisma } from "@/lib/prisma";
import { buildSrt, buildVtt, buildAss } from "@/lib/captions";
import { ApiError, handler, requireUser } from "@/lib/api";

export const runtime = "nodejs";

const FORMATS = {
  srt: { build: buildSrt, contentType: "application/x-subrip; charset=utf-8", ext: "srt" },
  vtt: { build: buildVtt, contentType: "text/vtt; charset=utf-8", ext: "vtt" },
  ass: { build: buildAss, contentType: "text/plain; charset=utf-8", ext: "ass" },
};

/**
 * Download one clip's captions as a sidecar file.
 *
 * Generated on demand from the stored word timings rather than read from a
 * saved file: the transcript can be edited after a render, and a stale sidecar
 * that disagrees with the burned-in captions is worse than no sidecar.
 */
export const GET = handler("CLIP_CAPTIONS", async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const params = new URL(req.url).searchParams;
  const formatKey = (params.get("format") || "srt").toLowerCase();
  const format = FORMATS[formatKey];
  if (!format) throw new ApiError(400, "Format must be srt, vtt, or ass.");

  const clip = await prisma.clip.findFirst({
    where: { id, userId: user.id },
    include: { video: { include: { transcript: true } } },
  });
  if (!clip) throw new ApiError(404, "Clip not found.");
  if (!clip.video?.transcript) throw new ApiError(409, "This video has not been transcribed yet.");

  const words = Array.isArray(clip.video.transcript.words) ? clip.video.transcript.words : [];
  if (words.length === 0) throw new ApiError(409, "No word timings are available for this video.");

  const options = { clipStart: clip.startSec, clipEnd: clip.endSec };
  const body =
    formatKey === "ass"
      ? buildAss(words, {
          ...options,
          style: params.get("style") || "KARAOKE",
          aspectRatio: params.get("aspectRatio") || "RATIO_9_16",
        })
      : format.build(words, options);

  const safeName = (clip.title || "captions").replace(/[^\w\- ]+/g, "").trim() || "captions";

  return new Response(body, {
    headers: {
      "Content-Type": format.contentType,
      "Content-Disposition": `attachment; filename="${safeName}.${format.ext}"`,
      "Cache-Control": "no-store",
    },
  });
});
