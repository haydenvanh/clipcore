"use client";

import { useEffect, useState } from "react";
import useInView from "@/components/dashboard/useInView";
import usePrefersReducedMotion from "@/components/dashboard/usePrefersReducedMotion";
import { WAVEFORM, MOMENTS, TRANSCRIPT } from "./showcase-data";
import { FiCheck, FiLoader } from "react-icons/fi";
import { FaTiktok, FaInstagram, FaYoutube, FaFacebook } from "react-icons/fa";

/**
 * The pipeline, running.
 *
 * A single state machine walks the real stages the worker performs, and every
 * panel reads from it — so the transcript, the waveform, the scores and the
 * exports stay in step instead of drifting like independent animations would.
 *
 * It starts on scroll rather than on mount: an animation that plays before
 * anyone is looking has already finished by the time they arrive.
 */
const STAGES = [
  { id: "ingest", label: "Ingesting video", ms: 900 },
  { id: "transcribe", label: "Transcribing audio", ms: 2200 },
  { id: "analyze", label: "Detecting hooks", ms: 1800 },
  { id: "score", label: "Scoring moments", ms: 1500 },
  { id: "render", label: "Rendering clips", ms: 1800 },
  { id: "done", label: "Ready to publish", ms: 0 },
];

const EXPORTS = [
  { id: "tiktok", Icon: FaTiktok, label: "TikTok", score: 98 },
  { id: "reels", Icon: FaInstagram, label: "Reels", score: 96 },
  { id: "shorts", Icon: FaYoutube, label: "Shorts", score: 92 },
  { id: "facebook", Icon: FaFacebook, label: "Facebook", score: 88 },
];

export default function PipelineDemo() {
  const [ref, inView] = useInView({ threshold: 0.3 });
  const reduced = usePrefersReducedMotion();
  const [stageIndex, setStageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  // With motion reduced, present the finished result immediately — the point of
  // the section is the outcome, not the animation.
  const stage = reduced ? STAGES.length - 1 : stageIndex;
  const done = stage >= STAGES.length - 1;

  useEffect(() => {
    if (!inView || reduced || done) return undefined;

    const timer = setTimeout(() => setStageIndex((n) => n + 1), STAGES[stageIndex].ms);
    return () => clearTimeout(timer);
  }, [inView, reduced, done, stageIndex]);

  useEffect(() => {
    if (!inView || reduced || done) return undefined;

    const timer = setInterval(() => setProgress((p) => (p + 2) % 101), 40);
    return () => clearInterval(timer);
  }, [inView, reduced, done]);

  const reached = (id) => STAGES.findIndex((s) => s.id === id) <= stage;
  const wordsShown = reached("transcribe")
    ? done ? TRANSCRIPT.length : Math.floor((progress / 100) * TRANSCRIPT.length)
    : 0;

  return (
    <section ref={ref} className="py-20 sm:py-28 border-t border-divider">
      <div className="max-w-5xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-10">
          <h2 className="text-[2rem] sm:text-[2.5rem] font-semibold leading-[1.1] text-primary-text">
            Watch it work
          </h2>
          <p className="mt-3 text-base text-secondary-text leading-relaxed">
            The same five stages run on every upload. This is them, in order.
          </p>
        </div>

        {/* Stage rail */}
        <ol className="flex flex-wrap gap-2 mb-5">
          {STAGES.slice(0, -1).map((s, i) => {
            const active = i === stage && !done;
            const complete = i < stage || done;
            return (
              <li
                key={s.id}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors duration-500 ${
                  active
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : complete
                      ? "border-divider bg-bg-card text-primary-text"
                      : "border-divider bg-bg-page text-secondary-text"
                }`}
              >
                {complete ? (
                  <FiCheck className="text-[#4ade80] text-sm" aria-hidden />
                ) : active ? (
                  <FiLoader className="animate-spin text-sm" aria-hidden />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-current opacity-40" aria-hidden />
                )}
                {s.label}
              </li>
            );
          })}
        </ol>

        <div className="panel overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px]">
            {/* Transcript + timeline */}
            <div className="p-5 border-b lg:border-b-0 lg:border-r border-divider">
              <span className="text-xs font-medium text-secondary-text">Transcript</span>

              <p className="mt-3 text-sm leading-[1.9] flex flex-wrap gap-x-1.5 min-h-[92px]">
                {TRANSCRIPT.map((word, i) => (
                  <span
                    key={`${word.w}-${i}`}
                    className={`transition-all duration-300 ${
                      i < wordsShown
                        ? word.hook && reached("analyze")
                          ? "text-primary-text bg-primary/15 rounded px-1"
                          : "text-primary-text"
                        : "text-transparent"
                    }`}
                  >
                    {word.w}
                  </span>
                ))}
              </p>

              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-secondary-text">Timeline</span>
                  {reached("score") && (
                    <span className="text-xs text-secondary-text">{MOMENTS.length} moments</span>
                  )}
                </div>

                <div className="relative">
                  <div className="flex items-end gap-[2px] h-16" aria-hidden>
                    {WAVEFORM.map((amplitude, i) => {
                      const revealed = reached("transcribe") && (done || (i / WAVEFORM.length) * 100 <= progress);
                      return (
                        <div
                          key={i}
                          className={`flex-1 rounded-[1px] transition-colors duration-300 ${
                            revealed ? "bg-divider" : "bg-divider/30"
                          }`}
                          style={{ height: `${(amplitude * 100).toFixed(2)}%` }}
                        />
                      );
                    })}
                  </div>

                  {reached("analyze") && (
                    <div className="absolute inset-0 pointer-events-none">
                      {MOMENTS.map((moment, i) => (
                        <div
                          key={moment.id}
                          className="absolute top-0 bottom-0 rounded border border-primary/50 bg-primary/10 animate-fade-up"
                          style={{
                            left: `${moment.start}%`,
                            width: `${moment.width}%`,
                            animationDelay: `${i * 120}ms`,
                          }}
                        >
                          {reached("score") && (
                            <span className="absolute -top-4 left-0 text-[10px] tabular-nums text-primary-text">
                              {moment.score}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Exports */}
            <div className="p-5">
              <span className="text-xs font-medium text-secondary-text">Exports</span>

              <div className="mt-3 space-y-2">
                {EXPORTS.map((exp, i) => {
                  const ready = reached("render");
                  const Icon = exp.Icon;
                  return (
                    <div
                      key={exp.id}
                      className={`well flex items-center gap-2.5 px-3 py-2.5 transition-all duration-500 ${
                        ready ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                      }`}
                      style={{ transitionDelay: ready ? `${i * 110}ms` : "0ms" }}
                    >
                      <Icon className="text-sm text-secondary-text shrink-0" aria-hidden />
                      <span className="text-xs text-primary-text flex-1">{exp.label}</span>
                      <span className="text-xs tabular-nums text-primary-text">{exp.score}</span>
                    </div>
                  );
                })}
              </div>

              {done && (
                <p className="mt-4 pt-4 border-t border-divider text-xs text-secondary-text animate-fade-up">
                  4 clips · 9:16 · captions burned in
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
