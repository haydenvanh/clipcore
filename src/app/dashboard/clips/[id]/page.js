"use client";

import { use } from "react";
import Link from "next/link";
import useSWRish from "@/components/dashboard/useSWRish";
import GrowthIntelligence from "@/components/dashboard/GrowthIntelligence";
import { FiArrowLeft, FiDownload, FiLoader, FiFileText } from "react-icons/fi";

/**
 * Clip editor: the render on the left, Growth Intelligence on the right.
 *
 * The panel is the differentiator, so it sits beside the clip rather than
 * behind a tab — a score you have to go looking for does not change what
 * anyone posts.
 */
export default function ClipPage({ params }) {
  // params is a Promise in Next 16; `use` unwraps it in a client component.
  const { id } = use(params);
  const { data, loading } = useSWRish(`/api/clips/${id}`);

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-secondary-text">
        <FiLoader className="animate-spin" />
      </div>
    );
  }

  if (!data?.clip) {
    return (
      <div className="text-center py-24">
        <p className="text-sm font-semibold">Clip not found.</p>
        <Link href="/gallery" className="text-xs text-primary hover:underline mt-2 inline-block">
          Back to your clips
        </Link>
      </div>
    );
  }

  const { clip, renders } = data;
  const primary = renders?.[0];

  return (
    <div className="space-y-6">
      <Link
        href="/gallery"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary-text hover:text-primary-text transition-colors"
      >
        <FiArrowLeft className="text-sm" /> All clips
      </Link>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="flex-1 min-w-0 space-y-4">
          <div>
            <h1 className="text-xl font-black tracking-tight">{clip.title || "Untitled clip"}</h1>
            {clip.summary && (
              <p className="text-sm text-secondary-text mt-1.5 leading-relaxed">{clip.summary}</p>
            )}
          </div>

          <div className="glass-card rounded-2xl overflow-hidden max-w-sm mx-auto lg:mx-0">
            <div className="aspect-[9/16] bg-black">
              {primary?.url ? (
                <video src={primary.url} controls playsInline className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-secondary-text">
                  {primary ? "Still rendering…" : "No render yet"}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {primary?.url && (
              <a
                href={primary.url}
                download
                className="inline-flex items-center gap-2 rounded-full bg-primary hover:bg-primary-hover px-5 py-2.5 text-xs font-bold text-white transition-colors"
              >
                <FiDownload className="text-sm" /> Download clip
              </a>
            )}
            {["srt", "vtt"].map((format) => (
              <a
                key={format}
                href={`/api/clips/${clip.id}/captions?format=${format}`}
                className="inline-flex items-center gap-2 rounded-full border border-divider hover:bg-bg-card px-5 py-2.5 text-xs font-bold transition-colors"
              >
                <FiFileText className="text-sm" /> .{format}
              </a>
            ))}
          </div>
        </div>

        <GrowthIntelligence clip={clip} />
      </div>
    </div>
  );
}
