"use client";

import { FiCheck, FiX, FiTrendingUp, FiZap, FiTarget, FiArrowRight, FiInfo } from "react-icons/fi";
import { FaTiktok, FaInstagram, FaYoutube, FaFacebook } from "react-icons/fa";
import { buildGrowthReport } from "@/lib/growth";

const PLATFORM_ICONS = {
  TIKTOK: FaTiktok, INSTAGRAM: FaInstagram, YOUTUBE: FaYoutube, FACEBOOK: FaFacebook,
};

/** Neon green above 85, amber above 65 — paired with a label, never colour alone. */
function tone(score) {
  if (score >= 85) return { text: "text-[#39FF88]", ring: "ring-[#39FF88]/40", bg: "bg-[#39FF88]/10", label: "Excellent" };
  if (score >= 65) return { text: "text-amber-400", ring: "ring-amber-400/40", bg: "bg-amber-400/10", label: "Good" };
  return { text: "text-secondary-text", ring: "ring-white/15", bg: "bg-white/5", label: "Needs work" };
}

/** Retention curve as an SVG path through the three sampled points. */
function RetentionCurve({ points, drops }) {
  const W = 260;
  const H = 84;
  const coords = points.map((p) => ({
    x: (p.at / 100) * (W - 16) + 8,
    y: H - 12 - (p.value / 100) * (H - 28),
    ...p,
  }));

  // Smooth the polyline with a quadratic through the midpoints.
  const path = coords.reduce((acc, point, i) => {
    if (i === 0) return `M ${point.x} ${point.y}`;
    const prev = coords[i - 1];
    const cx = (prev.x + point.x) / 2;
    return `${acc} Q ${cx} ${prev.y} ${cx} ${(prev.y + point.y) / 2} T ${point.x} ${point.y}`;
  }, "");

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
        aria-label={`Estimated retention: ${points.map((p) => `${p.label} ${p.value}%`).join(", ")}`}>
        <defs>
          <linearGradient id="retentionFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={`${path} L ${coords[coords.length - 1].x} ${H - 8} L ${coords[0].x} ${H - 8} Z`}
          fill="url(#retentionFill)" />
        <path d={path} fill="none" stroke="var(--color-primary)" strokeWidth="2"
          strokeLinecap="round" vectorEffect="non-scaling-stroke" />

        {coords.map((c) => (
          <circle key={c.label} cx={c.x} cy={c.y} r="3.5" fill="var(--color-primary)"
            stroke="var(--color-bg-card)" strokeWidth="2" />
        ))}

        {drops.map((drop) => (
          <line key={drop.at} x1={(drop.at / 100) * (W - 16) + 8} y1="8"
            x2={(drop.at / 100) * (W - 16) + 8} y2={H - 8}
            stroke="#F59E0B" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
        ))}
      </svg>

      <div className="flex justify-between mt-1 text-[9px] font-black uppercase tracking-widest text-secondary-text">
        {points.map((p) => (
          <span key={p.label}>
            {p.label} <span className="text-primary-text tabular-nums">{p.value}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children, action }) {
  return (
    <section className="border-t border-white/[0.06] pt-5 first:border-0 first:pt-0">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-secondary-text">
          <Icon className="text-xs text-primary" />
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * The Growth Intelligence sidebar.
 *
 * Everything here is derived from measurements we actually store — the
 * deterministic signals plus the model's reasoning. The one exception is
 * retention, which is a heuristic estimate because we have no watch-time data;
 * it is labelled as an estimate rather than dressed up as a prediction.
 */
export default function GrowthIntelligence({ clip, onGenerateHook }) {
  const report = buildGrowthReport(clip);
  const viral = tone(report.viralScore);
  const hook = tone(report.hookStrength);

  return (
    <aside
      className="glass-card relative rounded-2xl p-5 w-full lg:max-w-sm space-y-5"
      aria-label="Growth intelligence"
    >
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-black tracking-tight">Growth Intelligence</h2>
        <span className="text-[9px] font-black uppercase tracking-widest text-secondary-text">
          {report.confidence}% conf.
        </span>
      </header>

      {/* ── Viral score ─────────────────────────────────────────── */}
      <Section title="Viral score" icon={FiTrendingUp}>
        <div className={`rounded-xl ring-1 ${viral.ring} ${viral.bg} p-4 text-center`}>
          <div className={`text-5xl font-black tabular-nums leading-none ${viral.text}`}>
            {report.viralScore}
            <span className="text-lg text-secondary-text font-bold">/100</span>
          </div>
          <div className={`text-[10px] font-black uppercase tracking-widest mt-2 ${viral.text}`}>
            {viral.label}
          </div>
        </div>

        <p className="text-[10px] font-black uppercase tracking-widest text-secondary-text mt-4 mb-2">
          Why it scored this
        </p>
        <ul className="space-y-1.5">
          {report.reasons.map((reason) => (
            <li key={reason.label} className="flex items-center gap-2 text-xs">
              {reason.met ? (
                <FiCheck className="text-[#39FF88] shrink-0 text-sm" aria-hidden />
              ) : (
                <FiX className="text-secondary-text/50 shrink-0 text-sm" aria-hidden />
              )}
              <span className={reason.met ? "text-primary-text" : "text-secondary-text/70"}>
                {reason.label}
              </span>
              <span className="ml-auto text-[10px] tabular-nums text-secondary-text">
                {reason.strength}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── Retention ───────────────────────────────────────────── */}
      <Section title="Retention" icon={FiTrendingUp}>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-black tabular-nums text-primary">
            {report.retention.overall}%
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-secondary-text">
            estimated
          </span>
        </div>

        <RetentionCurve points={report.retention.points} drops={report.retention.drops} />

        {report.retention.drops.length > 0 && (
          <ul className="mt-3 space-y-1">
            {report.retention.drops.map((drop) => (
              <li key={drop.at} className="flex items-start gap-1.5 text-[11px] text-amber-400">
                <span className="mt-1 w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                {drop.reason}
              </li>
            ))}
          </ul>
        )}

        <p className="flex items-start gap-1.5 mt-3 text-[10px] leading-relaxed text-secondary-text">
          <FiInfo className="shrink-0 mt-0.5" aria-hidden />
          Modelled from hook, pacing, and length — not from observed watch time.
        </p>
      </Section>

      {/* ── Hook ────────────────────────────────────────────────── */}
      <Section title="Hook strength" icon={FiZap}>
        <div className="flex items-center gap-3 mb-3">
          <div className={`text-3xl font-black tabular-nums ${hook.text}`}>
            {report.hookStrength}%
          </div>
          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-700"
              style={{ width: `${report.hookStrength}%` }}
            />
          </div>
        </div>

        {report.reasoning && (
          <p className="text-xs text-secondary-text leading-relaxed mb-3">{report.reasoning}</p>
        )}

        <button
          type="button"
          onClick={onGenerateHook}
          disabled={!onGenerateHook}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 px-4 py-2.5 text-xs font-bold text-primary transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Generate a better hook
          <FiArrowRight className="text-xs" />
        </button>
      </Section>

      {/* ── Platforms ───────────────────────────────────────────── */}
      <Section title="Best platforms" icon={FiTarget}>
        <ol className="space-y-2">
          {report.platforms.map((platform, index) => {
            const Icon = PLATFORM_ICONS[platform.id] ?? FaTiktok;
            return (
              <li key={platform.id} className="flex items-center gap-2.5">
                <span className="text-[10px] font-black tabular-nums text-secondary-text w-3">
                  {index + 1}
                </span>
                <Icon className="text-sm text-secondary-text shrink-0" aria-hidden />
                <span className="text-xs font-semibold flex-1">{platform.label}</span>
                <div className="w-14 h-1 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${platform.confidence}%` }} />
                </div>
                <span className="text-[10px] font-bold tabular-nums text-secondary-text w-8 text-right">
                  {platform.confidence}%
                </span>
              </li>
            );
          })}
        </ol>
      </Section>

      {/* ── Suggestions ─────────────────────────────────────────── */}
      {report.suggestions.length > 0 && (
        <Section title="Suggested edits" icon={FiZap}>
          <ul className="space-y-2">
            {report.suggestions.map((s) => (
              <li key={s.id} className="flex items-start gap-2 text-xs leading-relaxed">
                <span
                  className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                    s.impact === "high" ? "bg-[#39FF88]" : s.impact === "medium" ? "bg-amber-400" : "bg-secondary-text/50"
                  }`}
                  aria-label={`${s.impact} impact`}
                />
                <span className="text-secondary-text">{s.text}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </aside>
  );
}
