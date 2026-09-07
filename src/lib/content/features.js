/**
 * The product ecosystem.
 *
 * One source of truth for the features nav, the /features index, and every
 * /features/[slug] page — so a feature cannot appear in the menu without a
 * page, or ship a page nobody can navigate to.
 *
 * `status` is "shipped" | "beta" | "planned". It drives a chip on every
 * surface: a visitor should be able to tell what they can use today from what
 * is on the roadmap without reading the changelog.
 */

/** @typedef {"shipped"|"beta"|"planned"} FeatureStatus */

export const CATEGORIES = {
  create: "Create",
  intelligence: "Intelligence",
  scale: "Scale",
  build: "Build",
};

export const FEATURES = [
  {
    slug: "ai-producer",
    name: "AI Producer",
    category: "create",
    status: "shipped",
    tagline: "Raw footage in. Publish-ready content out.",
    summary:
      "Point it at a long video and it selects the moments, writes the hooks, captions them, and sizes each cut for the platform it is going to.",
    capabilities: [
      "Moment selection scored on speech, reaction, emotion and topic movement",
      "Hook extraction quoted from the transcript, never invented",
      "Word-level captions burned in",
      "Per-platform aspect ratio and length",
      "Publishing recommendations ranked by fit",
    ],
    outputs: ["TikTok", "Instagram Reels", "YouTube Shorts", "LinkedIn", "X"],
    benefits: [
      { title: "One pass, every platform", body: "A single upload produces every cut you need, sized and captioned." },
      { title: "Nothing invented", body: "Hooks and titles are drawn from what was actually said." },
      { title: "You only pay for minutes", body: "One credit per minute of source, however many clips it yields." },
    ],
    before: "A 90-minute interview and an afternoon in a timeline",
    after: "12 captioned, platform-sized clips in about six minutes",
  },
  {
    slug: "animated-captions",
    name: "Animated Captions",
    category: "create",
    status: "shipped",
    tagline: "Subtitles people actually watch.",
    summary:
      "Word-level timings drive five caption styles, burned in at render time or exported as a sidecar for editing elsewhere.",
    capabilities: [
      "TikTok, Karaoke, Word-by-word, Animated and Static styles",
      "Active-word highlighting driven by real word timings",
      "Font, size, colour, background and screen position",
      "Eight languages, detected automatically from the audio",
    ],
    outputs: ["Burned into the video", "SRT", "VTT", "ASS"],
    benefits: [
      { title: "Timed to the syllable", body: "Whisper word timings, not sentence guesses — the difference karaoke lives or dies on." },
      { title: "Readable on a phone", body: "Presets sized and outlined for a small screen at arm's length." },
      { title: "Editable after the fact", body: "Correct a word and the sidecar regenerates to match." },
    ],
    before: "Captions timed by hand, or auto-captions that drift",
    after: "Word-accurate captions in five styles, exportable anywhere",
  },
  {
    slug: "viral-engine",
    name: "Viral Engine",
    category: "intelligence",
    status: "shipped",
    tagline: "Clips ranked by what is likely to travel.",
    summary:
      "Every moment is scored twice — by measurable signals in the transcript and by a model reading for meaning — then ranked, with the reasoning attached.",
    capabilities: [
      "Viral score, clip score and confidence on every clip",
      "Signal breakdown: speech intensity, reactions, emotion, topic shifts, curiosity gaps",
      "The model's stated reasoning for each pick",
      "Best clips returned first",
    ],
    outputs: ["Ranked clips", "Per-signal breakdown", "Written reasoning"],
    benefits: [
      { title: "A number you can interrogate", body: "Every score traces to a measurement, not a black box." },
      { title: "Stable between runs", body: "Deterministic signals anchor the model, so the same video ranks the same way twice." },
      { title: "Honest about uncertainty", body: "Confidence drops when the signals and the model disagree — exactly when to look yourself." },
    ],
    before: "Scrubbing a timeline hoping to spot the good bit",
    after: "The best moments surfaced first, with the reasoning shown",
  },
  {
    slug: "ai-reframe",
    name: "AI Reframe",
    category: "create",
    status: "beta",
    tagline: "Every ratio, no letterboxing.",
    summary:
      "Clips are scaled so the shorter side covers the frame and centre-cropped, producing full-bleed vertical, square and wide cuts.",
    capabilities: ["9:16 vertical", "1:1 square", "16:9 wide", "No black bars on any ratio"],
    outputs: ["9:16", "1:1", "16:9"],
    benefits: [
      { title: "Full-bleed, always", body: "Letterboxing is what makes an auto-generated clip look auto-generated." },
      { title: "One render each", body: "Export the same moment for every platform without a second tool." },
    ],
    before: "Manually repositioning every clip per platform",
    after: "Three ratios from one moment, automatically",
    note: "Speaker detection and object tracking are in development; today's reframe is a centre crop.",
  },
  {
    slug: "publishing",
    name: "Publishing",
    category: "scale",
    status: "beta",
    tagline: "From render to posted, without a download.",
    summary:
      "Connect a destination and publish a finished clip straight from ClipCore, with the platform's own limits checked before the upload starts.",
    capabilities: [
      "YouTube publishing, live today",
      "Resumable uploads that survive a dropped connection",
      "Platform limits validated before an upload is spent",
      "Tokens encrypted at rest",
    ],
    outputs: ["YouTube"],
    benefits: [
      { title: "No round trip", body: "Skip download, re-upload, and re-typing the description." },
      { title: "Fails before it costs you", body: "A clip the platform would reject is caught first." },
    ],
    before: "Download, switch apps, re-upload, retype",
    after: "Publish from the clip you just approved",
    note: "TikTok, Instagram and Facebook are built as interfaces but await platform app review.",
  },
  {
    slug: "social-scheduler",
    name: "Social Scheduler",
    category: "scale",
    status: "planned",
    tagline: "Weeks of content, queued in minutes.",
    summary:
      "A publishing queue and calendar across every connected destination, with posting times chosen per platform.",
    capabilities: ["Content calendar", "Publishing queue", "Best-time recommendations", "Per-platform scheduling"],
    outputs: ["YouTube", "TikTok", "Instagram", "Facebook", "LinkedIn", "X"],
    benefits: [
      { title: "Batch once, post all month", body: "One session of approvals fills the calendar." },
      { title: "Timed per platform", body: "Each destination has its own rhythm." },
    ],
    before: "A reminder to post, every day, forever",
    after: "A month of content queued in one sitting",
  },
  {
    slug: "brand-templates",
    name: "Brand Templates",
    category: "scale",
    status: "planned",
    tagline: "Your look, applied in one click.",
    summary:
      "Reusable templates holding fonts, colours, caption styles, logo placement, intros, outros and lower thirds.",
    capabilities: ["Logos and placement", "Fonts and colours", "Caption presets", "Intro and outro screens", "Lower thirds"],
    outputs: ["Applied at render time"],
    benefits: [
      { title: "Consistent across a team", body: "Everyone's output looks like it came from the same company." },
      { title: "Set once", body: "New clips inherit the template automatically." },
    ],
    before: "Re-applying brand settings on every clip",
    after: "One template, applied to everything",
  },
  {
    slug: "ai-broll",
    name: "AI B-Roll",
    category: "create",
    status: "planned",
    tagline: "Cutaways where the talking head sags.",
    summary:
      "Detects what a passage is about and inserts relevant footage over the sections where attention would otherwise drop.",
    capabilities: ["Topic detection from the transcript", "Footage recommendations", "Automatic timeline insertion"],
    outputs: ["B-roll inserted into the render"],
    benefits: [
      { title: "Holds the flat sections", body: "The parts a viewer would otherwise scroll past." },
      { title: "Chosen from context", body: "Driven by what is being said, not a generic stock loop." },
    ],
    before: "A single static shot for 45 seconds",
    after: "Cutaways placed where retention dips",
  },
  {
    slug: "thumbnail-generator",
    name: "Thumbnail Generator",
    category: "create",
    status: "planned",
    tagline: "Thumbnails, with a reason to pick one.",
    summary:
      "Generates thumbnail variations from the clip's own frames, with text drawn from the hook and a predicted click-through ranking.",
    capabilities: ["Multiple variations per clip", "Face emphasis", "Text generated from the hook", "Predicted CTR ranking"],
    outputs: ["PNG variations", "CTR prediction"],
    benefits: [
      { title: "From the real footage", body: "Frames from your clip, not stock art." },
      { title: "Ranked, not just generated", body: "A reason to choose one over another." },
    ],
    before: "Screenshotting and hoping",
    after: "Ranked variations from the clip itself",
  },
  {
    slug: "team-workspace",
    name: "Team Workspace",
    category: "scale",
    status: "planned",
    tagline: "Creators, editors and marketers in one place.",
    summary:
      "Shared projects with roles, approvals and review comments, so a clip goes from draft to published without leaving the tool.",
    capabilities: ["Roles and permissions", "Approval workflows", "Shared projects", "Review comments"],
    outputs: ["Shared workspace"],
    benefits: [
      { title: "One approval path", body: "Review happens where the clip lives." },
      { title: "Brand stays consistent", body: "Templates and permissions travel with the workspace." },
    ],
    before: "Clips in a shared drive and feedback in chat",
    after: "Draft, review and publish in one place",
  },
  {
    slug: "professional-export",
    name: "Professional Export",
    category: "build",
    status: "planned",
    tagline: "Take it into a real timeline.",
    summary:
      "Export a clip as an editable project — cuts, captions and markers intact — for finishing in Premiere Pro or DaVinci Resolve.",
    capabilities: ["Premiere Pro", "DaVinci Resolve", "XML export", "Packaged project with media"],
    outputs: ["XML", "Packaged project"],
    benefits: [
      { title: "Not a dead end", body: "Automation gets you 90%; finish the last 10% properly." },
      { title: "Captions come with it", body: "Timings arrive as tracks, not burned pixels." },
    ],
    before: "Re-cutting by hand to change one thing",
    after: "Open the automated cut in your own editor",
  },
  {
    slug: "api",
    name: "Developer API",
    category: "build",
    status: "planned",
    tagline: "Clipping as an endpoint.",
    summary:
      "A REST API over the same pipeline the app uses: upload, clip, caption, score and publish, with webhooks for long-running work.",
    capabilities: ["Upload and ingest", "Create clips", "Captions and transcripts", "Viral scores", "Webhooks on completion"],
    outputs: ["REST", "Webhooks"],
    benefits: [
      { title: "The same pipeline", body: "No second-class API path that drifts from the product." },
      { title: "Async by default", body: "Webhooks, because video work does not fit in a request." },
    ],
    before: "Screen-scraping a UI that was not built for it",
    after: "A documented endpoint per operation",
  },
  {
    slug: "mcp",
    name: "MCP Server",
    category: "build",
    status: "planned",
    tagline: "Let an agent do the clipping.",
    summary:
      "A Model Context Protocol server exposing transcription, clipping, captioning and publishing as tools any MCP client can call.",
    capabilities: ["Transcription", "Clipping and scoring", "Captioning", "Publishing", "Works with any MCP client"],
    outputs: ["Claude", "Cursor", "Custom agents"],
    benefits: [
      { title: "Agent-native", body: "Typed tools rather than a browser being driven." },
      { title: "One integration", body: "MCP clients get it without a bespoke plugin each." },
    ],
    before: "Wiring a bespoke integration per assistant",
    after: "One server, every MCP client",
  },
  {
    slug: "analytics",
    name: "Analytics",
    category: "intelligence",
    status: "planned",
    tagline: "Which clips actually worked.",
    summary:
      "Pulls performance back from connected platforms and matches it to the score we predicted — the loop that makes the scoring better.",
    capabilities: ["Per-clip performance", "Predicted versus actual", "Best-performing formats", "Retention from real watch time"],
    outputs: ["Dashboard", "Per-clip reporting"],
    benefits: [
      { title: "Closes the loop", body: "Real watch time replaces our retention estimate." },
      { title: "Learns your audience", body: "Scores tuned to what works for you specifically." },
    ],
    before: "Checking four dashboards and guessing",
    after: "Predicted against actual, in one view",
  },
];

export const STATUS_META = {
  shipped: { label: "Available", tone: "text-[#4ade80] border-[#4ade80]/30 bg-[#4ade80]/10" },
  beta: { label: "Beta", tone: "text-primary border-primary/30 bg-primary/10" },
  planned: { label: "Coming soon", tone: "text-secondary-text border-divider bg-bg-card" },
};

export function getFeature(slug) {
  return FEATURES.find((f) => f.slug === slug) ?? null;
}

export function featuresByCategory() {
  return Object.entries(CATEGORIES).map(([key, label]) => ({
    key,
    label,
    features: FEATURES.filter((f) => f.category === key),
  }));
}

/** Slugs for generateStaticParams. */
export function allFeatureSlugs() {
  return FEATURES.map((f) => ({ slug: f.slug }));
}
