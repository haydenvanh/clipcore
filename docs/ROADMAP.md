# ClipCore — Roadmap & Feature Prioritization

> Bootstrapped. No outside capital. Every decision optimizes for **time-to-first-paying-customer**,
> then for **gross margin**, then for everything else.

The filter, applied to every line below: *does this increase acquisition, retention, revenue, or
clip quality?* If not, it is not on this roadmap at all — it is in `TECH_DEBT.md` or nowhere.

---

## 0. The smallest publicly launchable product

A stranger must be able to arrive, understand the offer, pay, upload a video, and get clips they
would actually post. That is the whole bar. Concretely, **eleven things**:

1. A landing page that explains the offer and converts.
2. Google sign-in *(already works)*.
3. Paste a YouTube URL **or** upload a file.
4. Transcribe it.
5. Pick the best moments with scores you can see.
6. Cut vertical 9:16 clips.
7. Burn in karaoke captions. **This is the feature people pay for.**
8. Download the clip.
9. Stripe subscription with three plans.
10. Credits that decrement correctly and refund on failure.
11. Clips that don't disappear (our own storage).

Everything else — TikTok/Instagram ingest, 8 languages, 5 platform presets, an admin panel,
a queue dashboard, animated caption variants — is **post-launch**. They are in the brief and they
are on this roadmap; they are simply not what stands between us and the first $9.99.

**Deliberately cut from v1, with the reasoning:**

| Cut | Why it can wait |
| :--- | :--- |
| TikTok / Instagram ingest | ~90% of long-form source material is YouTube or a local file. Short-form input is a strange input for a *long-to-short* tool. |
| 8 caption languages | Whisper already detects and transcribes them; only the *UI* to choose is missing. Ship English, add a dropdown in week 3. |
| 1:1 and 16:9 output | 9:16 is what the category is for. The render pipeline is ratio-parameterized from day one, so adding them is a config line, not work. |
| Admin panel | At <100 users, a saved SQL query answers every question a dashboard would. |
| Email/password login | Google covers ~85% of consumer SaaS signups. Adding it before anyone has signed up is optimizing an empty funnel. |
| Animated + word-by-word captions | Karaoke is the style that sells. Ship one style done well. |

---

## 1. The prioritization system

Four buckets, gated by evidence rather than by date.

| Bucket | Gate | Question it answers |
| :--- | :--- | :--- |
| **SHIP NOW** | — | Is the product broken, unsafe, or unable to take money? |
| **SHIP BEFORE PUBLIC LAUNCH** | Ship Now done | Would a stranger pay for this and come back? |
| **SHIP AFTER FIRST 100 USERS** | 100 signups | What did real usage prove we were wrong about? |
| **SHIP AFTER $1,000 MRR** | $1k MRR | What now needs to scale, or opens a new segment? |

**Estimate legend.**
*Dev* = focused engineering days.
*Maint* = ongoing burden — 🟢 set-and-forget · 🟡 occasional · 🔴 actively breaks.
*Infra* = added monthly cost at 100 users.
*Rev* = revenue impact — ⭐ to ⭐⭐⭐⭐⭐.

---

### 🔴 SHIP NOW — *the product cannot ship without these*

| # | Feature | Dev | Maint | Infra | Rev | Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **Security hotfix** — SSRF guard, webhook auth, IDOR fix, atomic credits | 1d | 🟢 | $0 | ⭐⭐⭐⭐⭐ | ✅ **DONE.** An unauthenticated write path and an anonymous SSRF are not launchable at any user count. |
| 2 | **Schema + migrations** | 1d | 🟢 | $0 | ⭐⭐⭐⭐ | ✅ **DONE.** 18 tables, 44 indexes. Everything else builds on it. |
| 3 | **Billing that works** — 3 plans, Checkout, Portal, idempotent webhook, ledger | 2d | 🟡 | $0 | ⭐⭐⭐⭐⭐ | Checkout currently 500s on every call. Revenue is literally $0 until this lands. |
| 4 | **R2 storage + presigned upload** | 1d | 🟢 | ~$1 | ⭐⭐⭐⭐ | Zero egress fees. Without it every clip breaks when the vendor CDN rotates. |
| 5 | **Worker + Postgres queue** | 2d | 🟡 | $5–20 | ⭐⭐⭐⭐⭐ | Vercel cannot run ffmpeg. This is the product's engine. |
| 6 | **Extract → transcribe → score → render → caption** | 4d | 🔴 | usage | ⭐⭐⭐⭐⭐ | The actual product. |
| 7 | **Landing page + dashboard** | 2d | 🟢 | $0 | ⭐⭐⭐⭐⭐ | Today `/` is a bare tool. No landing page = no conversion, however good the clips are. |
| 8 | **Rate limiting + input validation** | 0.5d | 🟢 | $0 | ⭐⭐⭐ | Every API call costs us vendor money. Unmetered endpoints are a bill waiting to happen. |
| | **Subtotal** | **~13.5d** | | **~$25/mo** | | |

### 🟠 SHIP BEFORE PUBLIC LAUNCH — *needed to survive contact with strangers*

| # | Feature | Dev | Maint | Infra | Rev | Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 9 | Error tracking (Sentry free tier) | 0.5d | 🟢 | $0 | ⭐⭐⭐ | You cannot fix what you cannot see. Free to 5k events/mo. |
| 10 | Transactional email — receipts, job-done, reset | 0.5d | 🟢 | $0 | ⭐⭐⭐ | Resend free tier = 3k/mo. "Your clips are ready" is a retention feature. |
| 11 | Terms + Privacy pages | 0.5d | 🟢 | $0 | ⭐⭐⭐ | Stripe requires them. Footer already 404s to them. |
| 12 | Free trial: 3 clips, watermarked | 1d | 🟢 | usage | ⭐⭐⭐⭐⭐ | The single highest-leverage conversion mechanic in this category. Every competitor does it. |
| 13 | Job progress UI (real states, not a spinner) | 1d | 🟢 | $0 | ⭐⭐⭐⭐ | A 6-minute silent spinner is the #1 abandonment cause in async tools. |
| 14 | Retry + dead-letter on the queue | 0.5d | 🟡 | $0 | ⭐⭐⭐ | Transcoding fails constantly. Silent failure burns credits and trust. |
| 15 | Caption language picker (Whisper autodetect + 8 languages) | 0.5d | 🟢 | $0 | ⭐⭐⭐ | Whisper already returns them. This is a `<select>`, not a feature. |
| 16 | 1:1 and 16:9 output ratios | 0.5d | 🟢 | usage | ⭐⭐ | Render is already ratio-parameterized. |
| | **Subtotal** | **~5d** | | **~$0** | | |

### 🟡 SHIP AFTER FIRST 100 USERS — *evidence-gated*

| # | Feature | Dev | Maint | Infra | Rev | Gate |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 17 | Email/password + reset | 1d | 🟡 | $0 | ⭐⭐ | Only if signup analytics show Google-only drop-off. |
| 18 | TikTok + Instagram ingest | 2d | 🔴 | $0 | ⭐⭐ | Only if support requests ask for it. Extractors break weekly — real maintenance. |
| 19 | Platform presets (TikTok/Reels/Shorts/X/FB) | 1d | 🟢 | $0 | ⭐⭐⭐ | Mostly metadata over existing ratios. |
| 20 | Animated + word-by-word caption styles | 2d | 🟡 | $0 | ⭐⭐⭐⭐ | Style variety is the top upgrade driver in this category. |
| 21 | Clip editor — trim, reposition captions | 4d | 🔴 | $0 | ⭐⭐⭐⭐ | The most-requested feature in every competitor's reviews. Expensive; wait for proof. |
| 22 | Admin panel (users, MRR, churn, queue) | 2d | 🟡 | $0 | ⭐ | Below 100 users, SQL is faster than building this. |
| 23 | Active-speaker reframing | 3d | 🔴 | usage | ⭐⭐⭐⭐ | Real quality lift. Needs face detection in the worker. |
| 24 | Referral / affiliate | 1.5d | 🟡 | $0 | ⭐⭐⭐⭐ | Cheapest acquisition channel once there is something to refer. |

### 🟢 SHIP AFTER $1,000 MRR — *scale and expansion*

| # | Feature | Dev | Maint | Infra | Rev | Gate |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 25 | BullMQ + Redis, autoscaled workers | 2d | 🟡 | +$15 | ⭐⭐ | Trigger: >50 jobs/min or >4 workers (roadmap D6). |
| 26 | Direct publishing to TikTok/IG/YT | 5d | 🔴 | $0 | ⭐⭐⭐⭐ | OAuth per platform, review processes. Big retention lever. |
| 27 | Team seats / workspaces | 4d | 🟡 | $0 | ⭐⭐⭐⭐⭐ | Opens agencies — 3–5× ARPU. |
| 28 | Public API + API plan | 3d | 🟡 | $0 | ⭐⭐⭐⭐ | Submagic charges $0.15/min for exactly this. |
| 29 | B-roll, music, sound effects | 5d | 🔴 | usage | ⭐⭐⭐ | Table stakes at the $29 tier, not at $9.99. |
| 30 | 50+ caption languages | 1d | 🟢 | $0 | ⭐⭐⭐ | Whisper covers ~99. It is a list and QA, not engineering. |
| 31 | Analytics — which clips performed | 4d | 🔴 | $0 | ⭐⭐⭐⭐⭐ | Turns a tool into a system of record. Strongest retention feature available. |

---

## 2. Scaling plan — 10 → 100 → 1,000 users, without a rewrite

The architecture is deliberately boring so that growth is a **configuration change**, not a
re-platform. What changes at each step:

| | **10 users** | **100 users** | **1,000 users** |
| :--- | :--- | :--- | :--- |
| Web | Vercel Hobby ($0) | Vercel Pro ($20) | Vercel Pro ($20) |
| Postgres | Neon free (0.5 GB) | Neon Launch ($19) | Neon Scale ($69) + read replica |
| Queue | `Job` table, 1 worker | `Job` table, 2 workers | `Job` table, 4 workers → BullMQ **only if** >50 jobs/min |
| Worker | Railway 1×0.5 vCPU ($5) | Railway 2×1 vCPU ($20) | Railway 4×2 vCPU ($80) + autoscale |
| Storage | R2 ($0–1) | R2 (~$5) | R2 (~$40) |
| Transcription | Whisper API | Whisper API | Self-hosted `faster-whisper` on the worker (~10× cheaper) |
| **Infra/mo** | **~$5** | **~$65** | **~$210** |
| **MRR @ 5% paid** | — | ~$75 | ~$750 |

**Why nothing needs rewriting.** The three load-bearing choices absorb 100× growth:

1. **Stateless web tier.** Every route handler is pure request→Postgres→response. Vercel scales it
   horizontally for free. No sticky sessions (JWT strategy, roadmap D3), no in-memory state.
2. **The queue is a table.** `SELECT … FOR UPDATE SKIP LOCKED` is correct with 1 worker and with
   40. Adding capacity is adding a container. Postgres handles thousands of jobs/min before the
   pattern strains — and the migration to BullMQ keeps the same `Job` row as the durable record, so
   it is an adapter swap, not a redesign.
3. **The ledger is append-only.** Correct at any scale, and the balance cache means reads never
   aggregate.

**The one thing that will actually hurt at 1,000 users** is worker CPU for rendering — it is the
only linear-in-usage cost we control. The mitigation is planned and cheap: move from Whisper API to
self-hosted `faster-whisper` on the worker (cuts the largest variable cost ~10×) and render at
`-preset veryfast`. Neither is a rewrite.

---

## 3. Execution order

| Step | Scope | Status |
| :--- | :--- | :--- |
| 0 | Security hotfix | ✅ **Done** — 37 tests passing |
| 1 | Schema + baseline migration | ✅ **Done** — 18 tables, 44 indexes |
| 2 | Billing: plans, Checkout, Portal, webhook, ledger | ▶ Next |
| 3 | R2 storage + presigned upload | |
| 4 | Worker + queue + extract/transcribe/score/render | |
| 5 | Landing page + dashboard | |
| 6 | Rate limiting, validation, Sentry, email | |
| 7 | Launch checklist → public launch | |

Detailed architectural reasoning for each: `docs/02-ROADMAP.md`.
Audit that produced this plan: `docs/01-AUDIT.md`.
