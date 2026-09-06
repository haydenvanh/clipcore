# Competitor Analysis

Pricing verified from each vendor's own pricing page, September 2026. Where a vendor does not
publish minutes, the "effective $/min" column is derived from their stated video or clip limits and
marked *(derived)*.

---

## 1. The landscape at a glance

| | **Snazo** | **Opus Clip** | **Klap** | **Captions** | **Submagic** | **ClipCore** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Entry price | $9.99/mo | $15/mo | $14/mo *(annual)* | $24.99/mo | $19/mo | **$9.99/mo** |
| Mid tier | — | $29/mo | $39/mo | $69.99/mo | $39/mo | **$14.99/mo** |
| Top published | — | Custom | $94/mo | $279.99/mo | $69/mo | **$29.99/mo** |
| Free tier | ❌ | ✅ watermarked | ❌ | ✅ limited | ❌ | ✅ *planned, 3 clips* |
| Unit of sale | clips | credits | **clips** | credits | **videos + duration cap** | **minutes** |
| Entry allowance | ~10/video | undisclosed | 100 clips | 500 credits | 15 videos, **2 min max** | **150 min** |
| Effective $/min | ~$0.07 *(derived)* | undisclosed | ~$0.14 *(derived)* | ~$0.05 *(derived)* | **$0.63** *(derived)* | **$0.067** |
| Languages | undisclosed | multi | multi | **100+** | **40+** | 8 → 50+ |
| Virality scoring | ✅ | ✅ | ✅ | ➖ | add-on | ✅ |
| Caption styles | ✅ | ✅ animated | ✅ | ✅ | ✅ **best in class** | karaoke → 3 styles |
| Direct publishing | ❌ | ✅ | ✅ | ✅ | ✅ | post-$1k MRR |
| Public API | ❌ | Business tier | ❌ | ❌ | ✅ **$0.10–0.15/min** | post-$1k MRR |
| AI avatars / voice clone | ❌ | ❌ | ❌ | ✅ | ❌ | never — out of scope |

---

## 2. Vendor-by-vendor: the exploitable weakness

### Snazo — *the direct model, and the closest target*

**Position.** $9.99/mo, ~10 clips per source, 9:16 only. The pitch is that every clip is *rewritten*
— reframed, re-captioned, re-paced — to avoid platform flagging and shadowbanning.

**Strengths.** Sharp, single-sentence positioning. Cheapest branded option. The anti-shadowban angle
is a real fear that no larger competitor addresses head-on.

**Weaknesses to exploit.**
1. **Radical opacity.** No published tier structure beyond the entry price, no language list, no
   export specs. A buyer cannot self-qualify. *Exploit: publish everything — full pricing table,
   language list, sample outputs, real limits. Transparency is free and converts.*
2. **9:16 only.** Anyone repurposing to YouTube or LinkedIn must use a second tool.
   *Exploit: ship 1:1 and 16:9 — near-zero cost for us since the renderer is ratio-parameterized.*
3. **Single tier visible.** Nothing to upgrade to, so ARPU is capped at $9.99.
   *Exploit: a three-tier ladder with an obvious upgrade trigger (minutes).*
4. **Unverifiable core claim.** "Avoids shadowbanning" cannot be proven and invites skepticism.
   *Exploit: compete on a claim we can demonstrate — a visible viral score with the model's stated
   reasoning per clip.*

### Opus Clip — *the category leader*

**Position.** $0 / $15 / $29 / custom. Broadest ingest (YouTube, Drive, Vimeo, Zoom, Rumble,
StreamYard), virality score, AI reframing, B-roll, scheduling.

**Strengths.** Brand recognition, the widest feature surface, a genuine free tier that seeds the funnel.

**Weaknesses to exploit.**
1. **The free tier is deliberately painful** — watermarked captions, 3-day media expiry, local
   import only. *Exploit: a free trial that produces one genuinely usable, unwatermarked clip.
   Costs us ~$0.02 and beats a watermark demo on conversion.*
2. **Undisclosed limits.** Neither the Starter nor the Pro plan publishes a minutes or clips cap;
   users discover the ceiling after paying. Reviews reflect the resulting frustration.
   *Exploit: "150 minutes. That's the whole rule." Certainty is a feature.*
3. **B-roll rationed to 3 clips/month** on the $15 tier — a feature present enough to advertise and
   absent enough to annoy. *Exploit: don't ship half a feature; ship captions completely.*
4. **Feature sprawl.** Voice-overs, B-roll, scheduling, analytics, SSO, API. Onboarding is heavy.
   *Exploit: paste a link → clips in one screen, no tour.*

### Klap — *the volume player*

**Position.** $14 / $39 / $94 per month, billed **yearly** (a 50% discount off monthly — so the real
monthly prices are roughly $28 / $78 / $188). Sold in clips: 100 / 300 / 1,000.

**Weaknesses to exploit.**
1. **The headline price is annual-only.** A user who wants to pay monthly pays roughly double the
   advertised number. This is the single most resented pattern in the category.
   *Exploit: one price, monthly, no annual lock-in required. Say so on the pricing page.*
2. **"Clips" is a hostile unit.** A 5-second clip and a 90-second clip cost the same credit, so the
   incentive is to generate fewer, longer clips — the opposite of what a creator wants.
   *Exploit: minutes of source processed. It maps to what the user actually has, and it is honest.*
3. **Steep ladder.** $14 → $39 is a 2.8× jump for 3× the clips. No middle rung.
   *Exploit: $9.99 → $14.99 is a 1.5× step for 2× the minutes — a genuinely easy upgrade.*

### Captions — *the adjacent giant*

**Position.** $0 / $24.99 / $69.99 / $139.99 / $279.99. Generative video: AI avatars, voice cloning,
B-roll generation, translation, 100+ caption languages.

**Weaknesses to exploit.**
1. **Not really a clipping tool.** It is a generative video studio; clip extraction is one feature
   among many. *Exploit: be the tool that does one job. "We turn your long video into clips.
   That's all we do."*
2. **2.5× our entry price** with an opaque credit unit — credits are consumed at different rates by
   different AI features, so cost per clip is unpredictable.
   *Exploit: 1 credit = 1 minute. Predictable to the point of boring.*
3. **AI-avatar positioning repels a real segment.** Podcasters and educators with genuine footage
   don't want synthetic presenters. *Exploit: "your face, your voice, your footage."*

### Submagic — *the caption specialist, and the most instructive*

**Position.** $19 / $39 / $69. Best-in-class caption styling, 40+ languages, an API at
$0.10–0.15/min. "Magic Clips" (long-to-short) is a **$19/mo add-on**, not core.

**Weaknesses to exploit.**
1. **The duration cap is brutal.** Starter allows 15 videos at a **2-minute maximum**, so the entry
   plan physically cannot process a podcast. Long-form is Pro ($39, 5 min) or Business ($69, 30 min).
   *Exploit: this is the widest gap in the entire market. A 60-minute podcast is our normal case at
   $9.99. Say it in the hero: "Your 2-hour podcast. Not a 2-minute cap."*
2. **Long-to-short is an upsell.** $19 + $19 = **$38/mo** for what we sell as the core product at
   $9.99. *Exploit: put that arithmetic on the comparison page.*
3. **$0.63/min effective on the entry plan** (15 × 2 min = 30 min for $19) — nearly **10× our rate**.
4. **Their API is the ceiling to beat, not the floor.** $0.10–0.15/min is what the market pays for
   programmatic clipping. It is our eventual API price, and it validates our margin.

---

## 3. Where ClipCore wins

Three positions the incumbents have structurally left open:

**1. Long-form is the normal case, not the premium case.**
Submagic caps entry at 2 minutes. Klap counts clips, punishing long sources. We sell minutes and
handle a 3-hour podcast on the cheapest plan. The market's pricing units are all hostile to exactly
the content people most want to clip.

**2. The unit of sale is honest and legible.**
Credits (Opus, Captions) are deliberately fuzzy. Clips (Klap) are gamed by length. Videos-with-a-cap
(Submagic) punish the long tail. **1 credit = 1 minute** is the only unit a buyer can price in their
head before paying — and being the legible option in an illegible category is itself positioning.

**3. Visible reasoning.**
Every competitor returns a virality score as an unexplained number. We return the score **and the
model's reasoning** — which moment, why it works, which signal drove it. That converts a black box
into a tool a creator can learn from, and it is nearly free for us since the scoring model produces
the reasoning anyway.

## 4. Where we lose, and the honest answer

| We lose on | Reality | Answer |
| :--- | :--- | :--- |
| Brand and trust | Opus and Captions have years and funding | Nothing to do but be transparent and cheap. Bootstrapped is a story, not an excuse. |
| Caption style variety | Submagic is genuinely better | Ship one style done well. Add two after 100 users. Do not fight them on breadth. |
| Direct publishing | Opus, Klap, Captions, Submagic all have it | Real gap. Scheduled post-$1k MRR. Download-first is acceptable at $9.99. |
| Language breadth | Captions 100+, Submagic 40+ | Whisper already covers ~99 — this is a UI list, not a capability gap. Closes in one day. |
| Editing after generation | Most have an editor | The most expensive gap (~4 dev-days). Gated on first-100 feedback. |

**The honest strategic read.** We cannot out-feature this field and should not try. We can be
*cheaper per minute than everyone, honest about limits in a category built on hiding them, and
uniquely willing to handle long content on the cheapest plan.* That is a real wedge into
podcasters, course creators, and long-form YouTubers — the exact segment Submagic's 2-minute cap
and Klap's clip-counting actively push away.
