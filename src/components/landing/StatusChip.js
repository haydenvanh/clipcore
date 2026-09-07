import { STATUS_META } from "@/lib/content/features";

/**
 * Availability chip.
 *
 * Shown on every feature surface so a visitor can tell what they can use today
 * from what is on the roadmap, without reading a changelog.
 */
export default function StatusChip({ status, className = "" }) {
  const meta = STATUS_META[status] ?? STATUS_META.planned;
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${meta.tone} ${className}`}
    >
      {meta.label}
    </span>
  );
}
