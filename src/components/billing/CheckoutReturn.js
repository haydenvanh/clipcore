"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiCheckCircle, FiLoader } from "react-icons/fi";

/**
 * Shown after Stripe Checkout. The plan changes when Stripe's webhook lands,
 * usually within a few seconds, so poll until it does and then refresh.
 */
export default function CheckoutReturn({ planActive }) {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    if (planActive) return undefined;
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      const response = await fetch("/api/billing", { cache: "no-store" }).catch(() => null);
      const data = await response?.json().catch(() => null);
      if (data?.plan && data.plan !== "FREE") {
        clearInterval(timer);
        router.refresh();
      } else if (tries >= 20) {
        clearInterval(timer);
        setGaveUp(true);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [planActive, router]);

  return (
    <div role="status" className="panel flex items-center gap-3 p-4 text-sm">
      {planActive ? (
        <>
          <FiCheckCircle className="text-emerald-400 text-lg shrink-0" aria-hidden />
          <span>Payment received — your plan is active. Thank you!</span>
        </>
      ) : gaveUp ? (
        <span>Payment received. Your plan is taking longer than usual to update — refresh this page in a minute.</span>
      ) : (
        <>
          <FiLoader className="animate-spin shrink-0" aria-hidden />
          <span>Payment received — activating your plan…</span>
        </>
      )}
    </div>
  );
}
