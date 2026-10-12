import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUsage } from "@/lib/usage";
import { PLANS, formatUsd } from "@/lib/plans";
import UsageMeter from "@/components/billing/UsageMeter";
import ManageButton from "@/components/billing/ManageButton";
import CheckoutReturn from "@/components/billing/CheckoutReturn";

export const metadata = { title: "Billing" };

const formatDate = (date) =>
  new Date(date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export default async function BillingPage({ searchParams }) {
  const session = await getSessionUser();
  if (!session) redirect("/login?next=/billing");
  const { checkout } = await searchParams;

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true, plan: true, billingInterval: true, subscriptionStatus: true,
      currentPeriodEnd: true, cancelAtPeriodEnd: true, stripeCustomerId: true,
    },
  });
  const usage = await getUsage(prisma, user);
  const plan = PLANS[user.plan] ?? PLANS.FREE;
  const paid = plan.id !== "FREE";
  const price = paid && user.billingInterval ? plan.price[user.billingInterval] : 0;

  return (
    <div className="max-w-3xl mx-auto w-full px-5 sm:px-6 py-10 space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>

      {checkout === "success" && <CheckoutReturn planActive={paid} />}

      <div className="panel p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="eyebrow">Current plan</p>
            <p className="text-2xl font-semibold">{plan.name}</p>
            <p className="text-sm text-secondary-text">
              {paid
                ? `${formatUsd(price)} per ${user.billingInterval} · ${plan.minutes == null ? "unlimited minutes" : `${plan.minutes} minutes a month`}`
                : `${plan.minutes} minutes of video a month, free`}
            </p>
          </div>
          {user.stripeCustomerId ? (
            <ManageButton />
          ) : (
            <Link href="/pricing" className="btn btn-primary focus-ring px-5 py-2.5 text-sm">Upgrade</Link>
          )}
        </div>

        {paid && user.currentPeriodEnd && (
          <p className="text-sm text-secondary-text border-t border-divider pt-4">
            {user.cancelAtPeriodEnd
              ? `Cancelled — you keep ${plan.name} until ${formatDate(user.currentPeriodEnd)}, then move to Free.`
              : user.subscriptionStatus === "past_due"
                ? "Your last payment didn't go through. Update your card under Manage subscription to keep your plan."
                : `Renews on ${formatDate(user.currentPeriodEnd)}.`}
          </p>
        )}
      </div>

      <UsageMeter usage={usage} />

      <p className="text-xs text-secondary-text">
        Payments are handled by Stripe. Change plan, cancel, update your card, or download invoices from Manage subscription.
      </p>
    </div>
  );
}
