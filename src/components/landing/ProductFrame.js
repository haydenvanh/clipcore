import { FiCheck } from "react-icons/fi";
import { MOMENTS, WAVEFORM } from "./showcase-data";

/**
 * A still of the actual interface, shown before any marketing copy.
 *
 * Static and server-rendered on purpose: a looping animation here competes with
 * the headline and delays the largest paint. The product should be legible in
 * the first frame, not after a two-second reveal.
 */
export default function ProductFrame() {
  return (
    <figure className="panel overflow-hidden">
      {/* Window chrome */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-divider">
        <div className="flex gap-1.5" aria-hidden>
          <span className="w-2.5 h-2.5 rounded-full bg-divider" />
          <span className="w-2.5 h-2.5 rounded-full bg-divider" />
          <span className="w-2.5 h-2.5 rounded-full bg-divider" />
        </div>
        <span className="text-xs text-secondary-text">founder-interview-ep-42.mp4</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-secondary-text">
          <FiCheck className="text-[#4ade80]" aria-hidden />
          12 clips
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_260px]">
        {/* Timeline */}
        <div className="p-5 border-b md:border-b-0 md:border-r border-divider">
          <div className="flex items-baseline justify-between mb-4">
            <span className="text-xs font-medium text-secondary-text">Timeline</span>
            <span className="text-xs text-secondary-text tabular-nums">01:47:12</span>
          </div>

          <div className="relative">
            <div className="flex items-end gap-[2px] h-20" aria-hidden>
              {WAVEFORM.map((amplitude, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-[1px] bg-divider"
                  style={{ height: `${(amplitude * 100).toFixed(2)}%` }}
                />
              ))}
            </div>

            <div className="absolute inset-0 pointer-events-none">
              {MOMENTS.map((moment) => (
                <div
                  key={moment.id}
                  className="absolute top-0 bottom-0 rounded border border-primary/50 bg-primary/10"
                  style={{ left: `${moment.start}%`, width: `${moment.width}%` }}
                />
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-px">
            {MOMENTS.map((moment) => (
              <div
                key={moment.id}
                className="flex items-center gap-3 rounded-md px-2.5 py-2 hover:bg-bg-card-hover transition-colors"
              >
                <span className="text-xs tabular-nums text-secondary-text w-10">
                  {String(Math.floor(moment.start / 2)).padStart(2, "0")}:
                  {String(moment.start % 60).padStart(2, "0")}
                </span>
                <span className="text-sm text-primary-text flex-1 truncate">{moment.label}</span>
                <span className="text-xs tabular-nums text-primary-text">{moment.score}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Clip preview */}
        <div className="p-5">
          <span className="text-xs font-medium text-secondary-text">Preview</span>

          <div className="mt-4 mx-auto w-full max-w-[170px] aspect-[9/16] rounded-lg overflow-hidden bg-black border border-divider">
            <video
              src="/demo.mp4#t=14"
              preload="metadata"
              muted
              playsInline
              aria-label="Generated clip preview"
              className="w-full h-full object-cover"
            />
          </div>

          <dl className="mt-4 space-y-2.5">
            {[
              ["Viral score", "98"],
              ["Duration", "0:41"],
              ["Captions", "Karaoke"],
              ["Ratio", "9:16"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <dt className="text-secondary-text">{label}</dt>
                <dd className="text-primary-text tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </figure>
  );
}
