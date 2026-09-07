import { FaYoutube, FaInstagram, FaTiktok, FaFacebook } from "react-icons/fa";

const PLATFORM_META = {
  tiktok: { Icon: FaTiktok, label: "TikTok", color: "#FFFFFF" },
  shorts: { Icon: FaYoutube, label: "YouTube Shorts", color: "#FF0033" },
  reels: { Icon: FaInstagram, label: "Instagram Reels", color: "#E1306C" },
  facebook: { Icon: FaFacebook, label: "Facebook Reels", color: "#1877F2" },
};

/** Green above 80, amber above 60, muted below — score colour must not be the only signal. */
function scoreTone(score) {
  if (score >= 80) return { text: "text-emerald-400", ring: "ring-emerald-400/30", bg: "bg-emerald-400/10" };
  if (score >= 60) return { text: "text-amber-400", ring: "ring-amber-400/30", bg: "bg-amber-400/10" };
  return { text: "text-secondary-text", ring: "ring-white/10", bg: "bg-white/5" };
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * One generated clip, as it appears in the hero.
 *
 * The thumbnail is a frame of our own demo video (via a #t= media fragment)
 * rather than stock footage or a competitor's screenshot — it is the only
 * honest source of "here is what this produces" we have.
 */
export default function ClipPreviewCard({ platform, title, score, durationSec, frameAt, delay = 0 }) {
  const meta = PLATFORM_META[platform] ?? PLATFORM_META.tiktok;
  const { Icon, label, color } = meta;
  const tone = scoreTone(score);

  return (
    <article
      className="animate-fade-up group relative rounded-2xl overflow-hidden glass-card
        transition-all duration-300 ease-out hover:-translate-y-1.5
        hover:shadow-[0_28px_70px_-24px_rgba(139,92,246,0.55)]
        focus-within:-translate-y-1.5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="relative aspect-[9/16] bg-black overflow-hidden">
        <video
          src={`/demo.mp4#t=${frameAt}`}
          preload="metadata"
          muted
          playsInline
          aria-label={`Preview of ${title}`}
          className="w-full h-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-105"
        />

        {/* Bottom scrim so the metadata stays legible over any frame. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md px-2.5 py-1">
          <Icon className="text-[11px]" style={{ color }} aria-hidden />
          <span className="text-[9px] font-black uppercase tracking-widest text-white">{label}</span>
        </div>

        <div
          className={`absolute top-2.5 right-2.5 rounded-full px-2 py-1 ring-1 backdrop-blur-md ${tone.bg} ${tone.ring}`}
        >
          <span className={`text-[10px] font-black tabular-nums ${tone.text}`}>{score}</span>
        </div>

        <div className="absolute bottom-2.5 left-2.5 right-2.5 space-y-1">
          <p className="text-[11px] font-bold text-white leading-snug line-clamp-2">{title}</p>
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-widest text-white/60">
              Viral score
            </span>
            <span className="text-[10px] font-bold tabular-nums text-white/80">
              {formatDuration(durationSec)}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
