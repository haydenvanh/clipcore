# Business Model

Bootstrapped. No runway to burn, so the model has to work at ten customers, not only at ten thousand.

---

## 1. The offer

**ClipCore turns long videos into short clips that are worth posting.**
Paste a YouTube link or upload a file. We transcribe it, score every moment, cut the best ones
vertical, and burn in captions. You download clips.

Sold in **minutes of source video processed**. `1 credit = 1 minute`. That is the entire pricing
rule, and it is deliberately the most legible unit in a category that sells fuzzy "credits",
length-gamed "clips", and duration-capped "videos" (see `COMPETITOR_ANALYSIS.md`).

| Plan | Price/mo | Credits | Minutes | Effective $/min |
| :--- | :--- | :--- | :--- | :--- |
| Basic | $9.99 | 150 | 150 | $0.067 |
| Pro | $14.99 | 300 | 300 | $0.050 |
| Ultra | $29.99 | 800 | 800 | $0.037 |

---

## 2. Unit economics

### 2.1 Cost to process one minute of source video

| Component | Cost/min | Basis |
| :--- | :--- | :--- |
| Transcription (Whisper API) | **$0.0060** | $0.006/min, published rate. The dominant variable cost. |
| Moment scoring (LLM) | $0.0003 | ~12k input + 2k output tokens per 60-min transcript ≈ $0.018/video. |
| Extraction + normalize (CPU) | ~$0.0001 | Remux is ~0.1× realtime. |
| Rendering + caption burn-in (CPU) | ~$0.0004 | ~10 clips × 45 s at `-preset veryfast` ≈ 3.75 s CPU per source minute. |
| Storage (R2, 6-month retention) | $0.0005 | ~0.5 GB per 60-min video at $0.015/GB-mo. |
| Bandwidth | **$0.0000** | **R2 has zero egress fees.** On S3 this line alone would be ~$0.045 per download. |
| **Total COGS** | **≈ $0.0073/min** | Round to **$0.009** for headroom. |

### 2.2 Margin per plan, at 100% allowance usage

| Plan | Revenue | Stripe (2.9%+$0.30) | COGS @ full use | Contribution | Margin |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Basic | $9.99 | $0.59 | $1.35 | **$8.05** | **81%** |
| Pro | $14.99 | $0.73 | $2.70 | **$11.56** | **77%** |
| Ultra | $29.99 | $1.17 | $7.20 | **$21.62** | **72%** |

Full usage is the pessimistic case. Prosumer SaaS typically runs 30–60% allowance utilization, which
puts realistic blended margin at **~88%**.

Two things worth naming honestly:
- **Stripe's $0.30 fixed fee is 3% of a $9.99 plan.** It is the single largest reason not to price
  below $9.99, and the strongest argument for annual billing later (one fee instead of twelve).
- **Ultra is the thinnest tier.** A power user who genuinely burns 800 minutes yields 72%. That is
  still healthy, and it is why the abuse guardrails in §5 exist.

### 2.3 Break-even

Fixed monthly cost at launch scale: **~$25** (Vercel Hobby $0 + Neon free $0 + Railway worker ~$5 +
R2 ~$1 + domain ~$1 + Resend free + Sentry free, with headroom).

> **Break-even ≈ 3 Basic subscribers. Break-even at 100-user scale (~$65/mo fixed) ≈ 8 subscribers.**

This is the number that makes bootstrapping viable: the business is profitable at a scale a single
Reddit post can produce.

### 2.4 LTV and the CAC ceiling

Creator tools churn hard — assume **10% monthly**, which is conservative-realistic for this category.

- Average lifetime: 1 / 0.10 = **10 months**
- Blended contribution (assume 60% Basic / 30% Pro / 10% Ultra, 50% utilization): **~$10.20/mo**
- **LTV ≈ $102**
- Healthy CAC at 3:1 → **max ~$34 per paying customer**

At an assumed 4% visitor→paid conversion, that is **~$1.36 allowable cost per visitor**.

**The consequence is strategic, not cosmetic.** Paid acquisition in this category runs $40–80 per
paying customer — above our ceiling. **Paid ads are off the table until LTV is measured, not
assumed.** Every launch channel in `FIRST_100_USERS.md` and `SEO_STRATEGY.md` is therefore organic
by necessity, not by preference.

---

## 3. Revenue model

**Primary: monthly subscription.** Recurring, predictable, and it makes the credit ledger the
system of record (`docs/02-ROADMAP.md` D4). Credits are granted on `invoice.paid` and expire at
period end with a one-period rollover cap — which protects margin against a user banking twelve
months of credits and spending them in one weekend.

**Secondary, later:**
- **Credit top-ups** — one-time packs for users who exhaust a plan mid-month. Captures overflow
  demand without forcing a tier change, and reuses the same Checkout path. *Post-launch.*
- **Annual billing at ~2 months free** — improves cash position and pays one Stripe fixed fee
  instead of twelve. *Post-first-100.*
- **API at $0.10/min** — Submagic validates this price. Pure margin on infrastructure that already
  exists. *Post-$1k MRR.*
- **Team seats** — agencies are 3–5× ARPU. *Post-$1k MRR.*

**Explicitly not doing:** ads, data resale, or a free tier without limits.

---

## 4. Path to $1,000 MRR

At the blended ~$13 ARPU implied by the plan mix: **~77 paying customers**.

| Milestone | Paying | MRR | Infra | Net | What it proves |
| :--- | :--- | :--- | :--- | :--- | :--- |
| First dollar | 1 | $10 | $25 | −$15 | Checkout works end to end. |
| Break-even | 3 | $30 | $25 | +$5 | The business funds itself. |
| First 100 signups | ~5 | $50 | $35 | +$15 | ~5% signup→paid. Measure it, don't assume it. |
| Product-market signal | 25 | $300 | $50 | +$250 | Month-2 retention >70%. |
| **$1k MRR** | **~77** | **$1,000** | **$65** | **+$935** | The wedge is real; now scale it. |

The gate between "first 100" and "$1k MRR" is **retention, not acquisition**. If month-2 retention
is under 60%, more traffic is wasted money — the correct response is the clip editor and caption
styles (roadmap items 20–21), not another launch post.

---

## 5. Risks to the model

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| **Whisper is 82% of COGS** | Margin compresses if pricing rises | Self-host `faster-whisper` on the worker → ~100× cheaper. Planned lever, not an emergency one. |
| **Abuse: one user uploads 800 min of 4K** | Margin per user collapses | Per-plan concurrency caps, max source duration, rate limiting (already scoped SHIP NOW #8). |
| **Free-trial farming** | Direct COGS with no revenue | Trial requires Google auth; one trial per verified email; 3 clips capped. |
| **10% churn is optimistic** | LTV drops, CAC ceiling drops with it | "Clips ready" email + monthly credit reset are both retention hooks. Measure cohort retention from week one. |
| **YouTube extraction breaks** | Core input path dies | Extractors isolated in one module; file upload is an always-available fallback path. |
| **A competitor drops to $5** | Price war we lose | Do not compete on price below $9.99 — Stripe's fixed fee makes it structurally unprofitable. Compete on the long-form wedge instead. |
| **Vendor (MuAPI) shuts down** | Current pipeline dies | The provider seam (D1) plus the native worker means this is a config flag, not an outage. |
