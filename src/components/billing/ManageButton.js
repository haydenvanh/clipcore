"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { FiLoader } from "react-icons/fi";

/** Opens Stripe's billing portal: change plan, cancel, update card, invoices. */
export default function ManageButton({ className = "" }) {
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn't open billing.");
      window.location.assign(data.url);
    } catch (error) {
      toast.error(error.message);
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={open} disabled={busy} className={`btn btn-secondary focus-ring px-5 py-2.5 text-sm ${className}`}>
      {busy && <FiLoader className="animate-spin" aria-hidden />}
      Manage subscription
    </button>
  );
}
