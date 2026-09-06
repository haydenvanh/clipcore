import { Toaster } from "react-hot-toast";
import Hero from "@/components/landing/Hero";
import DemoVideo from "@/components/landing/DemoVideo";
import HowItWorks from "@/components/landing/HowItWorks";
import Features from "@/components/landing/Features";
import Comparison from "@/components/landing/Comparison";
import Testimonials from "@/components/landing/Testimonials";
import FAQ from "@/components/landing/FAQ";
import { FAQ_ITEMS } from "@/components/landing/faq-items";
import FinalCTA from "@/components/landing/FinalCTA";
import PlanCards from "@/components/PlanCards";
import Footer from "@/components/Footer";
import config from "@/lib/config";

export const metadata = {
  title: `${config.appName} — ${config.appTagline}`,
  description: config.appDescription,
  openGraph: {
    title: `${config.appName} — ${config.appTagline}`,
    description: config.appDescription,
    type: "website",
  },
};

/**
 * FAQPage structured data, generated from the same array the page renders, so
 * the markup and the rich result can never disagree.
 */
function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export default function LandingPage() {
  return (
    <div className="flex flex-col bg-bg-page text-primary-text">
      <Toaster position="top-right" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()) }}
      />

      <main className="flex-1">
        <Hero />
        <DemoVideo />
        <HowItWorks />
        <Features />
        <Comparison />
        <Testimonials />

        <section id="pricing" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 scroll-mt-24">
          <div className="text-center mb-12 space-y-3">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              One rule: 1 credit = 1 minute
            </h2>
            <p className="text-sm text-secondary-text max-w-xl mx-auto leading-relaxed">
              However many clips a video produces, you pay for the minutes we processed. Cancel
              any time.
            </p>
          </div>
          <PlanCards />
        </section>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          <FAQ />
        </div>

        <FinalCTA />
      </main>

      <Footer />
    </div>
  );
}
