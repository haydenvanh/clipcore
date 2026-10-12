import { Suspense } from "react";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LinkForm from "@/components/landing/LinkForm";
import DemoStage from "@/components/landing/DemoStage";
import HowItWorks from "@/components/landing/HowItWorks";
import Features from "@/components/landing/Features";
import FAQ from "@/components/landing/FAQ";
import PricingTable from "@/components/pricing/PricingTable";
import Comparison from "@/components/pricing/Comparison";

export default async function LandingPage() {
  const session = await getSessionUser();
  const billing = session
    ? await prisma.user.findUnique({ where: { id: session.id }, select: { plan: true, stripeCustomerId: true } })
    : null;

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-6 pt-20 sm:pt-28 pb-16 text-center">
          <p className="eyebrow">AI video clipping</p>
          <h1 className="mx-auto mt-5 max-w-4xl text-5xl sm:text-7xl font-semibold tracking-[-0.04em] leading-[1.02]">
            1 long video. 10 viral clips. Captions included.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg sm:text-xl text-secondary-text">
            Paste a YouTube link. ClipCore finds the best moments and turns them into vertical clips with animated captions — ready for TikTok, Shorts, and Reels.
          </p>
          <div className="mt-10">
            <LinkForm signedIn={Boolean(session)} />
          </div>
        </div>
        <div className="px-5 sm:px-6 pb-12">
          <DemoStage />
        </div>
      </section>

      <HowItWorks />
      <Features />

      <section id="pricing" className="scroll-mt-20 mx-auto w-full max-w-6xl px-5 sm:px-6 py-24">
        <div className="text-center space-y-3 mb-12">
          <p className="eyebrow">Pricing</p>
          <h2 className="text-3xl sm:text-5xl font-semibold">Cheaper than OpusClip. On every plan.</h2>
          <p className="text-secondary-text">Start free. Upgrade when you&apos;re posting every day.</p>
        </div>
        <Suspense>
          <PricingTable signedIn={Boolean(session)} currentPlan={billing?.plan ?? null} canManage={Boolean(billing?.stripeCustomerId)} />
        </Suspense>
      </section>

      <Comparison />
      <FAQ />

      <section className="mx-auto w-full max-w-6xl px-5 sm:px-6 pb-28">
        <div className="rounded-[32px] border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] px-6 py-16 text-center space-y-8">
          <h2 className="text-3xl sm:text-5xl font-semibold">Your next 10 clips are one link away.</h2>
          <LinkForm signedIn={Boolean(session)} size="md" />
        </div>
      </section>
    </>
  );
}
