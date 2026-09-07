"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import useSWRish from "@/components/dashboard/useSWRish";
import { publicPlans } from "@/lib/plans";
import { FiExternalLink, FiLoader } from "react-icons/fi";

const PLANS = publicPlans();

/** Ledger entry types, in words a customer would use. */
const ENTRY_LABELS = {
  GRANT: "Credits added",
  HOLD: "Reserved for a job",
  SETTLE: "Job settled",
  REFUND: "Refunded",
  EXPIRE: "Expired",
  ADJUST: "Adjustment",
};

export default function BillingPage() {
  const { data: me, loading: meLoading } = useSWRish("/api/me");
  const { data: credits } = useSWRish("/api/credits?limit=25");
  const [busy, setBusy] = useState(false);

  const subscription = me?.subscription;
  const plan = subscription ? PLANS.find((p) => p.id === subscription.plan) : null;

  const openPortal = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not open the billing portal.");
      window.location.assign(data.url);
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Billing</h1>
        <p className="text-sm text-secondary-text mt-1">
          Your plan, your balance, and every credit movement on your account.
        </p>
      </div>

      <section className="bg-bg-card border border-divider/60 rounded-2xl p-6">
        {meLoading ? (
          <div className="flex justify-center py-6 text-secondary-text">
            <FiLoader className="animate-spin" />
          </div>
        ) : subscription ? (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-secondary-text">
                  Current plan
                </div>
                <div className="text-2xl font-black mt-1">
                  {plan?.name ?? subscription.plan}
                  <span className="text-sm font-semibold text-secondary-text ml-2">
                    {plan?.priceLabel}/mo
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-black uppercase tracking-widest text-secondary-text">
                  Balance
                </div>
                <div className="text-2xl font-black text-primary mt-1 tabular-nums">
                  {me?.user?.credits ?? 0}
                </div>
              </div>
            </div>

            <div className="text-xs text-secondary-text border-t border-divider/40 pt-4">
              {subscription.cancelAtPeriodEnd ? (
                <>
                  Your plan ends on{" "}
                  <strong className="text-primary-text">
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </strong>
                  . You keep your credits until then.
                </>
              ) : (
                <>
                  Renews on{" "}
                  <strong className="text-primary-text">
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </strong>{" "}
                  with {plan?.credits ?? 0} fresh credits.
                </>
              )}
              {subscription.status === "PAST_DUE" && (
                <span className="block mt-2 text-red-500 font-bold">
                  Your last payment failed. Update your card to keep processing videos.
                </span>
              )}
            </div>

            <button
              onClick={openPortal}
              disabled={busy}
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-full text-xs font-bold transition-colors disabled:opacity-60"
            >
              {busy ? <FiLoader className="animate-spin" /> : <FiExternalLink />}
              Manage plan, card, and invoices
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-secondary-text">
                Current plan
              </div>
              <div className="text-2xl font-black mt-1">Free</div>
              <p className="text-xs text-secondary-text mt-2">
                You have{" "}
                <strong className="text-primary">{me?.user?.credits ?? 0} credits</strong> left.
                Subscribe for a monthly allowance and longer videos.
              </p>
            </div>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-full text-xs font-bold transition-colors"
            >
              Choose a plan
            </Link>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-widest text-secondary-text">
          Credit history
        </h2>

        {credits?.items?.length ? (
          <div className="border border-divider/60 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-divider/40">
                {credits.items.map((entry) => (
                  <tr key={entry.id} className="bg-bg-card">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[13px]">
                        {ENTRY_LABELS[entry.type] ?? entry.type}
                      </div>
                      {entry.description && (
                        <div className="text-xs text-secondary-text mt-0.5 truncate max-w-xs">
                          {entry.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-secondary-text whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-black tabular-nums whitespace-nowrap ${
                        entry.delta > 0 ? "text-emerald-500" : "text-secondary-text"
                      }`}
                    >
                      {entry.delta > 0 ? "+" : ""}
                      {entry.delta}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-secondary-text tabular-nums whitespace-nowrap">
                      {entry.balanceAfter}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-secondary-text py-4">No credit activity yet.</p>
        )}
      </section>
    </div>
  );
}
