import { FiTarget, FiType, FiSmartphone, FiFileText, FiRefreshCw, FiLock, FiSend } from "react-icons/fi";

const FEATURES = [
  { icon: FiTarget, title: "AI moment detection", body: "ClipCore reads the whole transcript and picks the moments with the strongest hooks, reactions, and questions." },
  { icon: FiType, title: "Animated captions", body: "Word-by-word karaoke captions, burned in and sized to stay inside the frame on every phone." },
  { icon: FiSmartphone, title: "Vertical, automatically", body: "Landscape video is reframed to 9:16 with no black bars, exported at 1080×1920." },
  { icon: FiFileText, title: "Caption files", body: "Download any clip's captions as SRT or VTT to use in your own editor." },
  { icon: FiRefreshCw, title: "Never start over", body: "If a step fails, Retry picks up where it stopped. Retries don't use your minutes." },
  { icon: FiLock, title: "Private by default", body: "Your videos and clips are visible only to your account." },
];

export default function Features() {
  return (
    <section id="features" className="scroll-mt-20 mx-auto w-full max-w-6xl px-5 sm:px-6 py-24">
      <div className="max-w-2xl space-y-3">
        <p className="eyebrow">Features</p>
        <h2 className="text-3xl sm:text-5xl font-semibold">Everything a clip needs. Nothing to edit.</h2>
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="panel p-6 space-y-3">
            <Icon className="text-xl text-primary" aria-hidden />
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm leading-relaxed text-secondary-text">{body}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 panel p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex items-center gap-3">
          <FiSend className="text-xl text-primary shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">One-click posting to TikTok, YouTube Shorts, Instagram Reels, and Facebook Reels</p>
            <p className="text-sm text-secondary-text">In progress — every clip downloads as an MP4 you can post anywhere today.</p>
          </div>
        </div>
        <span className="self-start sm:self-center rounded-full border border-divider px-3 py-1 text-xs font-medium text-secondary-text">Coming soon</span>
      </div>
    </section>
  );
}
