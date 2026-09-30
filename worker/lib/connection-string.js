/**
 * Pin TLS verification in a Postgres connection string.
 *
 * `pg` currently treats sslmode=require/prefer/verify-ca as verify-full and
 * warns that its next major version will switch them to libpq's weaker
 * semantics (encrypt, but don't verify the server). Rewriting them to
 * verify-full keeps today's behaviour exactly and keeps it after that change —
 * and silences a nine-line warning on every start.
 *
 * Shared by the web app (src/lib/prisma.js) and the worker (worker/lib/db.js).
 */
export function pinSslMode(connectionString) {
  if (!connectionString) return connectionString;
  try {
    const url = new URL(connectionString);
    const mode = url.searchParams.get("sslmode");
    if (mode && ["require", "prefer", "verify-ca"].includes(mode)) {
      url.searchParams.set("sslmode", "verify-full");
    }
    return url.toString();
  } catch {
    // Not a URL (e.g. key=value form) — leave it exactly as given.
    return connectionString;
  }
}
