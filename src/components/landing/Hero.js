import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";
import HeroGenerator from "./HeroGenerator";
import ProductFrame from "./ProductFrame";

/**
 * Product-first hero.
 *
 * The interface appears before the marketing copy: someone evaluating a tool
 * wants to see the tool. The headline is one line, the sub is one sentence, and
 * everything else on this screen is the product itself.
 */
export default function Hero() {
  return (
    <section className="relative pt-16 sm:pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h1 className="animate-fade-up text-[2.5rem] sm:text-[3.5rem] font-semibold leading-[1.05] text-primary-text">
            Long video in.
            <br />
            <span className="text-secondary-text">Short clips out.</span>
          </h1>

          <p
            className="animate-fade-up mt-5 text-base sm:text-lg text-secondary-text leading-relaxed max-w-xl"
            style={{ animationDelay: "60ms" }}
          >
            ClipCore transcribes your video, scores every moment, and returns captioned
            clips — with the reasoning behind each pick.
          </p>

          <div
            className="animate-fade-up mt-7 flex flex-wrap items-center gap-3"
            style={{ animationDelay: "120ms" }}
          >
            <Link
              href="/dashboard"
              className="focus-ring group inline-flex items-center gap-2 rounded-lg bg-primary hover:bg-primary-hover px-5 py-2.5 text-sm font-medium text-white transition-colors"
            >
              Start free
              <FiArrowRight className="text-sm transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/pricing"
              className="focus-ring inline-flex items-center rounded-lg border border-divider hover:bg-bg-card px-5 py-2.5 text-sm font-medium text-primary-text transition-colors"
            >
              Pricing
            </Link>
            <span className="text-xs text-secondary-text">10 free credits, no card</span>
          </div>
        </div>

        {/* The product, immediately. */}
        <div className="animate-fade-up mt-14" style={{ animationDelay: "180ms" }}>
          <ProductFrame />
        </div>

        <div className="animate-fade-up mt-10 max-w-2xl" style={{ animationDelay: "240ms" }}>
          <HeroGenerator />
        </div>
      </div>
    </section>
  );
}
