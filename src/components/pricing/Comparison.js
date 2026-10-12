import { PLANS, COMPETITOR_PRICES_CHECKED, formatUsd } from "@/lib/plans";

const yes = "Yes";
const ROWS = [
  {
    label: "Free plan",
    clipcore: `${PLANS.FREE.minutes} min/mo, no watermark`,
    opus: "60 min/mo, watermark",
    vizard: "60 min/mo, watermark, 720p",
  },
  {
    label: "Entry plan",
    clipcore: `${formatUsd(PLANS.STARTER.price.month)}/mo · ${PLANS.STARTER.minutes} min`,
    opus: "$15/mo · 150 min",
    vizard: "—",
  },
  {
    label: "Pro plan, monthly",
    clipcore: `${formatUsd(PLANS.PRO.price.month)}/mo · ${PLANS.PRO.minutes} min`,
    opus: "$29/mo · 300 min",
    vizard: "$29/mo · 600 min",
  },
  {
    label: "Pro plan, billed yearly",
    clipcore: `${formatUsd(PLANS.PRO.price.year / 12)}/mo`,
    opus: "$14.50/mo",
    vizard: "$14.50/mo",
  },
  {
    label: "Unlimited minutes",
    clipcore: `${yes} · ${formatUsd(PLANS.UNLIMITED.price.month)}/mo`,
    opus: "No",
    vizard: "No",
  },
];

export default function Comparison() {
  return (
    <section className="mx-auto w-full max-w-5xl px-5 sm:px-6 py-20">
      <div className="text-center space-y-3">
        <p className="eyebrow">Compare</p>
        <h2 className="text-3xl sm:text-4xl font-semibold">More minutes. Lower price.</h2>
      </div>
      <div className="mt-10 overflow-x-auto rounded-2xl border border-divider">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-divider text-left">
              <th className="p-4 font-medium text-secondary-text"> </th>
              <th className="p-4 font-semibold bg-white/[0.04]">ClipCore</th>
              <th className="p-4 font-medium text-secondary-text">OpusClip</th>
              <th className="p-4 font-medium text-secondary-text">Vizard</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label} className="border-b border-divider last:border-0">
                <td className="p-4 text-secondary-text">{row.label}</td>
                <td className="p-4 font-medium bg-white/[0.04]">{row.clipcore}</td>
                <td className="p-4 text-secondary-text">{row.opus}</td>
                <td className="p-4 text-secondary-text">{row.vizard}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-center text-xs text-secondary-text">
        Competitor prices from{" "}
        <a href="https://www.opus.pro/pricing" className="underline hover:text-primary-text">opus.pro/pricing</a> and{" "}
        <a href="https://vizard.ai/pricing" className="underline hover:text-primary-text">vizard.ai/pricing</a>, checked {COMPETITOR_PRICES_CHECKED}.
      </p>
    </section>
  );
}
