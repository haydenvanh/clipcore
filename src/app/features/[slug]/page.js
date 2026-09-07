import Link from "next/link";
import { notFound } from "next/navigation";
import Footer from "@/components/Footer";
import StatusChip from "@/components/landing/StatusChip";
import ProductFrame from "@/components/landing/ProductFrame";
import { getFeature, allFeatureSlugs, FEATURES } from "@/lib/content/features";
import { FiArrowRight, FiCheck, FiInfo } from "react-icons/fi";

/** Pre-render every feature page at build time. */
export function generateStaticParams() {
  return allFeatureSlugs();
}

export async function generateMetadata({ params }) {
  // params is a Promise in Next 16.
  const { slug } = await params;
  const feature = getFeature(slug);
  if (!feature) return { title: "Feature not found" };

  return {
    title: feature.name,
    description: feature.summary,
    openGraph: { title: feature.name, description: feature.summary, type: "article" },
  };
}

export default async function FeaturePage({ params }) {
  const { slug } = await params;
  const feature = getFeature(slug);
  if (!feature) notFound();

  const related = FEATURES.filter((f) => f.slug !== slug && f.category === feature.category).slice(0, 3);

  return (
    <div className="flex min-h-dvh flex-col bg-bg-page">
      <main className="flex-1 w-full max-w-5xl mx-auto px-5 sm:px-6 lg:px-8 py-16 sm:py-20">
        <Link
          href="/features"
          className="text-xs font-medium text-secondary-text hover:text-primary-text transition-colors"
        >
          ← All features
        </Link>

        {/* ── Hero ─────────────────────────────────────────────────── */}
        <header className="mt-8 max-w-2xl">
          <div className="flex items-center gap-3">
            <h1 className="text-[2.25rem] sm:text-[3rem] font-semibold leading-[1.05] text-primary-text">
              {feature.name}
            </h1>
            <StatusChip status={feature.status} />
          </div>

          <p className="mt-4 text-lg text-secondary-text">{feature.tagline}</p>
          <p className="mt-4 text-base text-secondary-text leading-relaxed">{feature.summary}</p>

          {feature.note && (
            <p className="mt-5 flex items-start gap-2 text-[13px] text-secondary-text panel p-3.5">
              <FiInfo className="shrink-0 mt-0.5 text-primary" aria-hidden />
              {feature.note}
            </p>
          )}
        </header>

        {/* ── Demonstration ────────────────────────────────────────── */}
        <div className="mt-12">
          <ProductFrame />
        </div>

        {/* ── Capabilities and outputs ─────────────────────────────── */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-8">
          <section>
            <h2 className="text-xs font-medium text-secondary-text mb-4">What it does</h2>
            <ul className="space-y-2.5">
              {feature.capabilities.map((capability) => (
                <li key={capability} className="flex items-start gap-2.5 text-[14px] leading-relaxed">
                  <FiCheck className="text-primary shrink-0 mt-1 text-sm" aria-hidden />
                  <span className="text-primary-text">{capability}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xs font-medium text-secondary-text mb-4">Outputs</h2>
            <div className="flex flex-wrap gap-1.5">
              {feature.outputs.map((output) => (
                <span
                  key={output}
                  className="rounded-md border border-divider bg-bg-card px-2.5 py-1.5 text-xs text-primary-text"
                >
                  {output}
                </span>
              ))}
            </div>
          </section>
        </div>

        {/* ── Before / after ───────────────────────────────────────── */}
        <section className="mt-14">
          <h2 className="text-xs font-medium text-secondary-text mb-4">Before and after</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-divider border border-divider rounded-xl overflow-hidden">
            <div className="bg-bg-page p-6">
              <span className="text-[10px] font-medium uppercase tracking-widest text-secondary-text">
                Before
              </span>
              <p className="mt-2.5 text-[15px] text-secondary-text leading-relaxed">
                {feature.before}
              </p>
            </div>
            <div className="bg-bg-card p-6">
              <span className="text-[10px] font-medium uppercase tracking-widest text-primary">
                After
              </span>
              <p className="mt-2.5 text-[15px] text-primary-text leading-relaxed">{feature.after}</p>
            </div>
          </div>
        </section>

        {/* ── Benefits ─────────────────────────────────────────────── */}
        <section className="mt-14">
          <h2 className="text-xs font-medium text-secondary-text mb-4">Why it matters</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {feature.benefits.map((benefit) => (
              <div key={benefit.title} className="panel p-5">
                <h3 className="text-[14px] font-medium text-primary-text">{benefit.title}</h3>
                <p className="mt-2 text-[13px] text-secondary-text leading-relaxed">
                  {benefit.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Related ──────────────────────────────────────────────── */}
        {related.length > 0 && (
          <section className="mt-14">
            <h2 className="text-xs font-medium text-secondary-text mb-4">Works with</h2>
            <div className="flex flex-wrap gap-2">
              {related.map((other) => (
                <Link
                  key={other.slug}
                  href={`/features/${other.slug}`}
                  className="focus-ring inline-flex items-center gap-2 rounded-lg border border-divider hover:bg-bg-card px-3.5 py-2 text-[13px] text-primary-text transition-colors"
                >
                  {other.name}
                  <StatusChip status={other.status} />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── CTA ──────────────────────────────────────────────────── */}
        <div className="mt-16 panel p-8 flex flex-col sm:flex-row items-center justify-between gap-5">
          <div>
            <h2 className="text-lg font-semibold text-primary-text">Upload once. Grow everywhere.</h2>
            <p className="mt-1 text-sm text-secondary-text">
              Ten free credits, no card required.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="focus-ring shrink-0 inline-flex items-center gap-2 rounded-lg bg-primary hover:bg-primary-hover px-5 py-2.5 text-sm font-medium text-white transition-colors"
          >
            Start free <FiArrowRight className="text-sm" />
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
