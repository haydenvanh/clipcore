import Link from "next/link";
import Footer from "@/components/Footer";
import StatusChip from "@/components/landing/StatusChip";
import { featuresByCategory } from "@/lib/content/features";
import { FiArrowRight } from "react-icons/fi";
import config from "@/lib/config";

export const metadata = {
  title: "Features",
  description:
    "Every part of the ClipCore content pipeline — producing, scoring, captioning, publishing, and the APIs underneath.",
};

export default function FeaturesIndex() {
  const groups = featuresByCategory();

  return (
    <div className="flex min-h-dvh flex-col bg-bg-page">
      <main className="flex-1 w-full max-w-5xl mx-auto px-5 sm:px-6 lg:px-8 py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-medium text-secondary-text">{config.appName}</p>
          <h1 className="mt-3 text-[2.5rem] sm:text-[3.25rem] font-semibold leading-[1.05] text-primary-text">
            Upload once.
            <br />
            <span className="text-secondary-text">Grow everywhere.</span>
          </h1>
          <p className="mt-5 text-base text-secondary-text leading-relaxed">
            One pipeline takes a long video from raw footage to published clips. Each part of it
            is below, with what you can use today marked as such.
          </p>
        </div>

        <div className="mt-16 space-y-14">
          {groups.map((group) => (
            <section key={group.key}>
              <h2 className="text-xs font-medium text-secondary-text mb-5">{group.label}</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-divider border border-divider rounded-xl overflow-hidden">
                {group.features.map((feature) => (
                  <Link
                    key={feature.slug}
                    href={`/features/${feature.slug}`}
                    className="focus-ring group bg-bg-page hover:bg-bg-card transition-colors p-5 flex flex-col gap-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-[15px] font-medium text-primary-text">{feature.name}</h3>
                      <StatusChip status={feature.status} />
                      <FiArrowRight className="ml-auto text-sm text-secondary-text opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-[13px] text-secondary-text leading-relaxed">
                      {feature.tagline}
                    </p>
                  </Link>
                ))}

                {/* An odd number of features leaves a hole in a 2-column grid;
                    fill it so the block reads as a finished panel. */}
                {group.features.length % 2 === 1 && (
                  <div className="hidden sm:block bg-bg-page" aria-hidden />
                )}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-20 panel p-8 text-center">
          <h2 className="text-xl font-semibold text-primary-text">Start with one video</h2>
          <p className="mt-2 text-sm text-secondary-text">
            Ten free credits, no card. Enough to clip a ten-minute video.
          </p>
          <Link
            href="/dashboard"
            className="focus-ring mt-5 inline-flex items-center gap-2 rounded-lg bg-primary hover:bg-primary-hover px-5 py-2.5 text-sm font-medium text-white transition-colors"
          >
            Start free <FiArrowRight className="text-sm" />
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
