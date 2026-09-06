/**
 * SSRF protection for user-supplied URLs.
 *
 * Any URL that arrives from a client and is then fetched, or handed to a
 * third-party worker, must pass through here first. The previous
 * implementation guarded with `url.includes("youtube.com")`, which
 * `http://169.254.169.254/latest/meta-data/?x=youtube.com` satisfies.
 */

/** Hosts we are willing to make server-side requests to. */
const ALLOWED_SOURCE_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "tiktok.com",
  "www.tiktok.com",
  "vm.tiktok.com",
  "instagram.com",
  "www.instagram.com",
];

/** Literal hosts that are never allowed, whatever the allowlist says. */
const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.goog",
]);

/**
 * IPv4/IPv6 literals that resolve to the host, the local network, or a cloud
 * metadata service. Checked against the literal in the URL; DNS rebinding is
 * handled separately by the fetch layer (see safeFetch).
 */
function isPrivateAddress(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;

  // IPv6 loopback / link-local / unique-local
  if (host === "::1" || host === "::") return true;
  if (/^fe80:/i.test(host)) return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(host)) return true;

  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!v4) return false;

  const [a, b] = v4.slice(1).map(Number);
  if (v4.slice(1).some((o) => Number(o) > 255)) return true; // malformed → reject

  if (a === 0 || a === 10 || a === 127) return true;         // this-network, private, loopback
  if (a === 169 && b === 254) return true;                   // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;          // private
  if (a === 192 && b === 168) return true;                   // private
  if (a === 100 && b >= 64 && b <= 127) return true;         // carrier-grade NAT
  if (a >= 224) return true;                                 // multicast / reserved

  return false;
}

function hostMatches(hostname, allowed) {
  const host = hostname.toLowerCase();
  return allowed.some((a) => host === a || host.endsWith("." + a));
}

/**
 * Parse and validate a URL supplied by a client.
 *
 * @param {string} rawUrl
 * @param {{ allowedHosts?: string[], allowAnyHost?: boolean }} [options]
 * @returns {URL}
 * @throws {Error} with a message safe to return to the client
 */
export function assertSafeUrl(rawUrl, options = {}) {
  const { allowedHosts = ALLOWED_SOURCE_HOSTS, allowAnyHost = false } = options;

  if (typeof rawUrl !== "string" || rawUrl.length === 0 || rawUrl.length > 2048) {
    throw new Error("Invalid URL");
  }

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only http and https URLs are supported");
  }

  if (url.username || url.password) {
    throw new Error("URLs with embedded credentials are not allowed");
  }

  if (isPrivateAddress(url.hostname)) {
    throw new Error("This URL is not reachable");
  }

  if (!allowAnyHost && !hostMatches(url.hostname, allowedHosts)) {
    throw new Error(
      "Unsupported source. Provide a YouTube, TikTok, or Instagram link."
    );
  }

  return url;
}

/** True when the URL is a supported social/video source we can ingest. */
export function isSupportedSourceUrl(rawUrl) {
  try {
    assertSafeUrl(rawUrl);
    return true;
  } catch {
    return false;
  }
}

/** Which platform a source URL belongs to, or null. */
export function detectSource(rawUrl) {
  let url;
  try {
    url = assertSafeUrl(rawUrl);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (hostMatches(host, ["youtube.com", "youtu.be"])) return "YOUTUBE";
  if (hostMatches(host, ["tiktok.com"])) return "TIKTOK";
  if (hostMatches(host, ["instagram.com"])) return "INSTAGRAM";
  return null;
}

/**
 * fetch() with an SSRF check, a hard timeout, and redirects disabled so a
 * permitted host cannot bounce us to a private address.
 *
 * @param {string} rawUrl
 * @param {RequestInit & { timeoutMs?: number, allowedHosts?: string[], allowAnyHost?: boolean, maxRedirects?: number }} [init]
 */
export async function safeFetch(rawUrl, init = {}) {
  const {
    timeoutMs = 10_000,
    allowedHosts,
    allowAnyHost,
    maxRedirects = 3,
    ...rest
  } = init;

  let current = assertSafeUrl(rawUrl, { allowedHosts, allowAnyHost });

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res;
    try {
      res = await fetch(current, {
        ...rest,
        redirect: "manual",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status < 300 || res.status > 399) return res;

    const location = res.headers.get("location");
    if (!location) return res;

    // Re-validate every hop: this is what stops an allowed host from
    // redirecting us into the private network.
    current = assertSafeUrl(new URL(location, current).toString(), {
      allowedHosts,
      allowAnyHost,
    });
  }

  throw new Error("Too many redirects");
}

export { ALLOWED_SOURCE_HOSTS };
