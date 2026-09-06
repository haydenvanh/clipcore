import { FaCheck, FaTimes } from "react-icons/fa";

/**
 * Prices verified from each vendor's own pricing page, September 2026.
 * See docs/COMPETITOR_ANALYSIS.md. Keep this honest and current — a stale or
 * flattering comparison table costs more trust than it buys clicks.
 */
const ROWS = [
  { label: "Entry price", clipcore: "$9.99/mo", submagic: "$19/mo", opus: "$15/mo", klap: "$14/mo*" },
  { label: "Max video length (entry)", clipcore: "60 min", submagic: "2 min", opus: "Not published", klap: "Not published" },
  { label: "Long-form included", clipcore: true, submagic: false, opus: true, klap: true },
  { label: "Billed monthly at that price", clipcore: true, submagic: true, opus: true, klap: false },
  { label: "Limits published up front", clipcore: true, submagic: true, opus: false, klap: true },
  { label: "Unit of sale", clipcore: "Minutes", submagic: "Videos", opus: "Credits", klap: "Clips" },
];

const COLUMNS = [
  { key: "clipcore", name: "ClipCore", highlight: true },
  { key: "submagic", name: "Submagic" },
  { key: "opus", name: "Opus Clip" },
  { key: "klap", name: "Klap" },
];

function Cell({ value }) {
  if (value === true) return <FaCheck className="text-primary mx-auto" aria-label="Yes" />;
  if (value === false) return <FaTimes className="text-secondary-text/50 mx-auto" aria-label="No" />;
  return <span>{value}</span>;
}

export default function Comparison() {
  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="text-center mb-12 space-y-3">
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
          Why long videos cost less here
        </h2>
        <p className="text-sm text-secondary-text max-w-2xl mx-auto leading-relaxed">
          Most tools price in units that punish long-form — a clip count, a video cap, an opaque
          credit. We sell minutes, which is the thing you already have.
        </p>
      </div>

      {/* Wide table scrolls inside its own container rather than the page. */}
      <div className="overflow-x-auto border border-divider/60 rounded-2xl bg-bg-card">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-divider/60">
              <th scope="col" className="text-left font-bold p-4 text-secondary-text text-xs uppercase tracking-widest">
                &nbsp;
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`p-4 text-center text-xs font-black uppercase tracking-widest ${
                    col.highlight ? "text-primary" : "text-secondary-text"
                  }`}
                >
                  {col.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-divider/40">
            {ROWS.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="text-left p-4 font-semibold text-[13px] text-primary-text">
                  {row.label}
                </th>
                {COLUMNS.map((col) => (
                  <td
                    key={col.key}
                    className={`p-4 text-center text-[13px] ${
                      col.highlight
                        ? "text-primary-text font-bold bg-primary/[0.04]"
                        : "text-secondary-text"
                    }`}
                  >
                    <Cell value={row[col.key]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-secondary-text mt-4 leading-relaxed">
        * Klap&apos;s $14 headline is billed yearly; paying monthly costs roughly double. Submagic
        sells long-to-short as a separate $19/mo add-on, so the comparable total is about $38/mo.
        Prices checked September 2026 from each vendor&apos;s pricing page — tell us if one has
        changed and we&apos;ll correct it.
      </p>
    </section>
  );
}
