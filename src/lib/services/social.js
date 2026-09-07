import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import { getProvider, requireUsableProvider, SocialAuthError } from "@/lib/social";

/**
 * Connected-account lifecycle: store, refresh, revoke.
 *
 * Tokens are encrypted going in and decrypted only at the moment of use, so a
 * database dump does not hand over the ability to post to every connected
 * channel.
 */

/** Refresh this far before actual expiry, so a long upload cannot expire mid-flight. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export const SocialService = {
  /** Insert or update a connection. Reconnecting the same channel updates it. */
  async saveConnection(userId, providerId, account) {
    const data = {
      displayName: account.displayName ?? null,
      avatarUrl: account.avatarUrl ?? null,
      metadata: account.metadata ?? {},
      accessToken: encrypt(account.accessToken),
      refreshToken: account.refreshToken ? encrypt(account.refreshToken) : null,
      scope: account.scope ?? null,
      expiresAt: account.expiresAt ?? null,
      status: "ACTIVE",
      lastError: null,
    };

    return prisma.socialAccount.upsert({
      where: {
        userId_provider_externalId: {
          userId,
          provider: providerId,
          externalId: account.externalId,
        },
      },
      create: { userId, provider: providerId, externalId: account.externalId, ...data },
      update: {
        ...data,
        // Google omits the refresh token on re-consent sometimes; never
        // overwrite a good one with null.
        refreshToken: data.refreshToken ?? undefined,
      },
    });
  },

  /** Accounts for the connections UI. Never returns token material. */
  async listConnections(userId) {
    const accounts = await prisma.socialAccount.findMany({
      where: { userId },
      orderBy: { connectedAt: "desc" },
      select: {
        id: true, provider: true, externalId: true, displayName: true,
        avatarUrl: true, status: true, lastError: true, connectedAt: true,
        expiresAt: true, metadata: true,
      },
    });
    return accounts;
  },

  /**
   * A usable access token for this account, refreshing if it is close to
   * expiry. Every publish path goes through here rather than reading the
   * column directly.
   */
  async getAccessToken(accountId) {
    const account = await prisma.socialAccount.findUnique({ where: { id: accountId } });
    if (!account) throw new SocialAuthError("That connection no longer exists.");

    if (account.status === "REVOKED") {
      throw new SocialAuthError("This connection was revoked. Reconnect it to publish.", {
        provider: account.provider,
        needsReconnect: true,
      });
    }

    const stillValid =
      account.expiresAt && account.expiresAt.getTime() - Date.now() > REFRESH_MARGIN_MS;
    if (stillValid) {
      return { accessToken: decrypt(account.accessToken), account };
    }

    const provider = getProvider(account.provider);
    if (!provider || !account.refreshToken) {
      // No way to refresh — surface it as needing a reconnect rather than
      // letting the upload fail with a confusing 401 later.
      throw new SocialAuthError("Reconnect this account to keep publishing.", {
        provider: account.provider,
        needsReconnect: true,
      });
    }

    try {
      const refreshed = await provider.refreshAccessToken({
        refreshToken: decrypt(account.refreshToken),
      });

      const updated = await prisma.socialAccount.update({
        where: { id: accountId },
        data: {
          accessToken: encrypt(refreshed.accessToken),
          refreshToken: refreshed.refreshToken ? encrypt(refreshed.refreshToken) : undefined,
          expiresAt: refreshed.expiresAt ?? null,
          status: "ACTIVE",
          lastError: null,
        },
      });

      return { accessToken: refreshed.accessToken, account: updated };
    } catch (error) {
      if (error.needsReconnect) {
        await prisma.socialAccount.update({
          where: { id: accountId },
          data: { status: "NEEDS_RECONNECT", lastError: error.message.slice(0, 2000) },
        });
      }
      throw error;
    }
  },

  /** Revoke upstream where possible, then delete the row. */
  async disconnect(userId, accountId) {
    const account = await prisma.socialAccount.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) return { deleted: false };

    const provider = getProvider(account.provider);
    if (provider) {
      // Best effort: a provider that refuses to revoke must not stop the user
      // from disconnecting.
      await provider
        .revoke({ accessToken: decrypt(account.accessToken) })
        .catch((error) => console.warn("[SOCIAL] Revoke failed", account.provider, error.message));
    }

    await prisma.socialAccount.delete({ where: { id: accountId } });
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "social.disconnect",
        target: `${account.provider}:${account.externalId}`,
      },
    });

    return { deleted: true };
  },

  /**
   * Queue a render for publishing.
   *
   * Validates ownership, provider readiness, and the platform's own limits
   * before creating the row, so an impossible publish fails at the click
   * rather than deep inside a worker.
   */
  async createPublication(userId, { renderId, socialAccountId, title, description, tags, privacy }) {
    const [render, account] = await Promise.all([
      prisma.render.findFirst({
        where: { id: renderId, userId },
        include: { clip: { select: { title: true, startSec: true, endSec: true } } },
      }),
      prisma.socialAccount.findFirst({ where: { id: socialAccountId, userId } }),
    ]);

    if (!render) throw Object.assign(new Error("Clip not found."), { status: 404 });
    if (!render.storageKey) {
      throw Object.assign(new Error("That clip has not finished rendering."), { status: 409 });
    }
    if (!account) throw Object.assign(new Error("Connection not found."), { status: 404 });

    const provider = requireUsableProvider(account.provider);

    const check = provider.validateRender({
      durationSec: (render.clip?.endSec ?? 0) - (render.clip?.startSec ?? 0),
      sizeBytes: Number(render.sizeBytes ?? 0),
      aspectRatio: render.aspectRatio,
    });
    if (!check.ok) {
      throw Object.assign(new Error(check.reason), { status: 422 });
    }

    return prisma.publication.create({
      data: {
        userId,
        renderId,
        socialAccountId,
        title: title || render.clip?.title || "Untitled clip",
        description: description ?? null,
        tags: Array.isArray(tags) ? tags.slice(0, 15) : [],
        privacy: privacy || "public",
        status: "PENDING",
      },
    });
  },
};
