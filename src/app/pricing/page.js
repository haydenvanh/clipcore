import { Toaster } from "react-hot-toast";
import Footer from "@/components/Footer";
import PlanCards from "@/components/PlanCards";
import FAQ from "@/components/landing/FAQ";
import { FaBolt } from "react-icons/fa";

export const metadata = {
  title: "Pricing",
  description:
    "1 credit = 1 minute of video. From $9.99/month. No 2-minute caps, no annual lock-in.",
};

export default function PricingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg-page text-primary-text">
      <Toaster position="top-right" />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-16 sm:px-6 lg:px-8 flex flex-col gap-12 items-center">
        <div className="text-center space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
            <FaBolt className="text-primary text-xs" />
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">
              1 credit = 1 minute
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight">
            Simple pricing. No 2-minute limits.
          </h1>
          <p className="text-sm text-secondary-text leading-relaxed">
            One credit processes one minute of your source video, however many clips it produces.
            Upload a three-hour podcast on the plan you can afford. Cancel any time.
          </p>
        </div>

        <PlanCards />

        <div className="text-center text-xs text-secondary-text max-w-2xl space-y-2 border-t border-divider/40 pt-8">
          <p>
            Credits reset each month and roll over for one period. Failed jobs are refunded
            automatically — you are only charged for video we actually process.
          </p>
          <p>Billed monthly. No annual lock-in required. Cancel from your billing portal any time.</p>
        </div>

        <div className="w-full max-w-3xl pt-8 border-t border-divider/40">
          <FAQ />
        </div>
      </main>

      <Footer />
    </div>
  );
}
