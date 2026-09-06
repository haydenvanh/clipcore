# Deployment

Target: **~$5/month at launch**, ~$65/month at 100 users. Every service below has a free tier that
covers launch scale.

> **Status legend:** ✅ deployable today · ⏳ arrives with the step named.

## 1. Topology

```
                    ┌────────────────────────────┐
   Browser ────────►│  Vercel — Next.js 16       │ ✅
                    │  pages + API routes        │
                    └────┬──────────────┬────────┘
                         │              │ presigned PUT/GET
              enqueue    │              ▼
                    ┌────▼─────┐   ┌──────────────┐
                    │ Postgres │◄──│ Cloudflare R2│ ⏳ Step 3
                    │  (Neon)  │   │ zero egress  │
                    └────▲─────┘   └──────▲───────┘
                         │ FOR UPDATE            │
                         │ SKIP LOCKED           │
                    ┌────┴──────────────────┐    │
                    │ Worker (Railway)      │────┘  ⏳ Step 4
                    │ yt-dlp · ffmpeg ·     │
                    │ whisper · scoring     │
                    └───────────────────────┘

   Stripe ──webhook──► /api/webhook/stripe   ✅ (rebuilt Step 2)
   MuAPI  ──webhook──► /api/webhook/muapi    ✅ authenticated
```

**Why the web tier and the worker are separate processes.** Vercel functions cannot run ffmpeg
(no persistent disk, no large binaries, a hard execution ceiling). Rendering a 60-minute podcast
takes minutes of CPU. Splitting them is not premature architecture — it is the only arrangement
that works, and it lets each scale on its own axis.

## 2. Services and cost

| Service | Purpose | Launch | 100 users | 1,000 users |
| :--- | :--- | :--- | :--- | :--- |
| **Vercel** | Web + API | Hobby $0 | Pro $20 | Pro $20 |
| **Neon** | Postgres | Free 0.5 GB | Launch $19 | Scale $69 |
| **Railway** | Worker container | $5 | $20 | $80 |
| **Cloudflare R2** | Object storage | ~$0 | ~$5 | ~$40 |
| **Resend** | Transactional email | Free 3k/mo | Free | $20 |
| **Sentry** | Errors | Free 5k/mo | Free | $26 |
| **Domain** | | ~$1/mo | ~$1 | ~$1 |
| **Total** | | **~$6** | **~$65** | **~$256** |

**Why R2 over S3.** Egress is free. At 100 users downloading ~50 GB/month, S3 would add ~$4.50/mo
and grow linearly with success — a cost that scales with exactly the behaviour we want. R2 is
S3-API-compatible, so this is three environment variables, not a code path.

**Why Neon over Supabase/RDS.** Scale-to-zero on the free tier, and database branching gives us a
staging environment for free (pays down debt item T6).

## 3. Environment variables

| Variable | Where | Required | Notes |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Vercel + Worker | ✅ | Pooled connection. |
| `DIRECT_URL` | Vercel + Worker | ✅ | Unpooled; migrations only. |
| `NEXTAUTH_URL` | Vercel | ✅ | Full production origin. |
| `NEXTAUTH_SECRET` | Vercel | ✅ | `openssl rand -base64 32`. |
| `GOOGLE_CLIENT_ID` / `_SECRET` | Vercel | ✅ | Redirect URI: `https://<domain>/api/auth/callback/google`. |
| `STRIPE_SECRET_KEY` | Vercel | ✅ | Live key at launch. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Vercel | ✅ | Public. |
| `STRIPE_WEBHOOK_SECRET` | Vercel | ✅ | Per-endpoint; **differs between test and live**. |
| `STRIPE_PRICE_BASIC` / `_PRO` / `_ULTRA` | Vercel | ✅ | Recurring price ids. |
| `AICLIPS_API_KEY` | Vercel | ✅ | MuAPI provider. |
| `WEBHOOK_URL` | Vercel | ✅ | Public origin for provider callbacks. |
| `MUAPI_WEBHOOK_SECRET` | Vercel | ✅ | **Fail-closed** — callbacks are rejected without it. `openssl rand -hex 32`. |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Both | ⏳ | Step 3. |
| `OPENAI_API_KEY` | Worker | ⏳ | Whisper + scoring. Step 4. |
| `WORKER_CONCURRENCY` | Worker | ⏳ | Default 2. |
| `SENTRY_DSN` | Both | ⏳ | Step 6. |
| `RESEND_API_KEY` | Vercel | ⏳ | Step 6. |
| `NEXT_PUBLIC_THEME` | Vercel | — | `slate-indigo` \| `cyberpunk` \| `emerald` \| `sunset` \| `midnight`. |

Never expose to the browser: anything without a `NEXT_PUBLIC_` prefix. `src/lib/config.js` warns at
boot for each missing required key.

## 4. First deploy

```bash
# 1. Database
#    Create a Neon project, copy both connection strings.
npx prisma migrate deploy          # applies the tracked baseline migration

# 2. Web
vercel link && vercel env pull     # set the vars from the table above in the dashboard
vercel --prod

# 3. Stripe — create three recurring prices, then one webhook endpoint
#    https://<domain>/api/webhook/stripe
#    events: checkout.session.completed, invoice.paid, invoice.payment_failed,
#            customer.subscription.updated, customer.subscription.deleted

# 4. Google OAuth — add the production redirect URI
#    https://<domain>/api/auth/callback/google
```

`npm run build` runs `prisma generate` first, so the client is always current on Vercel.

## 5. Operational notes

**Migrations.** `prisma migrate deploy` in a release step — never `db push` against production.
The baseline lives at `prisma/migrations/20260906000000_clipcore_baseline/`.

**Rollback.** Vercel keeps every deployment; promote a previous one instantly. Database rollback is
the harder direction, so migrations are written additive-first (add column → deploy → backfill →
drop later), which keeps the previous release running against the new schema.

**Backups.** Neon retains 7 days of point-in-time history on paid tiers. On the free tier take a
weekly `pg_dump` — the ledger is the one table whose loss is unrecoverable.

**Health.** `/api/health` returns DB connectivity and queue depth. Alert on queue depth >50 or on
any job with `attempts >= maxAttempts`.

**Secrets.** Rotating `MUAPI_WEBHOOK_SECRET` invalidates in-flight callbacks — jobs still resolve
via the status poll, so rotate during a quiet window and accept a short callback gap.
