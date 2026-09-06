import Link from "next/link";
import { FaArrowRight } from "react-icons/fa";

export default function FinalCTA() {
  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
      <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-bg-card px-8 py-14 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-40"
          style={{
            background:
              "radial-gradient(40rem 20rem at 50% 120%, var(--color-primary), transparent 60%)",
            filter: "blur(50px)",
          }}
        />
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
          Ten free credits. No card.
        </h2>
        <p className="text-sm text-secondary-text max-w-lg mx-auto mb-8 leading-relaxed">
          Enough to clip a ten-minute video and see the captions for yourself. If the clips
          aren&apos;t worth posting, you&apos;ve lost nothing.
        </p>
        <Link
          href="/dashboard"
          className="group inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-8 py-4 rounded-full text-sm font-bold shadow-lg shadow-primary/25 transition-all active:scale-[0.98]"
        >
          Start clipping
          <FaArrowRight className="text-xs transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  );
}
