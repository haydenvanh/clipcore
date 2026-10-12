import Link from "next/link";
import { PLANS } from "@/lib/plans";
import { formatDuration } from "@/lib/usage";

/** Minutes used this month against the plan's allowance. Server-rendered. */
export default function UsageMeter({ usage, compact = false }) {
  const plan = PLANS[usage.plan] ?? PLANS.FREE;
  const unlimited = usage.limitSeconds == null;
  const fraction = unlimited ? 0 : Math.min(1, usage.usedSeconds / usage.limitSeconds);
  const low = !unlimited && fraction >= 0.8;
  const resets = new Date(usage.resetsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <div className={`panel ${compact ? "p-4" : "p-5 sm:p-6"} space-y-3`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm">
          <span className="font-semibold">{plan.name}</span>
          <span className="text-secondary-text">
            {" · "}
            {unlimited
              ? `${formatDuration(usage.usedSeconds)} of video this month`
              : `${formatDuration(usage.usedSeconds)} of ${formatDuration(usage.limitSeconds)} used`}
          </span>
        </p>
        {(plan.id === "FREE" || low) && (
          <Link href="/pricing" className="btn btn-primary focus-ring px-3.5 py-1.5 text-xs shrink-0">
            {plan.id === "FREE" ? "Upgrade" : "Get more minutes"}
          </Link>
        )}
      </div>
      {!unlimited && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)} aria-label="Minutes used this month">
          <div className={`h-full rounded-full ${low ? "bg-amber-400" : "bg-white"}`} style={{ width: `${fraction * 100}%` }} />
        </div>
      )}
      <p className="text-xs text-secondary-text">
        {unlimited ? "No monthly cap." : `${formatDuration(usage.remainingSeconds)} left · resets ${resets}`}
      </p>
    </div>
  );
}
