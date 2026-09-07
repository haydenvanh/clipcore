/**
 * ClipCore mark.
 *
 * Concept: two crop marks bracketing a solid core — "extract the core from the
 * frame", which is literally what the product does. Not a letterform, not a
 * rounded square with an initial in it.
 *
 * Constraints it is built to:
 *   - One colour, `currentColor`, so it inherits light/dark automatically.
 *   - Three shapes, no gradients, no strokes under 2 units — it survives 16px.
 *   - Drawn on a 24-unit grid with 2-unit stroke, aligning to the pixel grid at
 *     16, 24, 32 and 48px.
 */
export function LogoMark({ size = 24, className = "", title }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}

      {/* Top-left crop mark */}
      <path
        d="M3 8.5V5a2 2 0 0 1 2-2h3.5"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="square"
      />
      {/* Bottom-right crop mark */}
      <path
        d="M21 15.5V19a2 2 0 0 1-2 2h-3.5"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="square"
      />
      {/* The core */}
      <rect x="8.5" y="8.5" width="7" height="7" rx="1.25" fill="currentColor" />
    </svg>
  );
}

/** Mark plus wordmark, for headers and the footer. */
export default function Logo({ size = 22, className = "", showText = true }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} title="ClipCore" />
      {showText && (
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-fg">ClipCore</span>
      )}
    </span>
  );
}
