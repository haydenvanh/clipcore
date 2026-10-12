"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import toast from "react-hot-toast";
import { FiCheck, FiLoader } from "react-icons/fi";
import { PLANS, PLAN_FEATURES, COMING_SOON, COMPETITORS, monthlyPrice, formatUsd } from "@/lib/plans";

const ORDER = ["FREE", "STARTER", "PRO", "UNLIMITED"];

/** Biggest yearly saving across paid plans, for the toggle label. */
const MAX_YEARLY_SAVING = Math.max(
  ...["STARTER", "PRO", "UNLIMITED"].map((id) => 1 - PLANS[id].price.year / 12 / PLANS[id].price.month)
);

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

/**
 * @param {{signedIn: boolean, currentPlan: string|null, canManage: boolean}} props
 */
export default function PricingTable({ signedIn, currentPlan, canManage }) {
  const router = useRouter();
  const params = useSearchParams();
  const [interval, setPeriod] = useState(params.get("interval") === "month" ? "month" : "year");
  const [pending, setPending] = useState(null);

  async function choose(planId) {
    if (planId === "FREE") {
      if (signedIn) router.push("/dashboard");
      else signIn("google", { callbackUrl: "/dashboard" });
      return;
    }
    if (!signedIn) {
      // Come back here after sign-in and carry on to checkout.
      signIn("google", { callbackUrl: `/pricing?plan=${planId}&interval=${interval}` });
      return;
    }
    setPending(planId);
    try {
      const { url } = canManage && currentPlan !== "FREE"
        ? await postJson("/api/billing/portal")
        : await postJson("/api/billing/checkout", { plan: planId, interval });
      window.location.assign(url);
    } catch (error) {
      toast.error(error.message);
      setPending(null);
    }
  }

  // Resume a checkout started before signing in.
  const resumed = useRef(false);
  useEffect(() => {
    const plan = params.get("plan");
    if (resumed.current || !signedIn || !PLANS[plan] || plan === "FREE" || currentPlan !== "FREE") return;
    resumed.current = true;
    const timer = setTimeout(() => choose(plan), 0);
    return () => clearTimeout(timer);
    // choose is stable enough for a one-time resume
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, signedIn, currentPlan]);

  return (
    <div className="space-y-8">
      <div className="flex justify-center">
        <div className="inline-flex rounded-full border border-divider bg-bg-card p-1" role="radiogroup" aria-label="Billing period">
          {[
            ["month", "Monthly"],
            ["year", `Yearly · save up to ${Math.round(MAX_YEARLY_SAVING * 100)}%`],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={interval === value}
              onClick={() => setPeriod(value)}
              className={`focus-ring rounded-full px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                interval === value ? "bg-white text-black" : "text-secondary-text hover:text-primary-text"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ORDER.map((id) => {
          const plan = PLANS[id];
          const isCurrent = signedIn && currentPlan === id;
          const perMonth = monthlyPrice(plan, interval);
          const discounted = interval === "year" && plan.price.month > 0;
          const rival = COMPETITORS[id];

          let cta = id === "FREE" ? (signedIn ? "Go to dashboard" : "Start free") : `Get ${plan.name}`;
          if (isCurrent) cta = "Your plan";
          else if (signedIn && canManage && currentPlan !== "FREE" && id !== "FREE") cta = `Switch to ${plan.name}`;

          return (
            <div
              key={id}
              className={`relative flex flex-col rounded-3xl border p-7 ${
                plan.featured ? "border-white/80 bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.15)]" : "border-divider bg-bg-card"
              }`}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-7 rounded-full bg-white px-3 py-1 text-xs font-semibold text-black">Most popular</span>
              )}
              <h3 className="text-2xl font-semibold">{plan.name}</h3>
              <p className="mt-1 text-sm text-secondary-text">{plan.tagline}</p>

              <div className="mt-6 min-h-[92px]">
                {discounted && (
                  <p className="text-2xl font-semibold text-secondary-text line-through decoration-2">{formatUsd(plan.price.month)}</p>
                )}
                <p className={`text-4xl font-semibold tracking-tight ${discounted ? "text-emerald-400" : ""}`}>
                  {formatUsd(perMonth)}
                  <span className="ml-1 text-base font-medium text-secondary-text">/mo</span>
                </p>
                <p className="mt-1 text-xs text-secondary-text">
                  {plan.price.month === 0
                    ? "Free forever"
                    : interval === "year"
                      ? `${formatUsd(plan.price.year)} billed yearly`
                      : `${formatUsd(plan.price.month)} billed monthly`}
                </p>
              </div>

              <button
                type="button"
                onClick={() => choose(id)}
                disabled={isCurrent || pending !== null}
                className={`btn focus-ring mt-6 w-full py-3 text-sm ${plan.featured ? "btn-primary" : "btn-secondary"}`}
              >
                {pending === id && <FiLoader className="animate-spin" aria-hidden />}
                {cta}
              </button>

              <p className="mt-6 text-sm font-medium">
                {plan.minutes == null ? "Unlimited minutes" : `${plan.minutes} minutes`} of video / month
              </p>
              {rival && (
                <p className="mt-2 rounded-lg bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300">
                  {rival.name}: {formatUsd(rival.month)}/mo for {rival.minutes} min
                </p>
              )}
              {PLAN_FEATURES[id].heading && <p className="mt-6 text-sm font-medium">{PLAN_FEATURES[id].heading}</p>}
              <ul className={`${PLAN_FEATURES[id].heading ? "mt-3" : "mt-6"} space-y-2.5 text-sm`}>
                {PLAN_FEATURES[id].items.map((feature) => (
                  <li key={feature} className="flex gap-2.5">
                    <FiCheck className="mt-0.5 shrink-0 text-secondary-text" aria-hidden />
                    <span>{feature}</span>
                  </li>
                ))}
                {id !== "FREE" &&
                  COMING_SOON.map((feature) => (
                    <li key={feature} className="flex gap-2.5 text-secondary-text">
                      <FiCheck className="mt-0.5 shrink-0 opacity-40" aria-hidden />
                      <span>
                        {feature}{" "}
                        <span className="ml-1 rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">Soon</span>
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="text-center text-sm text-secondary-text">
        <span className="font-medium text-primary-text">Launch pricing:</span> the price you subscribe at is locked in for as long as you stay subscribed.
      </p>
    </div>
  );
}
