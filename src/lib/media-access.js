/**
 * May this user read this stored file?
 *
 * Source and clip files are namespaced by owner — `sources/{userId}/…` and
 * `clips/{userId}/…` — so the path itself says who owns them. Caption files
 * are keyed by clip (`captions/{clipId}.{lang}.ass`), so those need a lookup.
 *
 * @param {string} key storage key from the URL
 * @param {string} userId the signed-in user
 * @param {{clipOwner: (clipId: string) => Promise<string|null>}} lookups
 */
export async function canAccessKey(key, userId, { clipOwner }) {
  if (!userId || typeof key !== "string") return false;
  const [top, second, ...rest] = key.split("/");

  if (top === "sources" || top === "clips") {
    return second === userId && rest.length > 0;
  }

  if (top === "captions" && second && rest.length === 0) {
    const clipId = second.split(".")[0];
    return Boolean(clipId) && (await clipOwner(clipId)) === userId;
  }

  return false;
}
