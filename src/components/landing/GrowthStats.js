"use client";

import { useEffect, useState } from "react";
import useInView from "@/components/dashboard/useInView";
import usePrefersReducedMotion from "@/components/dashboard/usePrefersReducedMotion";

/**
 * Usage statistics, counting up on scroll.
 *
 * Reads live counts from /api/stats rather than hardcoded figures. That is a
 * deliberate choice: a launch-day site that claims "50M clips generated" is
 * making a factual claim it cannot support, and the first person who asks is a
 * problem. Real numbers start small and become an asset as they grow, and the
 * section hides itself entirely until there is something worth showing.
 */
function useCountUp(target, { start, durationMs = 1400 }) {
  const [value, setValue] = useState(0);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (!start) return undefined;
    if (reduced || target === 0) {
      const id = setTimeout(() => setValue(target), 0);
      return () => clearTimeout(id);
    }

    const startedAt = performance.now();
    let frame;

    const step = (now) => {
      const t = Math.min(1, (now - startedAt) / durationMs);
      // ease-out cubic: fast, then settling — reads as counting, not sliding.
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [start, target, durationMs, reduced]);

  return value;
}

function compact(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

function Stat({ label, value, suffix, start }) {
  const shown = useCountUp(value, { start });
  return (
    <div>
      <div className="text-[2rem] sm:text-[2.5rem] font-semibold tabular-nums text-primary-text leading-none">
        {compact(shown)}
        {suffix}
      </div>
      <div className="mt-2 text-xs text-secondary-text">{label}</div>
    </div>
  );
}

export default function GrowthStats({ stats }) {
  const [ref, inView] = useInView({ threshold: 0.4 });

  // Nothing meaningful to show yet — better an absent section than a boastful
  // row of zeroes.
  if (!stats || stats.clips < 25) return null;

  const items = [
    { label: "Clips generated", value: stats.clips, suffix: "+" },
    { label: "Hours processed", value: stats.hours, suffix: "+" },
    { label: "Creators", value: stats.users, suffix: "+" },
    { label: "Minutes of captions", value: stats.captionMinutes, suffix: "+" },
  ];

  return (
    <section ref={ref} className="py-20 border-t border-divider">
      <div className="max-w-5xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {items.map((item) => (
            <Stat key={item.label} {...item} start={inView} />
          ))}
        </div>
      </div>
    </section>
  );
}
