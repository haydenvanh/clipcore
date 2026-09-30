# Technical Debt Register

Debt taken **deliberately** to ship faster is listed with its interest rate and its payoff trigger.
Debt found in the audit is listed with its status. Nothing here is a TODO in the codebase — if it
were small enough to be a TODO it would already be done.

Baseline at audit: **43 findings across 2,565 LOC** (~1 per 60 lines).
Current: **4 open**, all deliberate with a stated trigger.

Since the audit: 181 tests added, all 4 critical security findings closed, the
billing system rebuilt, and the pipeline written.

---

## 1. Paid down ✅

| # | Debt | Was | Fixed by |
| :--- | :--- | :--- | :--- |
| V1/V2 | Unauthenticated SSRF via `getYoutubeDuration` | Critical | `src/lib/url-guard.js` — scheme/host/private-IP checks, per-redirect re-validation, 19 attack tests. |
| V3 | IDOR — status readable by request id alone | Critical | `checkStatus(requestId, userId)` now requires and filters on the owner. |
| V4 | Unauthenticated MuAPI webhook (arbitrary DB write) | Critical | Shared secret, `timingSafeEqual`, **fail-closed** when unconfigured. |
| §8.1 | Credit race (read-then-write) | Critical | Single conditional `UPDATE … WHERE credits >= n RETURNING`. |
| V5 | Credits charged before success, never refunded | High | `refundCredits` on submit failure, provider rejection, and webhook failure; `Creation.creditsCharged` records the exact amount. |
| S2 | `headers()` without `await` (broken on Next 16) | Critical | Duplicate route deleted. |
| S4 | 4 Stripe routes, 2 duplicated pairs | High | Reduced to 2; rebuilt in Step 2. |
| V9 | `/api/upload` threw on every call (`config.ai.headshot`) | Medium | Route removed; replaced by presigned R2 upload. |
| D5 | No indexes on the gallery query | Medium | `@@index([userId, createdAt])`, `@@index([status])`. |
| D1 | No migrations, directory gitignored | High | Tracked; 505-line baseline migration committed. |
| — | `config.theme` read but never defined | Low | Defined; `NEXT_PUBLIC_THEME` now actually works. |
| — | `/api/creations` returned entire history | Medium | Cursor pagination, max 100. |

---

## 2. Deliberate debt — taken to ship

Each of these is a conscious trade. The **trigger** is the condition that makes paying it correct.

| # | Debt | Interest rate | Trigger to pay | Cost to pay |
| :--- | :--- | :--- | :--- | :--- |
| T1 | **JavaScript, no TypeScript** | 🟡 Medium — grows with team size and file count | A second engineer joins, or a type-shaped bug reaches production | 3–5 d |
| T2 | **Postgres queue instead of BullMQ** | 🟢 Low — correct at target scale | >50 jobs/min or >4 workers | 2 d (adapter swap; `Job` row survives) |
| T3 | **Duration estimate falls back to 5 min** | 🔴 **High — this is a live margin leak** | Ships with the worker (ffprobe gives real duration, hold settles against it) | Included in Step 4 |
| T4 | **Whisper API rather than self-hosted** | 🟡 Medium — 82% of COGS | 500+ hours/month processed | 1 d |
| T5 | **Client polling instead of SSE/websockets** | 🟢 Low — works, slightly chatty | Poll volume becomes a visible DB cost | 1 d |
| T6 | **No staging environment** | 🟡 Medium — every deploy is to production | First customer-visible regression | 0.5 d (Vercel preview + Neon branch) |
| T7 | **`Creation` kept alongside `Video`/`Clip`** | 🟢 Low — one dead table | Backfill verified in production | 0.5 d |
| T8 | **Single worker, no autoscale** | 🟡 Medium — a queue backlog is user-visible | Median queue wait >2 min | 0.5 d |
| T9 | **Secrets in env vars, no rotation policy** | 🟡 Medium | First hire, or first compliance ask | 0.5 d |
| T10 | **No load testing** | 🟢 Low at this scale | Before any launch expected to exceed ~100 concurrent | 1 d |

## 3. Known-open, scheduled

| # | Item | Severity | Scheduled |
| :--- | :--- | :--- | :--- |
| O1 | Stripe API version pin | ~~Medium~~ | ✅ Removed; SDK default is current |
| O2 | No rate limiting | ~~High~~ | ✅ Postgres-backed, 9 routes |
| O3 | No Zod validation on route inputs | Low | Open. `readJson` + `assertSafeUrl` + explicit checks cover the actual attack surface; Zod would be tidier, not safer. |
| O4 | No error tracking | ~~High~~ | ✅ Sentry on server, edge, browser |
| O5 | No `/terms`, `/privacy` | ~~Medium~~ | ✅ Written, footer no longer 404s |
| O6 | `page.js` 594 lines | ~~Medium~~ | ✅ Decomposed into `/dashboard` + 5 components |
| O7 | Stale credit balance | ~~Low~~ | ✅ `/api/me` + `CreditsBadge` |
| O8 | 3.2 MB demo `.mp4` in git | Low | Open, harmless. **The demo still shows the old product name — re-record before launch.** |
| O9 | Two scrollbar systems | Low | Open, cosmetic |
| O10 | `downloadMedia` CORS fallback | ~~Low~~ | ✅ Superseded by signed R2 URLs |
| **O11** | **No real video has been through the pipeline** | **High** | **Open — the single biggest unknown. Needs live services.** |
| O12 | No CSP | Medium | Open. Deliberately deferred: a CSP written without measuring what actually loads breaks production. Ship report-only first. |

## 4. Debt we are choosing to keep indefinitely

| Choice | Why it stays |
| :--- | :--- |
| No Kubernetes / no microservices | One Next.js app + one worker is the correct shape to ~10k users. Splitting earlier adds cost and failure modes with no benefit. |
| No Redis at launch | One datastore, one bill, one thing to operate. Postgres does queueing and rate limiting adequately at this scale. |
| No GraphQL | Route handlers returning JSON are simpler and faster to write for a single first-party client. |
| No design system / component library | Tailwind tokens in `globals.css` already are the design system. |
| `next-auth` v4 rather than Auth.js v5 | v4 is stable and works. Migrating is churn with no user-visible benefit. |

## 5. How debt is tracked

1. Nothing lands with a TODO that hides missing functionality — a feature is either shipped and
   working, or it is a row in `ROADMAP.md`.
2. Any deliberate shortcut gets a row in §2 **with a trigger**, in the same commit.
3. §2 is reviewed at each milestone (first paying customer, 100 signups, $1k MRR). Anything whose
   trigger has fired is scheduled immediately.
4. Interest rate, not size, sets priority. **T3 is the smallest item here and the most urgent** —
   it is losing money on every long video.
