import {
  FaChartLine, FaClosedCaptioning, FaCropAlt, FaClock, FaShieldAlt, FaLanguage,
} from "react-icons/fa";

const FEATURES = [
  {
    icon: FaChartLine,
    title: "Viral score you can interrogate",
    body: "Every clip carries a score plus the reasoning behind it — which signal fired and why that moment works. Not an unexplained number.",
  },
  {
    icon: FaClosedCaptioning,
    title: "Karaoke captions, burned in",
    body: "Word-level timings straight from the transcript, so captions land on the syllable. Styled to read on a phone at arm's length.",
  },
  {
    icon: FaCropAlt,
    title: "9:16, 1:1, and 16:9",
    body: "Export the same clip for TikTok, Reels, Shorts, X, and LinkedIn. One render each, no second tool.",
  },
  {
    icon: FaClock,
    title: "Built for long-form",
    body: "Five-hour uploads on Ultra, three on Pro, one on Basic. Podcasts and lectures are the normal case, not the premium tier.",
  },
  {
    icon: FaShieldAlt,
    title: "You only pay for what runs",
    body: "Credits are held when a job starts and refunded automatically if it fails. Every movement is in your credit history.",
  },
  {
    icon: FaLanguage,
    title: "Eight languages, detected automatically",
    body: "English, Spanish, French, German, Italian, Portuguese, Japanese, and Korean. We read the language off your audio.",
  },
];

export default function Features() {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="text-center mb-14 space-y-3">
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
          Everything the clip needs. Nothing it doesn&apos;t.
        </h2>
        <p className="text-sm text-secondary-text max-w-xl mx-auto">
          No avatars, no voice clones, no stock B-roll. One job, done properly.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.title}
              className="group bg-bg-card border border-divider/60 rounded-2xl p-6 flex flex-col gap-3.5 transition-all hover:border-primary/40 hover:-translate-y-0.5"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/12 text-primary flex items-center justify-center transition-colors group-hover:bg-primary/20">
                <Icon className="text-base" />
              </div>
              <h3 className="text-sm font-bold tracking-tight">{feature.title}</h3>
              <p className="text-[13px] text-secondary-text leading-relaxed">{feature.body}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
