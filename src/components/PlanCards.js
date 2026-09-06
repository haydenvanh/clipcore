"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FaCheck } from "react-icons/fa";
import toast from "react-hot-toast";
import { publicPlans } from "@/lib/plans";

const PLANS = publicPlans();

/**
 * The pricing cards, shared by the landing page section and /pricing so the two
 * can never drift apart. Plans come from lib/plans.js, the same module the
 * checkout endpoint validates against.
 */
export default function PlanCards({ compact = false }) {
  const { status } = useSession();
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState(null);

  const handleCheckout = async (planId) => {
    if (status !== "authenticated") {
      router.push("/login?next=/pricing");
      return;
    }

    setLoadingPlan(planId);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start checkout.");
      if (!data.url) throw new Error("Stripe did not return a checkout URL.");

      if (data.changedExisting) toast("Opening your billing portal to change plans…");
      window.location.assign(data.url);
    } catch (err) {
      toast.error(err.message);
      setLoadingPlan(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl mx-auto items-start">
      {PLANS.map((plan) => (
        <div
          key={plan.id}
          className={`relative bg-bg-card border rounded-2xl p-7 flex flex-col gap-6 transition-all duration-300 hover:-translate-y-1 ${
            plan.popular
              ? "border-primary shadow-2xl shadow-primary/10 md:scale-105"
              : "border-divider/60 shadow-md"
          }`}
        >
          {plan.popular && (
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-[9px] font-black uppercase px-3 py-1 rounded-full tracking-wider shadow">
              Most popular
            </span>
          )}

          <div className="space-y-3">
            <h3 className="text-sm font-extrabold uppercase tracking-wide">{plan.name}</h3>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black tracking-tight">{plan.priceLabel}</span>
              <span className="text-xs text-secondary-text font-semibold">/month</span>
            </div>
            <p className="text-xs text-secondary-text leading-relaxed min-h-[2.5rem]">
              {plan.tagline}
            </p>
          </div>

          <div className="bg-bg-page/60 border border-divider/40 rounded-lg p-3 text-center">
            <div className="text-xl font-black text-primary">{plan.credits}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-secondary-text">
              minutes / month
            </div>
            <div className="text-[10px] text-secondary-text mt-1">
              ${(plan.priceCents / 100 / plan.credits).toFixed(3)} per minute
            </div>
          </div>

          {!compact && (
            <ul className="space-y-2.5 text-xs font-medium text-secondary-text flex-1">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <FaCheck className="text-primary text-[10px] mt-0.5 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={() => handleCheckout(plan.id)}
            disabled={loadingPlan !== null}
            className={`w-full py-3 rounded-full text-xs font-bold transition-all shadow-md cursor-pointer active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${
              plan.popular
                ? "bg-primary text-white hover:bg-primary-hover shadow-primary/20"
                : "bg-bg-page hover:bg-bg-card-hover text-primary-text border border-divider"
            }`}
          >
            {loadingPlan === plan.id ? "Opening checkout…" : `Get ${plan.name}`}
          </button>
        </div>
      ))}
    </div>
  );
}
