import Link from "next/link";
import { FaArrowRight, FaBolt } from "react-icons/fa";

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Ambient glow. Pointer-events off so it never eats a click. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-70"
        style={{
          background:
            "radial-gradient(60rem 30rem at 50% -10%, var(--color-primary), transparent 65%)",
          maskImage: "linear-gradient(to bottom, black, transparent 75%)",
          WebkitMaskImage: "linear-gradient(to bottom, black, transparent 75%)",
          filter: "blur(60px)",
        }}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center flex flex-col items-center gap-7">
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/25 bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
        >
          <FaBolt className="text-[10px]" />
          <span className="text-[11px] font-black uppercase tracking-widest">
            1 credit = 1 minute · from $9.99
          </span>
        </Link>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.05] max-w-4xl">
          Your two-hour podcast.
          <br />
          <span className="bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent animate-gradient-x bg-[length:200%_auto]">
            Not a two-minute cap.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-secondary-text max-w-2xl leading-relaxed">
          ClipCore watches your long-form video, finds the moments worth posting, and cuts them
          into captioned clips for TikTok, Reels, and Shorts. Every clip comes with a viral score
          and the reasoning behind it — so you can see why it was chosen.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-7 py-3.5 rounded-full text-sm font-bold shadow-lg shadow-primary/25 transition-all active:scale-[0.98]"
          >
            Clip your first video free
            <FaArrowRight className="text-xs transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="#how-it-works"
            className="inline-flex items-center gap-2 border border-divider hover:border-primary/40 hover:bg-bg-card px-7 py-3.5 rounded-full text-sm font-bold text-primary-text transition-colors"
          >
            See how it works
          </Link>
        </div>

        <p className="text-[11px] text-secondary-text uppercase tracking-widest font-bold pt-1">
          10 free credits · no card required · no watermark
        </p>
      </div>
    </section>
  );
}
