"use client";

import { useEffect, useState } from "react";
import usePrefersReducedMotion from "@/components/dashboard/usePrefersReducedMotion";
import {
  FiType, FiZap, FiTrendingUp, FiFilm, FiMusic, FiDroplet, FiUploadCloud, FiCheck,
} from "react-icons/fi";
import { TRANSCRIPT, AI_ACTIONS, TOOLS, MOMENTS, WAVEFORM } from "./showcase-data";

const TOOL_ICONS = {
  captions: FiType, hook: FiZap, score: FiTrendingUp, broll: FiFilm,
  music: FiMusic, branding: FiDroplet, assets: FiUploadCloud,
};

/** Word index advances at this rate, driving the transcript and the playhead. */
const TICK_MS = 260;

/**
 * A live product showcase rather than a wall of feature cards.
 *
 * One timer drives everything — transcript position, playhead, and which
 * pipeline stage is lit — so the panels stay in sync instead of drifting apart
 * as three independent animations would.
 */
export default function ProductShowcase() {
  const [tick, setTick] = useState(0);
  // Purely decorative motion, so honour the user's preference.
  const animate = !usePrefersReducedMotion();

  useEffect(() => {
    if (!animate) return undefined;
    // setState lives in the interval callback, never in the effect body.
    const timer = setInterval(() => setTick((n) => n + 1), TICK_MS);
    return () => clearInterval(timer);
  }, [animate]);

  const wordIndex = animate ? tick % TRANSCRIPT.length : TRANSCRIPT.length - 1;
  const progress = ((wordIndex + 1) / TRANSCRIPT.length) * 100;
  const activeAction = animate
    ? AI_ACTIONS[Math.floor(tick / 4) % AI_ACTIONS.length].id
    : AI_ACTIONS[AI_ACTIONS.length - 1].id;

  return (
    <section className="relative py-20 sm:py-28 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(50rem 26rem at 50% 40%, color-mix(in srgb, var(--color-primary) 32%, transparent), transparent 70%)",
          filter: "blur(80px)",
        }}
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
          <h2 className="text-3xl sm:text-5xl font-black tracking-[-0.02em]">
            One long video in. Viral content out.
          </h2>
          <p className="text-sm sm:text-base text-secondary-text leading-relaxed">
            Transcription, moment detection, reframing, and captions run as one pipeline.
            You watch it happen — you don&apos;t assemble it.
          </p>
        </div>

        <div className="glass-card rounded-[28px] p-3 sm:p-5">
          {/* Pipeline status strip */}
          <div className="flex flex-wrap items-center gap-2 px-1 pb-4">
            {AI_ACTIONS.map((action) => {
              const isActive = action.id === activeAction;
              return (
                <div
                  key={action.id}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all duration-500 ${
                    isActive
                      ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                      : "bg-white/[0.03] text-secondary-text/70"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                      isActive ? "bg-primary animate-pulse-glow" : "bg-secondary-text/40"
                    }`}
                  />
                  {action.label}
                  {!action.live && (
                    <span className="text-[8px] font-bold text-secondary-text/60">soon</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.85fr_0.75fr] gap-3 sm:gap-4">
            {/* ── Left: transcript editor ─────────────────────────── */}
            <div className="rounded-2xl bg-black/30 border border-white/[0.06] p-4 sm:p-5 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-secondary-text">
                  Transcript
                </span>
                <span className="text-[10px] font-bold text-primary tabular-nums">
                  {String(Math.floor(wordIndex / 4)).padStart(2, "0")}:
                  {String((wordIndex * 3) % 60).padStart(2, "0")}
                </span>
              </div>

              <p className="text-sm sm:text-[15px] leading-[1.9] flex flex-wrap gap-x-1.5 gap-y-1">
                {TRANSCRIPT.map((word, i) => {
                  const spoken = i <= wordIndex;
                  const current = i === wordIndex;
                  return (
                    <span
                      key={`${word.w}-${i}`}
                      className={`rounded px-1 transition-all duration-200 ${
                        current
                          ? "bg-primary text-white"
                          : word.hook && spoken
                            ? "bg-secondary/20 text-secondary"
                            : spoken
                              ? "text-primary-text"
                              : "text-secondary-text/40"
                      }`}
                    >
                      {word.w}
                    </span>
                  );
                })}
              </p>

              <div className="mt-auto pt-4 flex items-center gap-2 text-[10px] text-secondary-text">
                <span className="w-2.5 h-2.5 rounded-sm bg-secondary/40" />
                <span className="font-bold uppercase tracking-widest">Hook detected</span>
              </div>
            </div>

            {/* ── Centre: vertical preview ────────────────────────── */}
            <div className="rounded-2xl bg-black/40 border border-white/[0.06] p-4 flex flex-col items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-secondary-text mb-3 self-start">
                Preview · 9:16
              </span>

              <div className="relative w-full max-w-[190px] aspect-[9/16] rounded-xl overflow-hidden bg-black ring-1 ring-white/10">
                <video
                  src="/demo.mp4#t=14"
                  preload="metadata"
                  muted
                  playsInline
                  className="w-full h-full object-cover opacity-85"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/30" />

                <div className="absolute top-2 right-2 rounded-full bg-emerald-400/15 ring-1 ring-emerald-400/30 px-2 py-0.5">
                  <span className="text-[10px] font-black text-emerald-400 tabular-nums">98</span>
                </div>

                {/* Burned-in caption, mirroring the karaoke style the renderer produces */}
                <div className="absolute inset-x-2 bottom-8 text-center">
                  <span className="inline-block bg-black/55 rounded-md px-2 py-1 text-[11px] font-black uppercase tracking-tight leading-tight text-white">
                    {TRANSCRIPT[wordIndex]?.w}
                  </span>
                </div>

                <div className="absolute inset-x-2 bottom-2 h-0.5 bg-white/15 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5 mt-3">
                {["9:16", "1:1", "16:9"].map((ratio, i) => (
                  <span
                    key={ratio}
                    className={`rounded-md px-2 py-1 text-[9px] font-black tracking-widest ${
                      i === 0 ? "bg-primary/15 text-primary" : "bg-white/[0.04] text-secondary-text"
                    }`}
                  >
                    {ratio}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Right: tools ────────────────────────────────────── */}
            <div className="rounded-2xl bg-black/30 border border-white/[0.06] p-4 sm:p-5">
              <span className="text-[10px] font-black uppercase tracking-widest text-secondary-text">
                Tools
              </span>

              <div className="mt-3 space-y-1">
                {TOOLS.map((tool) => {
                  const Icon = TOOL_ICONS[tool.id] ?? FiZap;
                  return (
                    <div
                      key={tool.id}
                      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors ${
                        tool.live ? "hover:bg-white/[0.05]" : "opacity-45"
                      }`}
                    >
                      <Icon
                        className={`text-sm shrink-0 ${tool.live ? "text-primary" : "text-secondary-text"}`}
                      />
                      <span className="text-xs font-semibold flex-1">{tool.label}</span>
                      {tool.live ? (
                        <FiCheck className="text-[11px] text-emerald-400" aria-label="Available" />
                      ) : (
                        <span className="text-[8px] font-black uppercase tracking-widest text-secondary-text">
                          soon
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Bottom: timeline ──────────────────────────────────── */}
          <div className="mt-3 sm:mt-4 rounded-2xl bg-black/30 border border-white/[0.06] p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-secondary-text">
                Timeline
              </span>
              <span className="text-[10px] font-bold text-secondary-text">
                {MOMENTS.length} moments detected
              </span>
            </div>

            <div className="relative">
              {/* Waveform */}
              <div className="flex items-end gap-[2px] h-16" aria-hidden>
                {WAVEFORM.map((amplitude, i) => {
                  const passed = (i / WAVEFORM.length) * 100 <= progress;
                  return (
                    <div
                      key={i}
                      className={`flex-1 rounded-sm transition-colors duration-300 ${
                        passed ? "bg-primary/70" : "bg-white/10"
                      }`}
                      style={{ height: `${(amplitude * 100).toFixed(2)}%` }}
                    />
                  );
                })}
              </div>

              {/* Detected moments, overlaid on the waveform */}
              <div className="absolute inset-0 pointer-events-none">
                {MOMENTS.map((moment) => (
                  <div
                    key={moment.id}
                    className="absolute top-0 bottom-0 rounded-md ring-1 ring-emerald-400/40 bg-emerald-400/10"
                    style={{ left: `${moment.start}%`, width: `${moment.width}%` }}
                  >
                    <span className="absolute -top-1 left-1 text-[9px] font-black text-emerald-400 tabular-nums whitespace-nowrap">
                      {moment.score} viral
                    </span>
                  </div>
                ))}
              </div>

              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-px bg-white transition-all duration-200"
                style={{ left: `${progress}%` }}
              >
                <span className="absolute -top-1 -left-[3px] w-[7px] h-[7px] rounded-full bg-white" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-[10px] font-bold uppercase tracking-widest text-secondary-text">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-primary/70" /> Waveform
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400/40 ring-1 ring-emerald-400/50" /> AI highlight
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-secondary/40" /> Hook
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
