import { createCipheriv, createDecipheriv, randomBytes, createHash, timingSafeEqual } from "node:crypto";

/**
 * Symmetric encryption for OAuth tokens at rest.
 *
 * A stolen database dump should not hand the attacker the ability to post to
 * every connected YouTube channel. Tokens are therefore encrypted with a key
 * that lives only in the environment, not in Postgres.
 *
 * AES-256-GCM because it authenticates as well as encrypts: a tampered
 * ciphertext fails to decrypt instead of silently yielding garbage.
 *
 * Format: v1.<iv>.<authTag>.<ciphertext>, all base64url. The version prefix is
 * what makes key rotation possible later without guessing at old rows.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits, the GCM standard
const VERSION = "v1";

let cachedKey = null;

function getKey() {
  if (cachedKey) return cachedKey;

  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32"
    );
  }

  // Accept base64 or hex; derive a 32-byte key either way. A short or
  // mistyped key must fail loudly rather than silently weakening encryption.
  let key;
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    key = Buffer.from(raw, "hex");
  } else {
    key = Buffer.from(raw, "base64");
  }

  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}). Generate one with: openssl rand -base64 32`
    );
  }

  cachedKey = key;
  return key;
}

/** @param {string} plaintext @returns {string} versioned ciphertext */
export function encrypt(plaintext) {
  if (plaintext == null || plaintext === "") return "";

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);

  const ciphertext = Buffer.concat([
    cipher.update(String(plaintext), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/** @param {string} payload @returns {string} plaintext */
export function decrypt(payload) {
  if (!payload) return "";

  const parts = String(payload).split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Malformed ciphertext");
  }

  const [, ivPart, tagPart, dataPart] = parts;
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/** True when the value looks like something encrypt() produced. */
export function isEncrypted(value) {
  return typeof value === "string" && value.startsWith(`${VERSION}.`) && value.split(".").length === 4;
}

/** SHA-256, base64url. For lookup keys and one-way token storage. */
export function hashToken(token) {
  return createHash("sha256").update(String(token)).digest("base64url");
}

/** Constant-time compare, safe for differing lengths. */
export function safeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** URL-safe random token, for OAuth `state` and CSRF values. */
export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}
