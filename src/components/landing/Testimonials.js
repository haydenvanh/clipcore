import { FaStar } from "react-icons/fa";

/**
 * Real customer quotes only.
 *
 * This array is intentionally empty until we have consented quotes from actual
 * users — inventing social proof is the fastest way to lose a launch thread,
 * and the launch checklist commits us to "quote real people or ship none".
 * The section renders nothing while empty, so the page stays honest and starts
 * working the moment a real quote is added.
 *
 * Shape: { quote, name, role, avatarUrl?, rating? }
 */
export const TESTIMONIALS = [];

export default function Testimonials() {
  if (TESTIMONIALS.length === 0) return null;

  return (
    <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-center mb-12">
        Creators who ship every week
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {TESTIMONIALS.map((t) => (
          <figure
            key={t.name}
            className="bg-bg-card border border-divider/60 rounded-2xl p-6 flex flex-col gap-4"
          >
            {t.rating ? (
              <div className="flex gap-0.5 text-primary">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <FaStar key={i} className="text-xs" />
                ))}
              </div>
            ) : null}

            <blockquote className="text-sm text-primary-text leading-relaxed flex-1">
              “{t.quote}”
            </blockquote>

            <figcaption className="flex items-center gap-3 pt-2 border-t border-divider/40">
              {t.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-black">
                  {t.name.charAt(0)}
                </div>
              )}
              <div className="leading-tight">
                <div className="text-xs font-bold text-primary-text">{t.name}</div>
                <div className="text-[11px] text-secondary-text">{t.role}</div>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
