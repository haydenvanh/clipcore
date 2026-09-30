# Launch Checklist

Gate for going public. Nothing here is optional; anything that *is* optional lives in `ROADMAP.md`.

Status: ✅ done · ⏳ in progress · ⬜ not started

---

## 1. The product works end to end

The single test that matters — **run it as a stranger, in an incognito window, on the production
domain, paying with a real card**:

- ⬜ Land on `/`, understand the offer without scrolling twice
- ⬜ Sign in with Google
- ⬜ Paste a 45-minute YouTube URL
- ⬜ See real progress states, not an indefinite spinner
- ⬜ Receive ≥5 clips with burned-in captions in under 10 minutes
- ⬜ Download a clip and play it on a phone
- ⬜ Post one to TikTok — **it must look like something a creator would actually publish**
- ⬜ Upgrade to Pro through Stripe Checkout with a live card
- ⬜ See credits update within 5 seconds
- ⬜ Manage the subscription through the Stripe Portal
- ⬜ Cancel, and confirm access lasts until period end

If any step needs explaining, it is not ready.

## 2. Money

- ⬜ Live Stripe keys (not test) in production
- ⬜ Three recurring prices created; ids in env
- ⬜ Webhook endpoint on the live domain, **live-mode signing secret** (differs from test)
- ⬜ Subscribed events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`,
      `customer.subscription.updated`, `customer.subscription.deleted`
- ⬜ **Idempotency verified** — replay a webhook from the Stripe CLI, confirm credits granted once
- ⬜ Credits granted on renewal (advance a test clock)
- ⬜ Upgrade prorates; downgrade takes effect at period end
- ⬜ Failed payment → `PAST_DUE`, access restricted, dunning email sends
- ⬜ Customer Portal enabled and reachable from the dashboard
- ⬜ Ledger balances: `sum(CreditLedger.delta) == User.credits` for every user
- ⬜ Business details, statement descriptor, and support email set in Stripe

## 3. Security

- ✅ SSRF guard on every user-supplied URL (19 attack cases tested)
- ✅ Provider webhook authenticated, fail-closed
- ✅ IDOR closed — job status scoped to owner
- ✅ Credit debit atomic
- ✅ Credits refunded on failure
- ⬜ Rate limiting on every mutating route
- ⬜ Upload size cap (2 GB) enforced at the presigned-URL step
- ⬜ Route protection in `src/proxy.js` (Next 16 renamed `middleware` → `proxy`)
- ⬜ Security headers: HSTS, `X-Content-Type-Options`, `Referrer-Policy`, CSP
- ⬜ No secret reachable from the client bundle — `grep -r "NEXT_PUBLIC_" src/` reviewed
- ⬜ `npm audit` clean of high/critical
- ⬜ Stripe webhook signature verified before the body is parsed

## 4. Legal

- ⬜ `/terms` — Stripe requires it; the footer already links to it
- ⬜ `/privacy` — must state what we do with uploaded video and how long we keep it
- ⬜ Cookie/analytics disclosure
- ⬜ Refund policy stated on `/pricing` (a real one; disputes cost $15 each)
- ⬜ Contact email that a human reads
- ⬜ Google OAuth consent screen published (not in "testing" — it caps at 100 users)

## 5. Reliability

- ⬜ Sentry on web **and** worker
- ⬜ `/api/health` returns DB + queue depth
- ⬜ Uptime monitor on `/api/health` (UptimeRobot, free)
- ⬜ Alert on queue depth >50 or any job at `attempts >= maxAttempts`
- ⬜ Worker restarts automatically and reclaims jobs abandoned mid-flight
- ⬜ Retries with exponential backoff; dead-letter after `maxAttempts`
- ⬜ Database backup verified by **restoring it**, not by observing that it ran
- ⬜ Rollback rehearsed once

## 6. The launch content

- ⬜ Landing page: hero, demo video, features, pricing, FAQ, testimonials, CTA
- ⬜ **A real demo video** — a genuine source video and its genuine output. No mockups.
- ⬜ 3–5 sample clips embedded, from a real podcast, with permission
- ⬜ Pricing page with all three tiers and the guardrails stated honestly
- ⬜ FAQ answering the actual objections: *How long can my video be? What languages? Do I own the
      clips? What happens when credits run out? Can I cancel?*
- ⬜ OG images so shared links look intentional
- ⬜ 5 comparison pages live (`SEO_STRATEGY.md` Tier 1)
- ⬜ Testimonials from the first 10 real users — **quote real people or ship none.** Fabricated
      social proof is the fastest way to lose a launch thread.

## 7. Onboarding

- ⬜ Free trial: 3 clips, unwatermarked, no card
- ⬜ Empty dashboard suggests a sample video rather than showing a blank grid
- ⬜ "Your clips are ready" email
- ⬜ Time from signup to first clip **under 10 minutes** — measured, not estimated
- ⬜ Insufficient-credits state links to upgrade instead of erroring

## 8. Measurement

- ⬜ Analytics (Plausible or Vercel — GDPR-friendly, no banner)
- ⬜ Funnel events instrumented: `signup`, `video_submitted`, `clip_completed`, `clip_downloaded`,
      `checkout_started`, `subscription_created`
- ⬜ These write to the `Event` table, so cohort queries are SQL, not a vendor
- ⬜ Signup→first-clip conversion visible on day one (the number that decides everything else)

## 9. Load

- ⬜ 20 concurrent jobs queued — nothing deadlocks, ordering holds
- ⬜ A 3-hour video processes without OOM
- ⬜ 100 concurrent dashboard loads
- ⬜ Worker killed mid-job — the job is reclaimed and retried, credits are not double-charged
- ⬜ Credits under concurrency: 10 simultaneous jobs on a 5-credit balance → exactly one succeeds

---

## Go / no-go

**Ship when:** §1 passes end to end on production, §2 is fully green, §3 is fully green, §4 exists.

**Do not ship because** the landing copy could be better, more caption styles would be nice, the
admin panel isn't built, or the code could be TypeScript. None of those stop a stranger from paying.

**Immediately after launch, watch two numbers:**
1. **Signup → first clip.** Below 60%, stop marketing and fix onboarding.
2. **Job failure rate.** Above 5%, stop marketing and fix the pipeline.

Everything else can wait a week.
