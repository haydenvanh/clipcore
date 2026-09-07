"use client";

import Link from "next/link";
import useSWRish from "@/components/dashboard/useSWRish";
import { FiZap } from "react-icons/fi";

/**
 * Live credit balance.
 *
 * Reads /api/me rather than the session: session values are only refreshed at
 * sign-in, so the Navbar used to show a stale balance after every job.
 */
export default function CreditsBadge({ refreshKey }) {
  const { data } = useSWRish("/api/me", { refreshKey });
  const credits = data?.user?.credits;
  const plan = data?.subscription?.plan;

  return (
    <Link
      href="/dashboard/billing"
      className="inline-flex items-center gap-2 rounded-full border border-divider bg-bg-card px-3.5 py-1.5 hover:border-primary/40 transition-colors"
    >
      <FiZap className="text-primary text-xs" />
      <span className="text-sm font-bold tabular-nums">
        {credits === undefined ? "—" : credits}
      </span>
      <span className="text-[10px] font-black uppercase tracking-widest text-secondary-text">
        {plan ? plan.toLowerCase() : "credits"}
      </span>
    </Link>
  );
}
