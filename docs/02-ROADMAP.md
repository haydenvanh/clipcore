# Implementation Roadmap — clip-ai → Snazo-class SaaS

Companion to `docs/01-AUDIT.md`. This document fixes the architecture **before** code is written,
so that every later phase is a mechanical execution of a decision already made and justified here.

Guiding constraint from the brief: **reuse, don't rewrite.** Every decision below is scored against
"what is the smallest change to the existing architecture that makes this correct?"

---

## Part A — Architectural decisions (ADRs)

### D1. Own the clipping pipeline; keep MuAPI as a swappable provider ⭐ *the central decision*

**Problem.** Phases 4–7 require transcription, viral-moment scoring, caption rendering, reframing,
and multi-preset export. Today all of that is one opaque MuAPI call. Two things make the status quo
untenable: (a) we cannot produce viral/clip/confidence scores or word-level karaoke captions for
content we never see, and (b) Snazo's entire differentiation is in that layer.

**Rejected — keep MuAPI only.** Cheapest, but Phases 5, 6, 7 become impossible. The product would be
a reseller with no moat.

**Rejected — rip out MuAPI now.** Violates the reuse mandate and puts the app in a non-working state
for weeks while the worker is built.

**Decision.** Introduce a `ClipProvider` interface in `src/lib/providers/`, with two implementations:

- `muapi` — wraps today's code exactly. Remains the default so **nothing regresses on day one**.
- `native` — our own worker: `yt-dlp` → `ffmpeg` → Whisper → LLM scoring → `ffmpeg` caption burn-in.

Selection is per-job (`Video.provider`), defaulting from `CLIP_PROVIDER` env. The existing
`AIService` becomes the `muapi` implementation with its bugs fixed, not deleted.

**Why this wins.** It converts a rewrite into an incremental migration, keeps the app shippable at
every commit, gives us a permanent fallback when the worker is down, and makes the vendor a
commodity we can price-shop.

**Where the worker runs.** Not Vercel — serverless functions cap at ~15 min, have no persistent
disk, and cannot ship ffmpeg binaries sanely. The worker is a **long-running Node container on
Railway/Render** (per the Phase 13 brief) with ffmpeg + yt-dlp in the image.

### D2. Stay on JavaScript; buy type safety with Zod at the boundaries

A TypeScript migration of 2,565 lines is a rewrite by another name and delivers zero user value.
But the audit's defects (V1, V2, V6, S8) are all **untrusted-input** defects, which types don't
catch at runtime anyway.

**Decision.** Keep `.js`. Add **Zod schemas for every API route input** — which Phase 12 requires
regardless — plus JSDoc typedefs on service signatures so editors still autocomplete. Revisit TS
only if the team grows past ~3 engineers.

### D3. Keep NextAuth v4; switch session strategy from `database` to `jwt`

Phase 2 wants Google + email/password + reset. NextAuth v4's `CredentialsProvider`
**cannot be used with the database session strategy** — it is a hard framework constraint, not a
preference.

**Rejected — upgrade to Auth.js v5.** Still beta-ish, changes every import site, and buys nothing we
need today.

**Decision.** Keep NextAuth v4 and `PrismaAdapter` (so `Account`/`User` and Google account linking
are untouched), set `session.strategy = "jwt"`, and add a `CredentialsProvider` backed by new
`Password` + `PasswordResetToken` models with `argon2` hashing.

**Tradeoff, stated plainly.** JWT sessions cannot be revoked instantly server-side. Mitigations:
30-day `maxAge`, and a `User.sessionsValidAfter` timestamp checked in the `jwt` callback so
"sign out everywhere" and password changes invalidate outstanding tokens. Bonus: this removes
audit finding **A4** (a `Session` + `User` query on every request, including every status poll).

### D4. Credits = an append-only ledger; `User.credits` becomes a cached balance

Phase 3 requires tracking granted / consumed / refunded. A mutable integer cannot answer
"why is my balance 43?", cannot be refunded, and cannot be reconciled against Stripe.

**Rejected — derive the balance by summing the ledger on every read.** Correct but O(n) per request,
and the Navbar reads it constantly.

**Decision.** `CreditLedger` is append-only and is the **source of truth**. `User.credits` is a
denormalized cache written **in the same transaction** as every ledger insert. A nightly
reconciliation job asserts `sum(ledger) == user.credits` and alarms on drift.

This also fixes the **credit race** (audit §8.1): every debit becomes a single conditional statement
inside a transaction —

```sql
UPDATE "User" SET credits = credits - $1 WHERE id = $2 AND credits >= $1
```

— and a zero-row result means insufficient funds. The check and the write become one atomic act.

**Charge model:** *hold → settle or refund.* Credits are held (`type=HOLD`) when a job is enqueued,
settled (`SETTLE`) on success against actual minutes processed, and released (`REFUND`) on failure.
This is the direct fix for audit finding **V5** (charged before success, never refunded).

**Unit change:** the brief sets **1 credit = 1 minute processed**. Today the code charges
~10 credits/min plus 10/highlight. The ledger stores integer credits; the pricing constants move to
one server-side module (`lib/plans.js`) that is the single source of truth for both the pricing page
and checkout — fixing audit finding **S8**.

### D5. Storage: Cloudflare R2 through the S3 API

**Decision.** Use `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` pointed at R2's
S3-compatible endpoint. R2 vs S3 becomes three env vars, satisfying "preferred R2, alternative S3"
with one code path and zero vendor lock-in.

**Uploads never pass through Next.js.** The browser gets a presigned `PUT` and uploads directly to
R2. This is why audit finding V9's route is replaced rather than repaired — Vercel caps request
bodies at 4.5 MB, which is useless for video.

**Layout:** `sources/{userId}/{videoId}/…` · `clips/{userId}/{clipId}/…` ·
`transcripts/{videoId}.json` · `captions/{clipId}.ass` · `renders/{renderId}/…`.
Reads are served via short-lived presigned GETs — which also fixes **V10** (assets we don't own).

### D6. Queue: Postgres `SELECT … FOR UPDATE SKIP LOCKED`, not Redis

**Rejected — BullMQ + Redis.** More capable, but adds a second datastore, a second failure mode, and
a second bill on day one, at volumes that don't need it.

**Decision.** A `Job` table polled by the worker with `FOR UPDATE SKIP LOCKED`. We already run
Postgres. Decisive advantage: **enqueueing a job and holding its credits happen in one
transaction** — impossible across a Postgres/Redis boundary without a distributed-transaction dance.

Includes `attempts`, `maxAttempts`, `runAfter` (exponential backoff), `lockedAt`/`lockedBy` with a
reaper for dead workers. Migration trigger, written down now: **> ~50 jobs/min or > 4 workers** →
move to BullMQ, keeping the same `Job` row as the durable record.

### D7. Restore migrations

`.gitignore` currently ignores `/prisma/migrations`. Un-ignore it, `prisma migrate diff` a baseline
from the live schema, and move to `migrate deploy` in CI. Nothing else in Phase 9 is safe until
this exists.

### D8. Landing page at `/`, tool at `/dashboard`

`page.js` (594 lines) moves to `/dashboard` and is decomposed into components. `/` becomes the
marketing page. `layout.js`'s `lg:overflow-hidden` body class must go — it makes a scrolling
landing page impossible. Route protection moves to **`src/proxy.js`**, not `middleware.js`:
Next 16 deprecated the `middleware` filename in favour of `proxy` (verified in the bundled
Next 16 upgrade guide), which also forces the Node runtime we want.

---

## Part B — Execution order

Sequenced by dependency and by risk, not by the brief's numbering. Security and schema come first
because everything else is built on them; the pipeline comes last because it is the largest and
benefits from every foundation below it.

| Step | Phase(s) | Deliverable | Depends on |
| :--- | :--- | :--- | :--- |
| **0** | 12 (partial) | **Security hotfix** — SSRF guard, auth the MuAPI webhook, `userId` scoping, atomic credit debit | — |
| **1** | 9 | Schema + baseline migration: all 10 tables, indexes, ledger | D4, D7 |
| **2** | 3 | Billing rebuild: plans module, subscriptions, Portal, idempotent webhook, ledger wiring | 1 |
| **3** | 2 (auth) | JWT strategy, credentials provider, password reset | 1 |
| **4** | 8 | R2 storage lib + presigned upload/download | 1 |
| **5** | 2 (UI) | Landing page + dashboard + profile/billing pages | 1–4 |
| **6** | 12 | Rate limiting, Zod validation on every route, upload limits, headers | 1–5 |
| **7** | 4, 11 | Job queue, worker skeleton, ingestion (YouTube/TikTok/IG/upload), retries, logging | 1, 4, 6 |
| **8** | 5 | Transcription + viral scoring engine + score persistence | 7 |
| **9** | 6, 7 | Caption rendering + aspect ratios + platform presets | 8 |
| **10** | 10 | Admin panel | 2, 8 |
| **11** | 13 | Deployment checklist, env matrix, prod config | all |

**Reuse ledger.** Kept and extended: `lib/prisma.js`, `lib/config.js`, `lib/services/*` (the seam),
`lib/auth.js`, `globals.css` theme tokens, `Navbar`, `Footer`, `/login`, the gallery grid + modal,
and the async job + webhook + poll *pattern*. Replaced: `billing.js`, 4 Stripe routes → 3,
`/api/upload`, the `Creation` model, and `/` as the tool.

---

## Part C — Target schema (Phase 9)

Ten tables per the brief, plus the NextAuth trio kept verbatim.

| Table | Key columns | Notes |
| :--- | :--- | :--- |
| `User` | `+ stripeCustomerId`, `credits` (cache), `role`, `sessionsValidAfter` | Extends existing model — no data migration. |
| `Password`, `PasswordResetToken` | `userId`, `hash` / `tokenHash`, `expiresAt` | New; D3. |
| `Subscription` | `stripeSubscriptionId`, `plan`, `status`, `currentPeriodEnd`, `cancelAtPeriodEnd` | Drives monthly credit renewal. |
| `CreditLedger` | `delta`, `type` (GRANT/HOLD/SETTLE/REFUND/EXPIRE/ADJUST), `balanceAfter`, `refType`, `refId`, `idempotencyKey @unique` | Append-only. D4. |
| `Transaction` | `stripePaymentIntentId`, `amountCents`, `status`, `invoiceId` | Money, kept separate from credits. |
| `Video` | `source` (UPLOAD/YOUTUBE/TIKTOK/INSTAGRAM), `sourceUrl`, `storageKey`, `durationSec`, `status`, `provider` | Replaces half of `Creation`. |
| `Transcript` | `videoId`, `language`, `words Json`, `storageKey` | Word-level timings → karaoke captions. |
| `Clip` | `videoId`, `startSec`, `endSec`, `title`, `viralScore`, `clipScore`, `confidence`, `reasoning` | Phase 5 outputs as first-class columns. |
| `Render` | `clipId`, `aspectRatio`, `preset`, `captionStyle`, `language`, `storageKey`, `status` | One row per exported file — a clip renders to many presets. |
| `Job` | `type`, `payload`, `status`, `attempts`, `runAfter`, `lockedAt/By`, `lastError` | D6. |
| `Event` | `type`, `userId`, `payload` | Product analytics + funnel. |
| `AuditLog` | `actorId`, `action`, `target`, `ip`, `meta` | Admin/compliance. |
| `WebhookEvent` | `provider`, `externalId @unique`, `processedAt` | **Idempotency** for Stripe + MuAPI. Fixes S3. |

**Migration from `Creation`:** it is preserved read-only and backfilled into `Video` + `Clip` so no
user loses history. It is dropped only after the backfill is verified.

---

## Part D — Pricing model (Phase 3)

`1 credit = 1 minute processed`, enforced server-side from `lib/plans.js`.

| Plan | Price | Credits/mo | ≈ Minutes | Effective $/min |
| :--- | :--- | :--- | :--- | :--- |
| Basic | $9.99 | 150 | 150 | $0.067 |
| Pro | $14.99 | 300 | 300 | $0.050 |
| Ultra | $29.99 | 800 | 800 | $0.037 |

Renewal on `invoice.paid` → `GRANT`. Upgrades prorate immediately and grant the difference;
downgrades take effect at period end (no clawback of already-granted credits — the ledger records
the intent, so this is a policy line, not a code change). Unused credits expire at period end via a
scheduled `EXPIRE` entry — configurable, defaulting to a one-period rollover cap.

---

## Part E — Risks carried into implementation

| Risk | Mitigation |
| :--- | :--- |
| Worker (D1) is the single largest work item and could slip | `muapi` provider stays default; `native` ships behind a flag per-user. |
| yt-dlp / TikTok / Instagram ingestion breaks on platform changes | Isolate in one `extractors/` module; treat breakage as expected, alert on extractor error rate. |
| Whisper + LLM cost per minute could exceed $0.037/min at Ultra | Measure real unit cost in Phase 8 **before** the pricing page goes live; plans are config, not code. |
| JWT sessions can't be hard-revoked (D3) | `sessionsValidAfter` check in the `jwt` callback. |
| No tests today | Vitest on `credits`, `plans`, `scoring`, and webhook idempotency **as those modules are written**, not retrofitted. |

---

*Decisions locked. Execution begins at Step 0.*
