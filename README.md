# ClipCore

**Turn long videos into clips that travel.**

ClipCore watches your long-form video, finds the moments worth posting, and cuts them into
captioned, platform-ready clips. Every clip carries a viral score *and the reasoning behind it*.

> **The wedge:** a two-hour podcast on the $9.99 plan. Competing tools cap entry-tier videos at
> two minutes, count clips instead of minutes, or don't publish their limits at all.

https://github.com/user-attachments/assets/018738b8-af50-4a08-a7ac-1090b5b1f903

---

## Pricing

One rule: **1 credit = 1 minute of source video processed.** Not per clip, not per export.

| Plan | Price | Credits | Max video | Concurrent jobs |
| :--- | :--- | :--- | :--- | :--- |
| Basic | $9.99/mo | 150 min | 60 min | 1 |
| Pro | $14.99/mo | 300 min | 3 h | 2 |
| Ultra | $29.99/mo | 800 min | 5 h | 4 |

Reasoning behind these numbers: [`docs/PRICING_STRATEGY.md`](docs/PRICING_STRATEGY.md).

## Stack

| Layer | Choice |
| :--- | :--- |
| Web | Next.js 16 (App Router) · React 19 · Tailwind v4 |
| Auth | NextAuth v4 + Prisma adapter (Google) |
| Data | PostgreSQL + Prisma 7 (driver adapter) |
| Billing | Stripe subscriptions + Customer Portal |
| Storage | Cloudflare R2 (S3-compatible) — *in progress* |
| Worker | Node + ffmpeg + yt-dlp on Railway — *in progress* |
| Queue | Postgres `FOR UPDATE SKIP LOCKED` |

## Architecture at a glance

```
Browser ──► Vercel (Next.js pages + API routes)
                │
                ├──► Postgres (Neon)  ◄── worker claims jobs with SKIP LOCKED
                ├──► Cloudflare R2    ◄── presigned PUT/GET, zero egress
                ├──► Stripe           ──► /api/webhook/stripe (idempotent)
                └──► Clip provider    ──► /api/webhook/muapi   (authenticated)
```

Two decisions worth knowing before you read the code:

- **The clipping provider is a seam, not a dependency.** `muapi` is the default so nothing
  regresses; a native worker (yt-dlp → ffmpeg → Whisper → scoring) is being built behind the same
  interface. Rationale: [`docs/02-ROADMAP.md`](docs/02-ROADMAP.md) D1.
- **Credits are an append-only ledger.** `User.credits` is a cache written in the same transaction
  as every ledger entry. Jobs *hold* credits, then *settle* or *refund* — so a failed job never
  silently burns a balance. D4 in the same document.

## Local development

**Prerequisites:** Node 20.9+, a PostgreSQL database (local, or free on [Neon](https://neon.tech)).

```bash
npm install
cp .env.example .env      # fill in the values described below
npx prisma migrate deploy # applies the tracked baseline migration
npm run dev
```

Open http://localhost:3000.

```bash
npm test          # vitest — 59 tests
npm run lint
npm run build
```

## Environment

See [`.env.example`](.env.example) for the annotated list and
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for where each value comes from.

Two that are easy to miss:

- **`MUAPI_WEBHOOK_SECRET`** — required. The provider callback endpoint **fails closed** without
  it, because an unauthenticated write path into other users' jobs is worse than a missed callback.
- **`STRIPE_PRICE_BASIC` / `_PRO` / `_ULTRA`** — checkout refuses a plan whose Stripe price id is
  not configured, rather than guessing.

## Documentation

| Document | What it covers |
| :--- | :--- |
| [`01-AUDIT.md`](docs/01-AUDIT.md) | Full audit of the codebase this was built from — 43 findings, traced |
| [`02-ROADMAP.md`](docs/02-ROADMAP.md) | Architectural decision records |
| [`ROADMAP.md`](docs/ROADMAP.md) | Feature prioritization, scaling plan for 10 → 1,000 users |
| [`TECH_DEBT.md`](docs/TECH_DEBT.md) | Debt register, each item with an interest rate and a payoff trigger |
| [`DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Topology, cost per tier, env matrix, first deploy |
| [`BUSINESS_MODEL.md`](docs/BUSINESS_MODEL.md) | Unit economics, LTV/CAC, path to $1k MRR |
| [`PRICING_STRATEGY.md`](docs/PRICING_STRATEGY.md) | Why minutes, why these numbers |
| [`COMPETITOR_ANALYSIS.md`](docs/COMPETITOR_ANALYSIS.md) | Snazo, Opus Clip, Klap, Captions, Submagic |
| [`FIRST_100_USERS.md`](docs/FIRST_100_USERS.md) | Acquisition plan — organic only, and why |
| [`SEO_STRATEGY.md`](docs/SEO_STRATEGY.md) | Comparison pages, free tools, technical SEO |
| [`LAUNCH_CHECKLIST.md`](docs/LAUNCH_CHECKLIST.md) | Go/no-go gate |

## Status

Working: Google auth · landing page · pricing · Stripe subscriptions + Portal · credit ledger ·
gallery · MuAPI clipping pipeline.

In progress: R2 storage · background worker · transcription · viral scoring · caption rendering.

Current position in the plan: [`docs/ROADMAP.md`](docs/ROADMAP.md) §3.

## License

MIT — see [LICENSE](LICENSE).

Built on the [ai-clipping-generator](https://github.com/SamurAIGPT/ai-clipping-generator) template.
