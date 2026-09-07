import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { prisma } from "../lib/db.js";
import * as storage from "../lib/storage.js";
import { getProvider } from "../../src/lib/social/index.js";
import { decrypt, encrypt } from "../../src/lib/crypto.js";

/**
 * Upload one render to one connected account.
 *
 * The file is staged to disk first rather than piped straight from R2: the
 * upload needs an accurate Content-Length up front, and a stream that stalls
 * mid-flight would leave a half-finished post with no way to resume.
 */
export async function publish({ publicationId }) {
  const publication = await prisma.publication.findUnique({
    where: { id: publicationId },
    include: { render: true, socialAccount: true },
  });
  if (!publication) throw new Error(`Publication ${publicationId} not found`);

  // Idempotency: a retry after a successful upload must not post twice.
  if (publication.status === "PUBLISHED" || publication.externalId) {
    return { publicationId, deduplicated: true, externalId: publication.externalId };
  }

  const provider = getProvider(publication.socialAccount.provider);
  if (!provider) throw new Error(`Unknown provider ${publication.socialAccount.provider}`);

  await prisma.publication.update({
    where: { id: publicationId },
    data: { status: "UPLOADING" },
  });

  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "publish-"));

  try {
    const accessToken = await freshAccessToken(publication.socialAccount, provider);

    const localPath = path.join(dir, "clip.mp4");
    await storage.download(publication.render.storageKey, localPath);
    const { size } = await fs.promises.stat(localPath);

    const result = await provider.publish({
      accessToken,
      account: publication.socialAccount,
      videoStream: fs.createReadStream(localPath),
      sizeBytes: size,
      title: publication.title,
      description: publication.description,
      tags: Array.isArray(publication.tags) ? publication.tags : [],
      privacy: publication.privacy,
    });

    await prisma.publication.update({
      where: { id: publicationId },
      data: {
        status: result.status,
        externalId: result.externalId,
        externalUrl: result.externalUrl ?? null,
        publishedAt: result.status === "PUBLISHED" ? new Date() : null,
        error: null,
      },
    });

    return { publicationId, externalId: result.externalId, status: result.status };
  } catch (error) {
    await prisma.publication.update({
      where: { id: publicationId },
      data: { status: "FAILED", error: String(error.message).slice(0, 2000) },
    });

    if (error.needsReconnect) {
      await prisma.socialAccount.update({
        where: { id: publication.socialAccountId },
        data: { status: "NEEDS_RECONNECT", lastError: String(error.message).slice(0, 2000) },
      });
    }

    // Only a retryable failure goes back on the queue; a rejected title or a
    // revoked token will fail identically every time.
    if (error.retryable) throw error;

    return { publicationId, failed: true, reason: error.message };
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Refresh the stored token if it is close to expiry, and persist the new one. */
async function freshAccessToken(account, provider) {
  const marginMs = 5 * 60 * 1000;
  const valid = account.expiresAt && account.expiresAt.getTime() - Date.now() > marginMs;
  if (valid) return decrypt(account.accessToken);

  if (!account.refreshToken) {
    throw Object.assign(new Error("This connection needs to be re-authorized."), {
      needsReconnect: true,
    });
  }

  const refreshed = await provider.refreshAccessToken({
    refreshToken: decrypt(account.refreshToken),
  });

  await prisma.socialAccount.update({
    where: { id: account.id },
    data: {
      accessToken: encrypt(refreshed.accessToken),
      refreshToken: refreshed.refreshToken ? encrypt(refreshed.refreshToken) : undefined,
      expiresAt: refreshed.expiresAt ?? null,
      status: "ACTIVE",
      lastError: null,
    },
  });

  return refreshed.accessToken;
}

/**
 * Poll a post the platform is still transcoding.
 *
 * YouTube returns an id the moment the bytes land, but the video is not
 * watchable until it finishes processing — so "uploaded" is not "published".
 */
export async function checkPublicationStatus({ publicationId }) {
  const publication = await prisma.publication.findUnique({
    where: { id: publicationId },
    include: { socialAccount: true },
  });
  if (!publication?.externalId) return { publicationId, status: "PENDING" };
  if (publication.status !== "PROCESSING") {
    return { publicationId, status: publication.status };
  }

  const provider = getProvider(publication.socialAccount.provider);
  const accessToken = await freshAccessToken(publication.socialAccount, provider);

  const result = await provider.checkStatus({
    accessToken,
    externalId: publication.externalId,
  });

  await prisma.publication.update({
    where: { id: publicationId },
    data: {
      status: result.status,
      externalUrl: result.externalUrl ?? publication.externalUrl,
      publishedAt: result.status === "PUBLISHED" ? new Date() : null,
    },
  });

  return { publicationId, status: result.status };
}
