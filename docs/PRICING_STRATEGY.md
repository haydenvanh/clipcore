# Pricing Strategy

## 1. The decision

| Plan | Price/mo | Credits | Minutes | $/min | Positioning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Basic** | $9.99 | 150 | 150 | $0.067 | Entry. Undercuts every branded competitor. |
| **Pro** ⭐ | $14.99 | 300 | 300 | $0.050 | The intended default. |
| **Ultra** | $29.99 | 800 | 800 | $0.037 | Volume anchor. |

**One rule: `1 credit = 1 minute of source video processed`.** Not per clip, not per export, not
per feature. A 60-minute podcast costs 60 credits whether it yields 3 clips or 30.

## 2. Why minutes

The unit of sale is the most consequential pricing decision here, because every competitor gets it
wrong in a way we can name on our own pricing page.

| Competitor unit | The problem it creates for the buyer |
| :--- | :--- |
| **Credits** (Opus, Captions) | Consumed at different rates by different features. Cost per clip is unknowable before purchase. |
| **Clips** (Klap) | A 5-second clip costs the same as a 90-second one, so the tool's incentive is inverted against the user's. |
| **Videos + duration cap** (Submagic) | 15 videos at a **2-minute max** on the entry plan — the plan physically cannot process a podcast. |

Minutes are the only unit the buyer already possesses before they arrive. They know their video is
47 minutes long. They do not know how many "credits" that is. **Being the legible option in an
illegible category is itself the positioning** — and it is free to implement.

## 3. Why these numbers

**$9.99 is a floor, not a preference.** Stripe takes 2.9% + $0.30, so the fixed fee is 3% of the
price at $9.99 and 6% at $4.99. Below ~$8 the unit economics stop working regardless of COGS.
$9.99 also matches Snazo exactly, which removes price as a reason to choose them.

**$14.99 is engineered to be chosen.** The Basic→Pro step is **1.5× the price for 2× the minutes** —
the $/min drops 25%, so upgrading is visibly the better deal. Compare Klap's $14→$39 (2.8× for 3×)
or Opus's $15→$29 (1.9×). A gentle first step converts far more than a wide one, and Pro is where
the margin is best in absolute dollars.

**$29.99 is an anchor as much as a plan.** Its job is to make $14.99 read as moderate. It is also
the tier most exposed to heavy use (72% margin at full utilization), which is why the guardrails in
§6 matter most here.

**Margin holds across all three** — 81% / 77% / 72% at *full* allowance use, ~88% blended at
realistic utilization. Full derivation in `BUSINESS_MODEL.md §2`.

## 4. The free trial

**3 clips from one video, no watermark, no card.**

Opus watermarks its free tier; Submagic and Klap have no free tier at all. A watermarked clip
proves the tool runs but cannot be posted, so it demonstrates capability without delivering value.
An unwatermarked clip that a creator actually posts does both — and costs us **~$0.02**.

Guardrails: Google auth required (kills anonymous farming), one trial per verified email, max
30-minute source, results expire after 7 days.

## 5. What we will not do

| Rejected | Why |
| :--- | :--- |
| A cheaper $4.99 tier | Stripe's fixed fee eats 6%. It cannibalizes Basic and attracts the highest-support, lowest-LTV cohort. |
| Annual-only headline pricing (Klap's model) | Advertising $14 when monthly is $28 is the most-resented pattern in this category. We will *offer* annual later; we will never *quote* only annual. |
| Usage-based / pay-as-you-go at launch | Unpredictable bills kill consumer conversion, and it destroys MRR predictability — the one metric a bootstrapped business is steering by. |
| Per-seat pricing at launch | Our buyer is one creator. Seats arrive with teams, post-$1k MRR. |
| Feature-gating captions | Captions are the reason people pay. Gating them guts the trial's job. Gate on **minutes only** — one axis, easy to explain, easy to upgrade. |

## 6. Guardrails

Sold by minutes, so the abuse surface is minutes-adjacent:

- **Max source duration:** 60 min (Basic) / 180 min (Pro) / 300 min (Ultra).
- **Concurrency:** 1 / 2 / 4 simultaneous jobs. Protects the worker pool and creates a real,
  non-arbitrary reason to upgrade.
- **Credit expiry:** at period end, with **one period of rollover**. Prevents a user banking twelve
  months and spending it in one weekend at 0% margin.
- **Refunds:** failed jobs refund automatically via the ledger (`REFUND`). Manual refunds are an
  `ADJUST` entry — never a direct balance edit, so the ledger stays auditable.
- **Max upload size:** 2 GB, enforced at the presigned-URL step.

## 7. Changes to revisit — with the trigger, decided in advance

| Change | Trigger |
| :--- | :--- |
| Annual billing at 2 months free | 50+ paying customers (cash-flow lever, one Stripe fee instead of twelve). |
| Credit top-up packs | >20% of users exhaust their allowance mid-month. |
| Raise Basic to $12.99 | Conversion >6% **and** churn <8% — evidence that price is not the constraint. |
| API tier at $0.10/min | $1k MRR. Submagic prices the same thing at $0.10–0.15. |
| Team plan at ~$79 | 3+ inbound agency requests. |

Prices are configuration (`src/lib/plans.js`), not code. Changing one is an edit and a Stripe price
id, never a deploy of new logic.
