"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FiLink, FiUploadCloud, FiArrowRight } from "react-icons/fi";
import { FaYoutube, FaTiktok, FaInstagram } from "react-icons/fa";

/**
 * The hero's primary action.
 *
 * Real, not a mockup: whatever the visitor types is carried into /dashboard so
 * the intent survives sign-in. A hero input that silently discards what someone
 * typed is the most expensive kind of broken.
 */
export default function HeroGenerator() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [mode, setMode] = useState("link");
  const fileRef = useRef(null);

  const go = () => {
    const params = new URLSearchParams();
    if (value.trim()) params.set("url", value.trim());
    router.push(`/dashboard${params.toString() ? `?${params}` : ""}`);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="glass-card relative rounded-[28px] p-2.5 sm:p-3">
        {/* Source toggle */}
        <div className="flex items-center gap-1 px-1.5 pt-1 pb-2.5">
          {[
            { id: "link", label: "Paste a link", Icon: FiLink },
            { id: "upload", label: "Upload", Icon: FiUploadCloud },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => (id === "upload" ? fileRef.current?.click() : setMode(id))}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors cursor-pointer ${
                mode === id
                  ? "bg-white/10 text-primary-text"
                  : "text-secondary-text hover:text-primary-text"
              }`}
            >
              <Icon className="text-xs" />
              {label}
            </button>
          ))}

          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={() => router.push("/dashboard")}
          />
        </div>

        <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
          <label htmlFor="hero-url" className="sr-only">
            Video URL
          </label>
          <input
            id="hero-url"
            type="url"
            inputMode="url"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && go()}
            placeholder="Paste a YouTube, TikTok, or Instagram link…"
            className="flex-1 bg-black/25 border border-white/10 rounded-2xl px-4 sm:px-5 py-4
              text-sm sm:text-base text-primary-text placeholder:text-secondary-text/70
              outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/30
              transition-shadow min-h-[52px]"
          />

          <button
            type="button"
            onClick={go}
            className="cta-glow group shrink-0 inline-flex items-center justify-center gap-2
              rounded-2xl bg-primary hover:bg-primary-hover px-6 sm:px-7 py-4 min-h-[52px]
              text-sm font-bold text-white transition-colors cursor-pointer
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            Generate Clips
            <FiArrowRight className="text-sm transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-5 mt-5 text-secondary-text">
        <span className="text-[10px] font-black uppercase tracking-widest">Works with</span>
        <div className="flex items-center gap-3.5">
          <FaYoutube className="text-base" aria-label="YouTube" />
          <FaTiktok className="text-sm" aria-label="TikTok" />
          <FaInstagram className="text-base" aria-label="Instagram" />
          <span className="text-[10px] font-bold uppercase tracking-widest">+ upload</span>
        </div>
      </div>
    </div>
  );
}
