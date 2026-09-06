# Getting the First 100 Users

`BUSINESS_MODEL.md` sets the CAC ceiling at **~$34 per paying customer**. Paid acquisition in this
category runs $40–80. **So paid ads are not an option** — not as a philosophy, as arithmetic. Every
channel below is organic, and every one is something one person can do.

**Target:** 100 signups, ~5 paying, in 30 days. That is $50 MRR — past break-even (3 customers) and
enough data to know whether the wedge is real.

---

## The wedge, in one sentence

> **Your 2-hour podcast, on the $9.99 plan. Not a 2-minute cap.**

This is not a slogan; it is the gap in the market. Submagic's entry plan caps videos at **2 minutes**
and puts long-to-short behind a **$19/mo add-on** ($38/mo total). Klap counts *clips*, so long
sources are punished. Opus doesn't publish its limits at all. Every message below is a variation on
this one fact.

**Who to talk to, in priority order:**

1. **Podcasters** — the sharpest pain (2-hour episodes), the clearest ROI, and they already publish
   on a schedule. Start here.
2. **Course creators / educators** — long lectures, low editing skill, high willingness to pay.
3. **Long-form YouTubers** — largest population, most competitor noise, hardest to reach cheaply.

Not: TikTok-native creators. They film short. We are the wrong tool and they are the worst-fit,
highest-churn cohort.

---

## Channels, ranked by expected return per hour

### 1. Reddit — the highest-yield channel, and the easiest to get wrong

| Subreddit | Members | Angle |
| :--- | :--- | :--- |
| r/podcasting | ~300k | The 2-minute-cap comparison lands hardest here. |
| r/NewTubers | ~500k | Price-sensitive by definition. |
| r/SideProject, r/indiehackers | | Build-in-public; they convert as users *and* amplify. |
| r/VideoEditing, r/contentcreation | | Cheaper alternative to Opus/Submagic. |

**The rule that decides whether this works:** answer thirty questions before posting once. Reddit
punishes launches and rewards presence. The winning post is not "I built a tool" — it is a genuinely
useful teardown ("I compared what 5 AI clipping tools actually cost per minute — here's the table")
where ClipCore is one honest row among five. Publish the comparison from `COMPETITOR_ANALYSIS.md`
including where we lose. The credibility of admitting weaknesses is the entire mechanism.

*Expected: 30–50 signups. Cost: $0. Effort: ~10 h over 3 weeks.*

### 2. Direct outreach to podcasters — the highest conversion rate

Find 100 podcasts with 500–5,000 downloads: big enough to care about growth, small enough to have
no editor. Watch their actual episode. Clip it with ClipCore. Send the clips.

> "I made 3 shorts from your episode on X — attached, no strings. Built the tool that did it. If
> they're useful, it's $9.99/mo and there's no 2-minute limit like the others. If they're not,
> tell me why and I'll fix it."

Costs ~$0.15 in COGS per prospect. Converts an order of magnitude better than any ad because the
product demo *is* the outreach, and it doubles as user research: the ones who say no tell you
exactly what's wrong.

*Expected: 15–25 signups from 100 sends. Cost: ~$15. Effort: ~15 h.*

### 3. Build in public — compounding, start on day one

Daily on X/Twitter and IndieHackers: real numbers, real failures, real MRR. The audience is other
builders (who convert modestly) *and* the algorithm (which compounds). Post the unit economics.
Post the first churned customer. Specificity is what travels.

*Expected: 10–20 signups. Cost: $0. Effort: ~15 min/day.*

### 4. Product Hunt — one shot, so spend it late

Launch in **week 4**, not week 1 — after the product survives 50 real users. A PH launch on a buggy
product converts once and burns the channel permanently.

*Expected: 20–40 signups, 1–3 paying. Cost: $0. Effort: ~8 h.*

### 5. Comparison content — slow to start, the only channel that compounds

`/vs/submagic`, `/vs/opus-clip`, `/vs/klap`, `/vs/captions`. High-intent, low-competition, and the
searcher is already shopping. Full plan in `SEO_STRATEGY.md`.

*Expected: 5–10 signups in month 1, growing monthly. Cost: $0. Effort: ~10 h.*

### 6. Free tools as lead magnets

An ungated public transcript generator and a subtitle-format converter. They cost ~$0.006/min to
run, need no account, and rank for high-volume queries. The upsell is one line: *"Want clips from
this? →"*

*Expected: 10–20 signups. Cost: ~$5/mo. Effort: ~6 h.*

---

## The 30-day plan

| Week | Focus | Target |
| :--- | :--- | :--- |
| **1** | Ship the launch scope. Start building in public day one. Begin answering on Reddit — post nothing. | 5 signups (friends, first real test) |
| **2** | Reddit comparison post. Begin podcaster outreach (25 sends). Publish 2 comparison pages. | 25 signups, 1 paying |
| **3** | Outreach continues (75 sends). Ship the free transcript tool. Act on week-2 feedback. | 60 signups, 3 paying |
| **4** | Product Hunt. Reddit follow-up ("30 days in, here's what broke"). | 100 signups, 5 paying |

## What to measure — and the number that actually matters

| Metric | Target | If it misses |
| :--- | :--- | :--- |
| Visitor → signup | >8% | The landing page isn't clear. Rewrite the hero, not the ads. |
| Signup → first clip | **>60%** | **The most important number here.** Below it, onboarding is broken and nothing else matters. |
| First clip → paid | >15% | The free trial gives too much, or clip quality isn't there. |
| Month-2 retention | >60% | **Stop acquiring.** Fix the product. More traffic into a leaky bucket is wasted money. |

## What not to do

- **No paid ads.** CAC exceeds LTV. Revisit only when LTV is measured, not modelled.
- **No influencer deals.** $500–2,000 for unmeasurable reach; the whole month's infra is $6.
- **No cold email at scale.** Spam-trap risk, poisons the sending domain, ~0% conversion.
- **No Product Hunt in week 1.** One shot, and it should follow proof.
- **No feature requests from non-users.** Build for the people who paid.
