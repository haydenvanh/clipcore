import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { CreditService } from "./credits";
import config from "@/lib/config";
import { assertSafeUrl, safeFetch } from "@/lib/url-guard";

const DEFAULT_DURATION_SECONDS = 300;
const MAX_HIGHLIGHTS = 60;
const YT_DOWNLOAD_COST = 5;

/**
 * MuAPI-backed clipping provider.
 *
 * This is the `muapi` implementation of the provider seam described in
 * docs/02-ROADMAP.md D1. It stays the default so nothing regresses while the
 * native worker is built; the interface (submit → request id → webhook/poll)
 * is what the native provider will also implement.
 */
export const AIService = {
  /**
   * Best-effort YouTube duration lookup.
   *
   * Fetches through safeFetch, which enforces the host allowlist, blocks
   * private/link-local addresses, and re-validates every redirect hop. The
   * old version fetched any string containing "youtube.com" anywhere, so
   * `http://169.254.169.254/?x=youtube.com` reached cloud metadata.
   */
  async getYoutubeDuration(url) {
    try {
      const response = await safeFetch(url, { timeoutMs: 8000 });
      if (!response.ok) return null;
      const text = await response.text();
      const match = text.match(/"lengthSeconds":"(\d+)"/);
      if (match && match[1]) {
        const seconds = parseInt(match[1], 10);
        if (Number.isFinite(seconds) && seconds > 0) return seconds;
      }
      return null;
    } catch (error) {
      console.warn("[GET_YT_DURATION]", error.message);
      return null;
    }
  },

  /**
   * Estimated credit cost for a clipping job.
   *
   * Estimated, not final: when the duration cannot be read we fall back to a
   * nominal 5 minutes, which under-charges long videos. The real fix is
   * ffprobe in the worker settling the hold against actual minutes processed
   * (roadmap D4); until then this is a documented cost leak, tracked as V6.
   */
  async calculateClippingCost(video_url, num_highlights) {
    assertSafeUrl(video_url, { allowAnyHost: true });

    const highlights = this.normalizeHighlights(num_highlights);

    let durationSeconds = null;
    let estimated = true;

    try {
      const url = new URL(video_url);
      const host = url.hostname.toLowerCase();
      if (/(^|\.)(youtube\.com|youtu\.be)$/.test(host)) {
        durationSeconds = await this.getYoutubeDuration(video_url);
        estimated = durationSeconds === null;
      }
    } catch {
      /* assertSafeUrl already validated it; nothing to do */
    }

    const seconds = durationSeconds ?? DEFAULT_DURATION_SECONDS;
    const minutes = Math.max(1, Math.round(seconds / 60));
    const costDollars = minutes * 0.05 + highlights * 0.05;

    return {
      cost: Math.round(costDollars * 200),
      durationSeconds: seconds,
      estimated,
    };
  },

  normalizeHighlights(value) {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n)) return 3;
    return Math.min(MAX_HIGHLIGHTS, Math.max(1, n));
  },

  /** POST a job to MuAPI and return its request id. */
  async submitToMuapi(endpoint, payload) {
    const apiKey = config.ai.aiclips.apiKey;
    if (!apiKey) throw new Error("AICLIPS_API_KEY is not configured");

    const webhookUrl = new URL(
      "/api/webhook/muapi",
      config.auth.webhook_url
    );
    if (config.ai.aiclips.webhookSecret) {
      webhookUrl.searchParams.set("token", config.ai.aiclips.webhookSecret);
    }

    const submitUrl = `${endpoint}?webhook=${encodeURIComponent(webhookUrl.toString())}`;

    const res = await fetch(submitUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Provider request failed: ${res.status} ${errorText}`);
    }

    const data = await res.json();
    const requestId = data.request_id || data.id;
    if (!requestId) throw new Error("No request_id received from provider");

    return { data, requestId };
  },

  /** Pull the media URLs out of a MuAPI payload, whatever shape it arrived in. */
  extractMediaUrls(data) {
    if (Array.isArray(data.outputs)) return data.outputs;
    if (data.url) return [data.url];
    if (data.video_url) return [data.video_url];
    if (data.download_url) return [data.download_url];
    return [];
  },

  /**
   * Download a source video from YouTube.
   *
   * Credits are debited atomically and refunded if the provider rejects the
   * job, so a provider outage no longer silently burns the user's balance.
   */
  async youtubeDownload(userId, { video_url, format = "720" }) {
    assertSafeUrl(video_url); // strict allowlist: YouTube/TikTok/Instagram only

    // Allocated before the hold so the hold and any later refund share one
    // reference — the provider's request id does not exist yet.
    const requestKey = randomUUID();
    const cost = YT_DOWNLOAD_COST;
    await CreditService.hold(userId, cost, { refType: "creation", refId: requestKey });

    let submission;
    try {
      submission = await this.submitToMuapi(config.ai.aiclips.youtubeEndpoint, {
        video_url,
        format,
      });
    } catch (error) {
      await CreditService.refund(userId, cost, { refType: "creation", refId: requestKey, description: "Provider rejected the job" });
      throw error;
    }

    const { data, requestId } = submission;
    const isCompleted = data.status === "completed" || data.status === "succeeded";
    const isFailed = data.status === "failed";
    const mediaUrls = isCompleted ? this.extractMediaUrls(data) : [];

    if (isFailed) {
      await CreditService.refund(userId, cost, { refType: "creation", refId: requestKey, description: "Provider returned failed" });
    }

    await prisma.creation.create({
      data: {
        userId,
        type: "youtube_download",
        resolution: format,
        requestId,
        creditsCharged: cost,
        status: isCompleted ? "completed" : isFailed ? "failed" : "processing",
        resultUrl: isCompleted ? JSON.stringify(mediaUrls) : null,
        error: isFailed ? data.error || "Generation failed" : null,
      },
    });

    if (isCompleted) {
      return { request_id: requestId, status: "completed", clips: mediaUrls };
    }
    return { request_id: requestId, status: "processing" };
  },

  /** Submit an AI clipping job for an already-resolved video URL. */
  async aiClipping(userId, { video_url, num_highlights = 3, aspect_ratio = "9:16" }) {
    // The clipping tab receives a direct media URL (often a provider CDN
    // link), so the host allowlist does not apply — but private addresses,
    // embedded credentials, and non-HTTP schemes are still rejected.
    assertSafeUrl(video_url, { allowAnyHost: true });

    const requestKey = randomUUID();
    const highlights = this.normalizeHighlights(num_highlights);
    const { cost } = await this.calculateClippingCost(video_url, highlights);

    await CreditService.hold(userId, cost, { refType: "creation", refId: requestKey });

    let submission;
    try {
      submission = await this.submitToMuapi(config.ai.aiclips.clippingEndpoint, {
        video_url,
        num_highlights: highlights,
        aspect_ratio,
      });
    } catch (error) {
      await CreditService.refund(userId, cost, { refType: "creation", refId: requestKey, description: "Provider rejected the job" });
      throw error;
    }

    const { data, requestId } = submission;
    const isCompleted = data.status === "completed" || data.status === "succeeded";
    const isFailed = data.status === "failed";
    const mediaUrls = isCompleted ? this.extractMediaUrls(data) : [];

    if (isFailed) {
      await CreditService.refund(userId, cost, { refType: "creation", refId: requestKey, description: "Provider returned failed" });
    }

    await prisma.creation.create({
      data: {
        userId,
        type: "ai_clipping",
        aspectRatio: aspect_ratio,
        numClips: highlights,
        requestId,
        creditsCharged: cost,
        status: isCompleted ? "completed" : isFailed ? "failed" : "processing",
        resultUrl: isCompleted ? JSON.stringify(mediaUrls) : null,
        error: isFailed ? data.error || "Generation failed" : null,
      },
    });

    if (isCompleted) {
      return { request_id: requestId, status: "completed", clips: mediaUrls };
    }
    return { request_id: requestId, status: "processing" };
  },

  /**
   * Status of one job, scoped to its owner.
   *
   * `userId` is required: the previous version looked the row up by
   * requestId alone, so any caller who knew a request id could read another
   * user's result URLs.
   */
  async checkStatus(requestId, userId) {
    if (!userId) throw new Error("checkStatus requires a userId");

    const creation = await prisma.creation.findFirst({
      where: { requestId, userId },
    });

    if (!creation) return { status: "not_found" };

    if (creation.status === "completed") {
      return { status: "completed", clips: this.parseResultUrls(creation.resultUrl) };
    }

    if (creation.status === "failed") {
      return { status: "failed", error: creation.error || "Generation failed." };
    }

    // Webhooks do not reach localhost, so fall back to polling the provider.
    const resolved = await this.pollProvider(creation);
    return resolved ?? { status: "processing" };
  },

  parseResultUrls(resultUrl) {
    if (!resultUrl) return [];
    try {
      const parsed = JSON.parse(resultUrl);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [resultUrl];
    }
  },

  /** Ask MuAPI directly whether a still-processing job has finished. */
  async pollProvider(creation) {
    const apiKey = config.ai.aiclips.apiKey;
    if (!apiKey) return null;

    try {
      const res = await fetch(
        `${config.ai.aiclips.baseUrl}/predictions/${encodeURIComponent(creation.requestId)}/result`,
        { headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(10_000) }
      );
      if (!res.ok) return null;

      const data = await res.json();
      const isCompleted = data.status === "completed" || data.status === "succeeded";
      const isFailed = data.status === "failed";

      if (isCompleted) {
        const mediaUrls = this.extractMediaUrls(data);
        await prisma.creation.update({
          where: { id: creation.id },
          data: { status: "completed", resultUrl: JSON.stringify(mediaUrls) },
        });
        return { status: "completed", clips: mediaUrls };
      }

      if (isFailed) {
        const message = data.error || "Generation failed";
        await prisma.creation.update({
          where: { id: creation.id },
          data: { status: "failed", error: message },
        });
        await CreditService.refund(creation.userId, creation.creditsCharged ?? 0, { refType: "creation", refId: creation.requestId, description: "Job failed" });
        return { status: "failed", error: message };
      }
    } catch (error) {
      console.warn("[POLL_PROVIDER]", error.message);
    }

    return null;
  },
};
