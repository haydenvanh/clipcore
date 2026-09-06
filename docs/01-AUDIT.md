# Phase 1 — Audit of `DishaChandelGit/clip-ai`

Audit date: 2026-09-06 · HEAD `6b3d8b6` · 2,565 LOC across 31 source files.
Every claim below was verified by reading the file and, where relevant, by building the app
(`npx next build` succeeds on a clean checkout with placeholder env).

---

## 1. Architecture report

### 1.1 What this actually is

`clip-ai` is **not a video processing application**. It is a thin Next.js SaaS shell that
forwards two HTTP calls to a third-party vendor (**MuAPI**, `api.muapi.ai`) and stores the
resulting vendor CDN URLs in Postgres. There is no ffmpeg, no transcription, no scoring, no
rendering, and no storage of our own anywhere in the repository.

```
Browser (React 19, client components)
  │
  │  fetch() ─ same-origin
  ▼
Next.js 16 App Router route handlers  (Vercel serverless, Node runtime)
  │
  ├── NextAuth v4 + PrismaAdapter ──────────────► Postgres (Account/Session/User)
  ├── AIService ──── POST ──────────────────────► api.muapi.ai/v1/youtube-download
  │                                             ► api.muapi.ai/v1/ai-clipping
  │                                             ► api.muapi.ai/v1/predictions/:id/result  (poll fallback)
  ├── BillingService ─────────────────────────► Stripe Checkout (one-time payments)
  └── Prisma ─────────────────────────────────► Postgres (Creation rows)

  MuAPI ── webhook (unauthenticated) ─────────► /api/webhook/muapi ──► Creation.status = completed
  Stripe ─ webhook ───────────────────────────► /api/webhook/stripe ─► User.credits += n
```

### 1.2 Stack, verified

| Layer | Choice | Version | Assessment |
| :--- | :--- | :--- | :--- |
| Framework | Next.js App Router | 16.2.3 | Current. Turbopack default. Keep. |
| React | React | 19.2.4 | Current. Keep. |
| Language | **JavaScript, no TypeScript** | — | Biggest single quality liability. `jsconfig.json` only. |
| Styling | Tailwind CSS v4 (`@theme`) + CSS vars | 4.x | Well-structured token system. Keep. |
| Auth | NextAuth v4 + `@next-auth/prisma-adapter` | 4.24.14 | Google-only, **database** session strategy. |
| ORM | Prisma + `@prisma/adapter-pg` driver adapter | 7.8.0 | Modern setup. Keep. Note: **no migrations**. |
| Payments | `stripe` node SDK | 22.1.0 | Pinned to API version `2023-10-16` — 3 years stale. |
| Animation | framer-motion | 12.x | Fine. |
| Video/AI | **none in-repo** — MuAPI only | — | The core product does not exist here. |
| Tests | **none** | — | Zero test files, zero CI. |

### 1.3 The load-bearing architectural fact

Every "AI" capability is a single opaque MuAPI endpoint. The repo cannot influence
clip selection, captions, reframing, or export presets — those are vendor-internal. Snazo's
differentiation ("every clip is rewritten — new framing, captions, pacing") lives exactly in
the layer this repo does not own.

**This is the decision that shapes the whole roadmap** and is addressed in `02-ROADMAP.md §D1`.

---

## 2. Folder structure map

```
clip-ai/
├── prisma/schema.prisma          5 models, 72 lines, no migrations dir (gitignored)
├── prisma.config.ts              datasource URL injected here, not in schema
├── src/
│   ├── app/
│   │   ├── layout.js             Root layout; hardcodes Navbar; `lg:overflow-hidden` on body
│   │   ├── providers.js          SessionProvider + a no-op theme effect
│   │   ├── globals.css           244 lines. 5 themes as CSS-var blocks. Good bones.
│   │   ├── page.js               594 lines. THE app: 2-tab tool. Not a landing page.
│   │   ├── gallery/page.js       320 lines. "My Creations" grid + modal.
│   │   ├── login/page.js         Google button only.
│   │   ├── pricing/page.js       4 hardcoded credit packs. Copy says "Art Credits".
│   │   └── api/                  13 route handlers (inventory in §7)
│   ├── components/
│   │   ├── Navbar.js             226 lines. Credits pill, profile menu, Vercel deploy CTA.
│   │   └── Footer.js             Links to /terms and /privacy — both 404.
│   └── lib/
│       ├── config.js             Central config. Declares a plan shape nothing else uses.
│       ├── auth.js               authOptions. 26 lines.
│       ├── prisma.js             Singleton + pg Pool.
│       ├── stripe.js             Falls back to a fake key so builds don't fail.
│       ├── utils.js              Client-side blob download helper.
│       └── services/
│           ├── ai.js             253 lines. MuAPI client + cost math + status polling.
│           ├── user.js           Credit read/add/deduct.
│           └── billing.js        Stripe checkout + webhook.
└── (root)                        README, AGENTS.md, LICENSE, a 3.3MB demo .mp4 committed to git
```

**Structural observations**

- Service-layer separation (`lib/services/*`) is genuinely good and worth preserving and extending.
- No `middleware.js` / `proxy.js` → **zero edge-level route protection or rate limiting**.
- No `components/` decomposition: `page.js` at 594 lines holds state, network, polling, and markup.
- A 3.3 MB `.mp4` is committed at repo root. It should be in the README's CDN, not in git history.

---

## 3. Database schema report

### 3.1 Current schema (`prisma/schema.prisma`)

| Model | Purpose | Verdict |
| :--- | :--- | :--- |
| `Account`, `Session`, `VerificationToken` | NextAuth adapter tables | Correct. **Keep as-is.** |
| `User` | `+ credits Int @default(10)` | Keep, extend heavily. |
| `Creation` | One row per MuAPI job | **Replace** — see below. |

### 3.2 Findings

| # | Severity | Finding |
| :--- | :--- | :--- |
| D1 | **High** | **No migrations exist.** `.gitignore` contains `/prisma/migrations`. The project is `db push`-only, so production schema drift is untracked and unrollbackable. |
| D2 | **High** | `Creation.resultUrl String? @db.Text` stores a **JSON-encoded array of URLs**. Clips are not first-class rows, so per-clip scores, captions, renders, and re-exports are impossible without a schema change. |
| D3 | **High** | **No `Subscription` model.** Billing is one-time credit packs only. No recurring revenue primitive exists. |
| D4 | **High** | **No credits ledger.** `User.credits` is a bare mutable integer. There is no record of who was granted or charged what, so refunds, disputes, and MRR reconciliation are impossible. |
| D5 | Medium | **No indexes at all** beyond implicit PK/unique. `/api/creations` does `findMany({ where:{userId}, orderBy:{createdAt:desc} })` with no `@@index([userId, createdAt])` → sequential scan that degrades linearly with total table size. |
| D6 | Medium | `datasource db` block declares `provider` but **no `url`** — the URL comes from `prisma.config.ts`. This works for CLI + driver adapter, but is non-obvious and will confuse `prisma migrate` workflows. |
| D7 | Medium | `User.credits @default(10)` grants free credits with no signup abuse control (no email verification gate, no device/IP throttle). |
| D8 | Low | `binaryTargets` includes `rhel-openssl-1.0.x` — unnecessary on modern Vercel/Node 20+, slows installs. |

---

## 4. Authentication report

**File:** `src/lib/auth.js` (26 lines), `src/app/api/auth/[...nextauth]/route.js`

### 4.1 What exists

- NextAuth v4, single `GoogleProvider`.
- `PrismaAdapter` → **database session strategy** (the adapter default when no `session.strategy` is set).
- `session` callback copies `user.id` and `user.credits` onto `session.user`.
- Custom sign-in page at `/login`.

### 4.2 Findings

| # | Severity | Finding |
| :--- | :--- | :--- |
| A1 | **High** | **No server-side route protection.** There is no `middleware.js`/`proxy.js`. `/gallery` protects itself with a client `useEffect` redirect, which flashes content and is not a security boundary. Only the API routes call `getServerSession`. |
| A2 | **High** | Email/password login and password reset (Phase 2 requirements) **cannot be added without an architectural change**: NextAuth v4's `CredentialsProvider` is incompatible with the database session strategy. This forces a decision — documented as `D3` in the roadmap. |
| A3 | Medium | `session.user.credits` is read at session time and **never refreshed client-side**. After a generation or a purchase the Navbar shows a stale balance until a hard reload. |
| A4 | Medium | Database sessions cost one `Session` + one `User` query on **every** authenticated request, including every 3-second status poll. |
| A5 | Medium | No `emailVerified` enforcement, no account-linking policy, no session revocation UI, no roles/`isAdmin` field (blocks Phase 10). |
| A6 | Low | `/login` copy promises Terms of Service; `/terms` returns 404. |

---

## 5. Stripe integration report

**Files:** `src/lib/stripe.js`, `src/lib/services/billing.js`, 4 route handlers.

### 5.1 Verdict: **the payment flow is broken in production and has never worked.**

This is not a style critique. Traced end-to-end:

1. `pricing/page.js:29` posts `{ planId: "basic" | "standard" | "pro" | "business" }` to `/api/checkout`.
2. `/api/checkout` calls `BillingService.createCheckoutSession(userId, planId)`.
3. `billing.js:7` looks up `config.stripe.plans[planId]`.
4. `config.js:21-27` defines **exactly one** plan, keyed `default`, shaped `{ amount, price, currency }`.
5. → `plan` is `undefined` → **every checkout throws `Invalid plan selected` (HTTP 500)**.

And even if a `basic` key existed, `billing.js:17-18` reads `plan.name` and `plan.credits`, neither of
which is in the config's plan shape (`amount`/`price`/`currency`). The two halves were written
against different schemas and never reconciled.

### 5.2 Findings

| # | Severity | Finding |
| :--- | :--- | :--- |
| S1 | **Critical** | Checkout is 100% non-functional (traced above). No plan the UI can send exists in config. |
| S2 | **Critical** | **`/api/stripe/webhook/route.js:7` calls `headers()` without `await`.** Next 16 removed synchronous access to request APIs (verified in `node_modules/next/dist/docs/.../version-16.md`). This handler throws on every invocation. |
| S3 | **Critical** | **No webhook idempotency.** `BillingService.handleWebhook` grants credits on `checkout.session.completed` with no `stripe_event` dedupe table. Stripe retries on any non-2xx and re-delivers at-least-once → **duplicate credit grants**. |
| S4 | **High** | **Duplicate, divergent implementations.** `/api/checkout` and `/api/stripe/checkout` both create sessions with **incompatible payloads** (`{planId}` vs `{price, credits}` → passed as args 2 and 3 to a 2-arg function). `/api/webhook/stripe` and `/api/stripe/webhook` both handle webhooks. Four routes, two working paths intended, zero working. |
| S5 | **High** | Mode is `"payment"` only. **No subscriptions, no Customer Portal, no `stripe_customer_id` on User**, so upgrades/downgrades/renewals (Phase 3) have no foundation. |
| S6 | Medium | `stripe.js:9` pins `apiVersion: "2023-10-16"` against SDK v22 — a ~3-year version skew; several object shapes have changed. |
| S7 | Medium | `stripe.js:4-6` substitutes `"sk_test_placeholder_key_for_build_purposes"` when the key is absent. This makes a **misconfigured production deploy fail at runtime instead of at boot**. |
| S8 | Medium | Prices/credits are defined in the client component (`pricing/page.js:10-15`) and are **not the source of truth** the server validates against — the server has its own (broken) list. Divergence is guaranteed. |

---

## 6. Video processing pipeline report

### 6.1 The pipeline as implemented

```
1. User pastes a YouTube URL         (client)
2. POST /api/youtube-download        deduct flat 5 credits → MuAPI /youtube-download → request_id
3. Client polls /status every 3s     → AIService.checkStatus reads Creation, else polls MuAPI
4. On completion, the resulting URL is auto-pasted into the "AI Clipping" tab
5. POST /api/ai-clipping             deduct computed credits → MuAPI /ai-clipping → request_id
6. Client polls every 3s until the row flips to completed
7. Gallery renders <video src={vendorCdnUrl}>
```

There is **no** transcription step, **no** viral-moment scoring, **no** caption generation, and
**no** render step in this repository. Steps 2–6 of the Phase 4 brief are a single vendor call.

### 6.2 Findings

| # | Severity | Finding |
| :--- | :--- | :--- |
| V1 | **Critical** | **SSRF.** `ai.js:12-26 getYoutubeDuration(url)` performs a server-side `fetch()` on a **user-supplied URL** with no scheme/host allowlist. The guard at `ai.js:35` is a substring test (`url.includes("youtube.com")`), so `http://169.254.169.254/latest/meta-data/?x=youtube.com` passes it and the server fetches cloud instance metadata. |
| V2 | **Critical** | `/api/ai-clipping/calculate-cost` is **completely unauthenticated** (`route.js:4` — no `getServerSession`), turning V1 into an unauthenticated SSRF + a free outbound-request proxy. |
| V3 | **Critical** | **IDOR.** `AIService.checkStatus(requestId)` (`ai.js:190`) queries `Creation` by `requestId` **without filtering on `userId`**. Any authenticated user who knows/guesses a request id reads another user's result URLs. Worse: `/api/youtube-download/status/route.js` has **no session check at all** → fully public. |
| V4 | **Critical** | **The MuAPI webhook is unauthenticated** (`api/webhook/muapi/route.js`). No signature, no shared secret, no bearer token. Any internet caller can POST `{id, outputs:["https://attacker/x.mp4"]}` and overwrite an arbitrary user's completed clip with attacker-controlled media, or flip jobs to `failed`. |
| V5 | **High** | **Credits are charged before work succeeds and are never refunded.** `ai.js:52` and `ai.js:121` deduct up front; there is no refund path in any failure branch, in the webhook, or in `checkStatus`. Every vendor failure silently burns the user's balance. |
| V6 | **High** | **Cost is unbounded and trivially wrong.** Duration falls back to `300` seconds (`ai.js:32`) on any parse failure — a 3-hour podcast is billed as 5 minutes. YouTube's HTML `lengthSeconds` scrape is also brittle by design and will break without notice. |
| V7 | **High** | `youtubeDownload` charges a **flat 5 credits** regardless of length or resolution — a 4K 3-hour download costs the same as a 30-second 360p one. |
| V8 | Medium | Client polls with unbounded recursion (`page.js:174`, `page.js:238`): fixed 3 s interval, no backoff, no attempt cap, no abort on unmount. A stuck job polls forever, and each poll can trigger an outbound MuAPI call (`ai.js:214`). |
| V9 | Medium | **`/api/upload/route.js:21` reads `config.ai.headshot.apiKey`. `config.ai` has no `headshot` key** → `TypeError: Cannot read properties of undefined`. The upload route is dead code inherited from the "AI Headshot Studio" template it was forked from. **File upload does not work at all.** |
| V10 | Medium | Results are **vendor CDN URLs stored verbatim**. When MuAPI expires or rotates them, every historical clip in every user's gallery breaks. There is no asset ownership. |
| V11 | Low | `prisma.creation \|\| prisma.Creation` (`ai.js:82`, `152`, `187`) is defensive noise around a deterministic generated client. |
| V12 | Low | `utils.js downloadMedia` fetches a cross-origin blob; MuAPI's CDN will block it on CORS and it silently degrades to `window.open`. |

---

## 7. API route inventory

13 handlers. Legend: 🔴 broken · 🟠 insecure · 🟡 duplicate/dead · 🟢 sound.

| Route | Method | Auth | Status | Note |
| :--- | :--- | :--- | :--- | :--- |
| `/api/auth/[...nextauth]` | GET/POST | — | 🟢 | NextAuth handler. Keep. |
| `/api/ai-clipping` | POST | ✅ session | 🟠 | Charges before work; no refund; no input validation; no rate limit. |
| `/api/ai-clipping/status` | POST | ✅ session | 🔴🟠 | **IDOR** — no `userId` scoping (V3). |
| `/api/ai-clipping/calculate-cost` | POST | ❌ **none** | 🔴🟠 | **Unauthenticated SSRF** (V1/V2). |
| `/api/youtube-download` | POST | ✅ session | 🟠 | Flat 5-credit charge (V7). |
| `/api/youtube-download/status` | POST | ❌ **none** | 🔴🟠 | **Public**, plus IDOR (V3). |
| `/api/creations` | GET | ✅ session | 🟡 | Correct but unpaginated; returns entire history. |
| `/api/upload` | POST | ✅ session | 🔴 | **Throws on every call** — `config.ai.headshot` undefined (V9). |
| `/api/checkout` | POST | ✅ session | 🔴 | Always 500s — no matching plan (S1). |
| `/api/stripe/checkout` | POST | ✅ session | 🔴🟡 | Duplicate of the above with an incompatible signature (S4). |
| `/api/webhook/stripe` | POST | sig | 🔴 | Signature verified, but no idempotency (S3); grants credits. |
| `/api/stripe/webhook` | POST | sig | 🔴🟡 | Duplicate; **throws** on `headers()` without `await` (S2). |
| `/api/webhook/muapi` | POST | ❌ **none** | 🔴🟠 | **Unauthenticated DB write** on arbitrary jobs (V4). |

**Summary: of 13 routes, 6 are outright broken, 5 have a security defect, and 3 are duplicates.**

---

## 8. Risk assessment

### 8.1 Security — ranked by exploitability × impact

| Rank | Risk | Vector | Impact |
| :--- | :--- | :--- | :--- |
| 1 | **Unauthenticated MuAPI webhook** (V4) | Public POST | Overwrite any user's clips with attacker media; corrupt job state. |
| 2 | **Unauthenticated SSRF** (V1+V2) | Public POST | Read cloud metadata / reach internal services from the Vercel function. |
| 3 | **IDOR on status** (V3) | Any user, or none | Cross-tenant read of result URLs. |
| 4 | **Webhook replay → free credits** (S3) | Stripe retry or replayed payload | Direct revenue loss. |
| 5 | **Credit race condition** (see below) | Concurrent requests | Negative balances, free compute. |
| 6 | No rate limiting anywhere | Any endpoint | Vendor-cost amplification; the app pays MuAPI per call. |
| 7 | No CSRF/bot protection on signup | Signup flow | Farming the 10 free credits at scale. |

**The credit race:** `user.js:24-41 deductCredits` does `getCredits()` then `update({ decrement })`
as two separate statements with no transaction and no conditional write. Two concurrent requests
both read `balance = 10`, both pass the `< amount` check, both decrement. The balance goes
negative and the user gets free vendor compute. This is a read-modify-write bug, not a race that
Postgres's `decrement` fixes — the *check* is what races.

### 8.2 Financial risk

- Every failed job burns the user's credits **and** our vendor spend, with no refund (V5).
- Cost is computed from a 5-minute default when duration detection fails (V6) — the app can bill
  10 credits for 180 minutes of vendor processing.
- Broken checkout (S1) means **revenue is currently exactly $0** and no plan can be purchased.

### 8.3 Operational risk

- No migrations (D1) → no safe path to change production schema.
- No error tracking, no structured logs, no request ids, no alerting.
- No tests, no CI, no type checking.
- Client polling is the only job-progress mechanism; closing the tab loses all progress feedback.
- Single vendor dependency with no abstraction, no timeouts, no retries, no circuit breaker.

### 8.4 Product risk

- `/` is a bare tool, not a landing page. There is **no marketing surface at all** — no hero,
  no demo, no social proof, no FAQ. A visitor who is not already sold cannot be sold.
- Copy is an unreconciled mix of three products: "AI Headshot Studio", "Art Credits",
  "Manifestation", "AICLIPS Studio". `.env.example` still says *"Nano Banana API"*.
- `config.theme` is read in `layout.js:23` and `providers.js:10` but **never defined** in
  `config.js` → the documented `NEXT_PUBLIC_THEME` env var does nothing.

---

## 9. Verdict: keep / fix / replace / build

### ✅ Works today (keep, unchanged or nearly so)

| Asset | Why it survives |
| :--- | :--- |
| Next 16 + React 19 + Tailwind v4 setup | Modern, builds clean, correctly configured. |
| `globals.css` theme-token system | 5 themes over CSS variables consumed through Tailwind `@theme`. Genuinely good. Reuse for the dark landing page. |
| NextAuth + PrismaAdapter wiring | Google OAuth works. Adapter tables are canonical — **do not touch them.** |
| `lib/prisma.js` singleton + driver adapter | Correct serverless pattern. |
| `lib/services/*` layering | The right seam. Extend rather than replace. |
| `Navbar` / `Footer` / `/login` shells | Solid components; need routes and a credits refresh. |
| Gallery grid + inspector modal | Good UX skeleton for the dashboard's "Recent clips". |
| Async job + webhook + status-poll **pattern** | The shape is right even though the implementation is unsafe. |

### 🔧 Fix in place (keep the file, correct the logic)

`lib/services/user.js` (atomic conditional decrement) · `lib/services/ai.js` (SSRF guard, userId
scoping, refunds, real duration) · `lib/config.js` (real plans, add `theme`) · `api/creations`
(pagination, index) · `layout.js` (drop `overflow-hidden` so a landing page can scroll) ·
`page.js` (extract the tool into `/dashboard`, decompose the 594 lines).

### ♻️ Replace outright

| Replace | With | Reason |
| :--- | :--- | :--- |
| `lib/services/billing.js` | Subscription-based billing + ledger | One-time-payment model can't express Phase 3. |
| 4 Stripe routes → 2 | `/api/billing/checkout`, `/api/billing/portal`, `/api/webhooks/stripe` | Duplicates, all broken. |
| `/api/upload` | R2/S3 presigned direct upload | Current file throws; and proxying video through a serverless function is wrong regardless. |
| `Creation` model | `Video` → `Clip` → `Render` + `Transcript` | JSON-in-a-text-column blocks every Phase 5–7 feature. |
| `/` (the tool) | Marketing landing page; tool moves to `/dashboard` | Phase 2 requirement. |
| Client `setTimeout` polling | Job records + SSE or bounded backoff polling | Unbounded, un-abortable, amplifies vendor cost. |

### 🏗️ Does not exist — must be built

Landing page · email/password auth + reset · dashboard · subscriptions · Customer Portal ·
**credits ledger** · **object storage (R2)** · **transcription** · **viral-moment scoring** ·
**caption rendering** · **export presets** · TikTok/Instagram ingestion · **background worker** ·
**job queue** · admin panel · rate limiting · input validation · migrations · error tracking · tests.

---

## 10. Gap analysis vs. Snazo

Snazo (snazo.app) positions as: submit a link or upload → AI finds key moments and produces
~10 platform-ready vertical clips, each **rewritten** (reframed, re-captioned, re-paced) to
reduce platform flagging → download. Entry plan $9.99/mo.

| Capability | Snazo | clip-ai today | Gap |
| :--- | :--- | :--- | :--- |
| Landing / marketing site | Full SaaS site | **None** — `/` is the tool | ⛔ Total |
| Input: YouTube link | ✅ | ✅ | ✅ Parity |
| Input: direct upload | ✅ | 🔴 route throws (V9) | ⛔ Total |
| Input: TikTok / Instagram | ✅ (podcasts, streams) | ❌ | ⛔ Total |
| Transcription | ✅ | ❌ | ⛔ Total |
| Viral-moment detection | ✅ (core differentiator) | Vendor black box | ⛔ Not owned |
| Clip scoring (viral/confidence) | ✅ | ❌ | ⛔ Total |
| Auto captions | ✅ | ❌ | ⛔ Total |
| Animated / karaoke / word-by-word captions | ✅ | ❌ | ⛔ Total |
| Multi-language captions | ✅ | ❌ | ⛔ Total |
| Active speaker reframing | ✅ | Vendor `aspect_ratio` param only | ⛔ Not owned |
| Aspect ratios 9:16 / 1:1 / 16:9 | ✅ | Param passed through, unverified | 🟡 Partial |
| Platform presets (TikTok/Reels/Shorts/X/FB) | ✅ | ❌ | ⛔ Total |
| ~10 clips per source, batch | ✅ | 1–60 slider, vendor-dependent | 🟡 Partial |
| Subscriptions + Customer Portal | ✅ $9.99/mo | 🔴 one-time packs, broken | ⛔ Total |
| Credits ledger / monthly renewal | ✅ implied | Bare integer, no history | ⛔ Total |
| Own asset storage | ✅ implied | Vendor CDN URLs | ⛔ Total |
| Dashboard | ✅ | Gallery grid only | 🟡 Partial |
| Admin / metrics | ✅ implied | ❌ | ⛔ Total |

**Honest summary of the gap:** clip-ai has a working *SaaS chassis* — auth, theming, a job
pattern, a gallery — and essentially **none of the product**. The three hardest gaps are
(1) owning the clipping intelligence instead of renting an opaque endpoint, (2) caption
rendering, which needs real compute Vercel cannot provide, and (3) a billing system that works at all.

---

## 11. Technical debt baseline

Scored before any change, to measure against later.

| Area | Debt | Est. effort to production |
| :--- | :--- | :--- |
| Security | 4 critical, 3 high | 3–4 d |
| Billing | Non-functional; wrong model | 4–5 d |
| Data model | Blocks Phases 5–7; no migrations | 2–3 d |
| Video pipeline | Does not exist (vendor-only) | 10–15 d |
| Frontend/product | No landing, no dashboard | 5–7 d |
| Platform (storage/queue/worker) | Does not exist | 5–7 d |
| Quality (types, tests, CI, obs.) | Zero | 4–6 d |
| **Total** | | **~33–47 engineer-days** |

Debt density today: **~1 defect per 60 LOC** (43 findings / 2,565 LOC), concentrated in
`services/` and `api/`.

---

*Phase 1 complete. No code changed. Implementation plan: `docs/02-ROADMAP.md`.*
