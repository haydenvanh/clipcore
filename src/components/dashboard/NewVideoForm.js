"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { FiLoader, FiArrowRight } from "react-icons/fi";

/**
 * Paste a YouTube link, start processing, and go straight to its page.
 */
export default function NewVideoForm({ onStarted }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event?.preventDefault();
    const sourceUrl = url.trim();
    if (!sourceUrl || busy) return;

    setBusy(true);
    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start processing.");

      if (data.duplicate) toast("Already processing that video.");
      setUrl("");
      onStarted?.(data.videoId);
      router.push(`/videos/${data.videoId}`);
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="panel p-5 sm:p-6">
      <label htmlFor="source-url" className="block text-sm font-medium text-primary-text mb-3">
        YouTube link
      </label>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          id="source-url"
          type="url"
          inputMode="url"
          autoComplete="off"
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          disabled={busy}
          className="flex-1 bg-bg-page border border-divider rounded-lg px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-shadow disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || !url.trim()}
          className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg bg-primary hover:bg-primary-hover px-6 py-3 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {busy ? (
            <>
              <FiLoader className="animate-spin" /> Starting…
            </>
          ) : (
            <>
              Make clips <FiArrowRight />
            </>
          )}
        </button>
      </div>

      <p className="mt-3 text-xs text-secondary-text">
        Downloads the video, transcribes it, picks the strongest moments, and renders each as a
        vertical clip with captions burned in.
      </p>
    </form>
  );
}
