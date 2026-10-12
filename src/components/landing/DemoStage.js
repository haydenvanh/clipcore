"use client";

import { useSyncExternalStore } from "react";
import { FiArrowRight, FiZap } from "react-icons/fi";

/** Real ClipCore output: the moments it picked from Tears of Steel (12:14). */
const SOURCE_SECONDS = 734;
const CLIPS = [
  { src: "/demo/clip-1.mp4", poster: "/demo/clip-1.jpg", start: 27, label: "0:27" },
  { src: "/demo/clip-2.mp4", poster: "/demo/clip-2.jpg", start: 323, label: "5:23" },
  { src: "/demo/clip-3.mp4", poster: "/demo/clip-3.jpg", start: 195, label: "3:15" },
];

function subscribe(callback) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Muted, looping, always playing — unless the visitor asked for less motion. */
function LoopVideo({ src, poster, className }) {
  const still = useSyncExternalStore(subscribe, reducedMotion, () => false);
  return (
    <video
      src={src}
      poster={poster}
      autoPlay={!still}
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden
      className={className}
    />
  );
}

export default function DemoStage() {
  return (
    <div className="relative mx-auto w-full max-w-6xl">
      {/* Soft light behind the stage, so it lifts off the black page. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-10 -top-10 bottom-10 rounded-[48px] bg-[radial-gradient(ellipse_at_center,rgba(94,106,210,0.22),transparent_70%)] blur-2xl" />

      <div className="relative rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-4 sm:p-6 lg:p-8 shadow-2xl shadow-black/60">
        <div className="grid items-center gap-6 lg:gap-8 lg:grid-cols-[1.25fr_auto_1fr]">
          {/* The long video going in */}
          <div className="space-y-3 min-w-0">
            <div className="flex items-center justify-between text-xs text-secondary-text">
              <span className="font-medium text-primary-text">Your long video</span>
              <span className="tabular-nums">12:14</span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
              <LoopVideo src="/demo/source.mp4" poster="/demo/source.jpg" className="w-full aspect-[12/5] object-cover" />
            </div>
            {/* Timeline: the playhead scans; the moments ClipCore picked light up. */}
            <div className="relative h-9 rounded-lg border border-white/10 bg-white/[0.03] overflow-hidden" aria-hidden>
              {CLIPS.map((clip) => (
                <span
                  key={clip.src}
                  className="absolute top-1.5 bottom-1.5 rounded bg-primary/70 ring-1 ring-primary"
                  style={{ left: `${(clip.start / SOURCE_SECONDS) * 100}%`, width: "6%" }}
                />
              ))}
              <span className="animate-scan absolute top-0 bottom-0 w-px bg-white shadow-[0_0_12px_2px_rgba(255,255,255,0.6)]" />
            </div>
            <p className="flex items-center gap-2 text-xs text-secondary-text">
              <FiZap className="text-primary" aria-hidden /> AI found 3 moments worth posting
            </p>
          </div>

          <FiArrowRight className="hidden lg:block text-2xl text-secondary-text" aria-hidden />

          {/* The clips coming out */}
          <div className="grid grid-cols-3 gap-3">
            {CLIPS.map((clip, index) => (
              <figure key={clip.src} className="space-y-2">
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
                  <LoopVideo src={clip.src} poster={clip.poster} className="w-full aspect-[9/16] object-cover" />
                </div>
                <figcaption className="flex items-center justify-between text-[11px] text-secondary-text tabular-nums">
                  <span>Clip {index + 1}</span>
                  <span>from {clip.label}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-secondary-text">
        Real ClipCore output, made from the short film <em>Tears of Steel</em> (© Blender Foundation, CC BY 3.0).
      </p>
    </div>
  );
}
