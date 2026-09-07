"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiCheck } from "react-icons/fi";
import toast from "react-hot-toast";
import { publicPlans, priceFor, annualSaving } from "@/lib/plans";

const PLANS = publicPlans();

/**
 * Pricing cards with a monthly/annual toggle.
 *
 * Both prices are shown honestly: the annual card states the yearly total *and*
 * the monthly equivalent. Advertising "$8/mo" when the charge is $99 once is
 * the pattern this product's positioning explicitly rejects — see
 * docs/PRICING_STRATEGY.md.
 */
export default function PlanCards({ compact = false }) {
  const { status } = useSession();
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [interval, setInterval] = useState("MONTH");

  const isAnnual = interval === "YEAR";

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
        body: JSON.stringify({ planId, interval }),
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
    <div className="w-full">
      {/* Interval toggle */}
      <div className="flex justify-center mb-8">
        <div
          role="radiogroup"
          aria-label="Billing interval"
          className="inline-flex items-center gap-1 rounded-lg border border-divider bg-bg-card p-1"
        >
          {[
            { id: "MONTH", label: "Monthly" },
            { id: "YEAR", label: "Annual" },
          ].map((option) => {
            const active = interval === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setInterval(option.id)}
                className={`focus-ring inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-[13px] font-medium transition-colors cursor-pointer ${
                  active
                    ? "bg-bg-card-hover text-primary-text"
                    : "text-secondary-text hover:text-primary-text"
                }`}
              >
                {option.label}
                {option.id === "YEAR" && (
                  <span className="rounded bg-[#4ade80]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#4ade80]">
                    2 months free
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-4xl mx-auto items-start">
        {PLANS.map((plan) => {
          const price = priceFor(plan.id, interval);
          const saving = annualSaving(plan.id);

          return (
            <div
              key={plan.id}
              className={`panel p-6 flex flex-col gap-5 transition-colors ${
                plan.popular ? "border-primary/40" : ""
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-medium text-primary-text">{plan.name}</h3>
                  {plan.popular && (
                    <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      Popular
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-[2.25rem] font-semibold tracking-tight text-primary-text tabular-nums">
                    {price.priceLabel}
                  </span>
                  <span className="text-sm text-secondary-text">/{price.per}</span>
                </div>

                {isAnnual ? (
                  <p className="mt-1.5 text-xs text-secondary-text">
                    ${(price.monthlyEquivalentCents / 100).toFixed(2)}/mo equivalent · save{" "}
                    <span className="text-[#4ade80]">{saving.savedLabel}</span> ({saving.percent}%)
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-secondary-text">Billed monthly, cancel any time</p>
                )}

                <p className="mt-3 text-[13px] text-secondary-text leading-relaxed min-h-[2.5rem]">
                  {plan.tagline}
                </p>
              </div>

              <div className="well p-3 text-center">
                <div className="text-lg font-semibold text-primary-text tabular-nums">
                  {plan.credits}
                </div>
                <div className="text-[11px] text-secondary-text">minutes every month</div>
              </div>

              {!compact && (
                <ul className="space-y-2 text-[13px] flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <FiCheck className="text-primary text-xs mt-1 shrink-0" aria-hidden />
                      <span className="text-secondary-text">{feature}</span>
                    </li>
                  ))}
                </ul>
              )}

              <button
                onClick={() => handleCheckout(plan.id)}
                disabled={loadingPlan !== null}
                className={`focus-ring w-full rounded-lg py-2.5 text-[13px] font-medium transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                  plan.popular
                    ? "bg-primary hover:bg-primary-hover text-white"
                    : "border border-divider hover:bg-bg-card-hover text-primary-text"
                }`}
              >
                {loadingPlan === plan.id ? "Opening checkout…" : `Get ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {isAnnual && (
        <p className="mt-6 text-center text-xs text-secondary-text max-w-lg mx-auto">
          Annual plans are charged once. Credits still arrive monthly — the same allowance,
          so a year of credits can&apos;t be spent in a weekend.
        </p>
      )}
    </div>
  );
}
