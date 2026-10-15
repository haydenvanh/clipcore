"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { FiLoader, FiArrowRight } from "react-icons/fi";
import UploadButton from "@/components/dashboard/UploadButton";

/**
 * Paste a YouTube link, start processing, and go straight to its page.
 *
 * `initialUrl` is a link pasted on the landing page: it starts processing as
 * soon as the dashboard opens, so a visitor goes from link to clips in one go.
 */
export default function NewVideoForm({ onStarted, initialUrl }) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl ?? "");
  const [busy, setBusy] = useState(false);
  // Plan limits get an inline message with a way forward, not a toast.
  const [limitError, setLimitError] = useState(null);

  const submit = async (event, override) => {
    event?.preventDefault();
    const sourceUrl = (override ?? url).trim();
    if (!sourceUrl || busy) return;

    setBusy(true);
    setLimitError(null);
    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl }),
      });
      const data = await res.json();
      if (res.status === 402 || res.status === 429) {
        setLimitError({ message: data.error, upgrade: res.status === 402 });
        setBusy(false);
        return;
      }
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

  // Start a link handed over from the landing page, once. The address bar is
  // cleaned first, so Back doesn't start the same video again.
  const started = useRef(false);
  useEffect(() => {
    if (!initialUrl || started.current) return;
    started.current = true;
    window.history.replaceState(null, "", "/dashboard");
    const timer = setTimeout(() => submit(undefined, initialUrl), 0);
    return () => clearTimeout(timer);
    // submit is only needed once, for the handed-over link
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl]);

  return (
    <form onSubmit={submit} className="panel p-5 sm:p-6">
      <label htmlFor="source-url" className="block text-sm font-medium text-primary-text mb-3">
        Paste a YouTube link
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
          className="flex-1 bg-bg-page border border-divider rounded-full px-5 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-shadow disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || !url.trim()}
          className="btn btn-primary focus-ring px-6 py-3 text-sm"
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

      <div className="mt-4">
        <UploadButton
          disabled={busy}
          onLimit={setLimitError}
          onUploaded={(videoId) => {
            onStarted?.(videoId);
            router.push(`/videos/${videoId}`);
          }}
        />
      </div>

      {limitError ? (
        <div role="alert" className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          <span>{limitError.message}</span>
          {limitError.upgrade && (
            <Link href="/pricing" className="btn btn-primary focus-ring px-4 py-2 text-xs shrink-0">See plans</Link>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-secondary-text">
          Downloads the video, transcribes it, picks the strongest moments, and renders each as a
          vertical clip with captions burned in.
        </p>
      )}
    </form>
  );
}
