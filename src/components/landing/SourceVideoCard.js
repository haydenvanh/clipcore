"use client";

import { useRef, useState } from "react";
import { FiPlay, FiPause, FiClock } from "react-icons/fi";

/**
 * The long-form source at the top of the hero — the "before" to the clip
 * grid's "after".
 *
 * Parallax follows the pointer on devices that actually have one. It is skipped
 * for coarse pointers and reduced-motion users, and it only writes transform
 * (never layout properties), so it cannot cause reflow.
 */
export default function SourceVideoCard() {
  const cardRef = useRef(null);
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  const handleMove = (event) => {
    const card = cardRef.current;
    if (!card) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const rect = card.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;

    card.style.transform = `perspective(1200px) rotateY(${px * 5}deg) rotateX(${-py * 5}deg) translateZ(0)`;
  };

  const reset = () => {
    if (cardRef.current) cardRef.current.style.transform = "";
  };

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      className="glass-card relative rounded-3xl overflow-hidden max-w-4xl mx-auto transition-transform duration-300 ease-out will-change-transform"
    >
      <div className="flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-white/[0.06]">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
        <div className="flex items-center gap-1.5 ml-3 text-secondary-text">
          <FiClock className="text-[11px]" />
          <span className="text-[11px] font-bold">Your source video</span>
        </div>
        <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-secondary-text">
          Long-form in
        </span>
      </div>

      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          src="/demo.mp4"
          preload="metadata"
          muted
          loop
          playsInline
          onEnded={() => setPlaying(false)}
          className="w-full h-full object-cover"
        />

        {!playing && (
          <button
            type="button"
            onClick={toggle}
            aria-label="Play the demo video"
            className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/20 transition-colors cursor-pointer group"
          >
            <span className="w-16 h-16 rounded-full bg-white/95 text-black flex items-center justify-center shadow-2xl transition-transform group-hover:scale-105">
              <FiPlay className="text-xl ml-1" />
            </span>
          </button>
        )}

        {playing && (
          <button
            type="button"
            onClick={toggle}
            aria-label="Pause the demo video"
            className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/75 transition-colors cursor-pointer"
          >
            <FiPause className="text-sm" />
          </button>
        )}
      </div>
    </div>
  );
}
