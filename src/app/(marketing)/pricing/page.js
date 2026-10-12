import { Suspense } from "react";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PricingTable from "@/components/pricing/PricingTable";
import Comparison from "@/components/pricing/Comparison";
import FAQ from "@/components/landing/FAQ";

export const metadata = {
  title: "Pricing",
  description: "ClipCore plans start free. Starter $9/mo, Pro $19/mo, Unlimited $25/mo — less than OpusClip on every plan.",
};

export default async function PricingPage() {
  const session = await getSessionUser();
  const billing = session
    ? await prisma.user.findUnique({ where: { id: session.id }, select: { plan: true, stripeCustomerId: true } })
    : null;

  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-5 sm:px-6 pt-20 pb-12">
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-4xl sm:text-6xl font-semibold tracking-[-0.03em]">Simple pricing. Real savings.</h1>
          <p className="mx-auto max-w-xl text-lg text-secondary-text">
            Every plan is cheaper than OpusClip&apos;s, with no watermark — even on Free.
          </p>
        </div>
        <Suspense>
          <PricingTable signedIn={Boolean(session)} currentPlan={billing?.plan ?? null} canManage={Boolean(billing?.stripeCustomerId)} />
        </Suspense>
      </section>
      <Comparison />
      <FAQ />
    </>
  );
}
