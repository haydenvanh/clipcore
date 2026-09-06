# SEO Strategy

SEO is the only acquisition channel that compounds without ongoing spend — which makes it the right
long-term bet for a bootstrapped product and the wrong short-term one. **Expect nothing for 90
days.** `FIRST_100_USERS.md` carries months 1–3; this document carries months 4–18.

## 1. The strategy in one line

**Do not fight for "AI video clipping."** Opus, Klap, Captions, and Submagic have years of domain
authority and content budgets. A new domain will not rank for a head term this decade.

**Fight for the queries our competitors' limitations create.** Every constraint in
`COMPETITOR_ANALYSIS.md` is a search someone is typing right now, and the honest answer to it
happens to be our product.

## 2. Three tiers of target query

### Tier 1 — Comparison (highest intent, lowest competition) → *build first*

The searcher has a credit card out and is choosing between two tools. Conversion here is 5–10× any
informational page.

| Page | Query it answers | Our honest angle |
| :--- | :--- | :--- |
| `/vs/submagic` | "submagic alternative", "submagic 2 minute limit" | Their entry plan caps at 2 min and long-to-short is a $19 add-on. $38/mo vs our $9.99. |
| `/vs/opus-clip` | "opus clip alternative", "opus clip pricing" | They don't publish limits. We publish everything. |
| `/vs/klap` | "klap alternative", "klap monthly price" | Their headline price is annual-only; monthly is ~2×. |
| `/vs/captions` | "captions ai alternative" | They're a generative studio. We do one job. |
| `/vs/snazo` | "snazo alternative", "snazo pricing" | Three tiers, published specs, more than 9:16. |
| `/compare/ai-clipping-tools` | "best ai clipping tool", "cheapest ai clipping" | The full five-way table — **including where we lose.** |

**The rule that makes these work: be scrupulously fair.** State competitor strengths plainly and
keep prices current. Comparison pages that read as marketing get bounced and eventually penalized;
ones that read as research get linked, quoted, and cited by other people's comparison posts. Our
weaknesses are already documented in `COMPETITOR_ANALYSIS.md §4` — publish them.

### Tier 2 — Use case (medium intent, defensible)

`/for/podcasters` · `/for/youtubers` · `/for/course-creators` · `/for/agencies`

Plus the long-tail how-to cluster, which is where the wedge lives:
"how to clip a 2-hour podcast", "turn a long video into shorts free", "how to get clips from a
YouTube video", "how to add karaoke captions to a video".

### Tier 3 — Free tools (highest volume, zero intent, best link magnets)

| Tool | Why it earns its keep |
| :--- | :--- |
| `/tools/transcript-generator` | Huge volume. Runs on infrastructure we already have. ~$0.006/min. |
| `/tools/srt-to-vtt` | Pure client-side. Zero cost, permanent trickle. |
| `/tools/youtube-thumbnail-downloader` | Enormous volume, trivially cheap, links naturally to us. |
| `/tools/video-aspect-ratio-calculator` | Client-side, ranks fast. |

Ungated, no account, genuinely useful. Each carries one honest line: *"Want clips from this? →"*.
These are what earn backlinks; comparison pages are what earn revenue.

## 3. Technical SEO

Next.js 16 App Router gives us server rendering for free. The things that actually need doing:

- [ ] `sitemap.js` and `robots.js` (App Router file conventions).
- [ ] `generateMetadata` per route — unique title and description on every page.
- [ ] OG images per page (`opengraph-image.js`; note Next 16 passes `params` as a **Promise**).
- [ ] JSON-LD: `SoftwareApplication` + `Offer` on `/pricing`, `FAQPage` on the landing FAQ,
      `Article` on comparisons.
- [ ] Canonical URLs; one host (www or apex, not both).
- [ ] Core Web Vitals: LCP <2.5 s. The current landing hero must not ship a 3 MB video —
      poster image plus lazy-loaded `<video>`.
- [ ] `/blog` and `/vs` as **static** routes so they're CDN-cached and instant.
- [ ] Internal linking: every comparison page links to `/pricing` and to two sibling comparisons.

## 4. Content cadence

One good page per week beats five thin ones. Order is deliberate — highest intent first, so the
earliest traffic is the most likely to convert.

| Month | Ship | Rationale |
| :--- | :--- | :--- |
| 1 | 5 comparison pages + `/compare` | Highest intent. Also doubles as sales collateral for Reddit and outreach. |
| 2 | 4 use-case pages + 2 free tools | Broaden while comparisons age into rankings. |
| 3 | 4 how-to articles + 2 free tools | Long tail; link-building. |
| 4–6 | 1 article/week, refresh comparisons monthly | Prices change. Stale comparisons lose trust and rankings together. |

## 5. Link building without a budget

1. **Free tools** are the primary mechanism — people link to useful tools, never to landing pages.
2. **The pricing teardown.** A public, maintained, fair cost-per-minute table across all five tools
   is genuinely useful and gets cited. Being the neutral source of truth in a category that hides
   its pricing is a durable, cheap position.
3. **Build-in-public posts** on IndieHackers, Hacker News, and dev.to earn contextual links.
4. **Directories** worth the time: Product Hunt, AlternativeTo, SaaSHub, There's An AI For That,
   Futurepedia.
5. **Never buy links.**

## 6. Targets, and when to quit

| | Traffic/mo | Signups/mo | Ranking |
| :--- | :--- | :--- | :--- |
| Month 3 | 200 | 5 | Long tail only |
| Month 6 | 1,500 | 40 | Page 1 for 2–3 comparisons |
| Month 12 | 8,000 | 200 | Page 1 for most comparisons + several tools |

**Kill criterion, agreed in advance:** if month 6 shows fewer than 500 monthly organic visitors,
SEO is not working for this domain. Redirect the effort into outreach and partnerships rather than
writing more pages — sunk-cost content is the classic bootstrapped failure mode.
