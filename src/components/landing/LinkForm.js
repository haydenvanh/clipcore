"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { FiLink, FiLoader } from "react-icons/fi";

/**
 * The "paste a link" box from the landing page.
 *
 * Signed in, it goes straight to the dashboard and starts processing.
 * Signed out, it goes through Google sign-in first and then lands on the
 * dashboard with the link — one click from a visitor's link to their clips.
 */
export default function LinkForm({ signedIn, size = "lg" }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  function submit(event) {
    event.preventDefault();
    const value = url.trim();
    if (!/^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(value)) {
      setError("Paste a YouTube link, like https://youtube.com/watch?v=…");
      return;
    }
    setError(null);
    setPending(true);
    const target = `/dashboard?url=${encodeURIComponent(value)}`;
    if (signedIn) router.push(target);
    else signIn("google", { callbackUrl: target });
  }

  const large = size === "lg";

  return (
    <form onSubmit={submit} className="w-full max-w-2xl mx-auto">
      <div className={`flex flex-col sm:flex-row gap-2 rounded-[28px] sm:rounded-full border border-white/10 bg-white/[0.06] p-2 ${large ? "sm:p-2.5" : ""}`}>
        <label className="flex flex-1 items-center gap-3 px-4 min-w-0">
          <FiLink className="text-secondary-text shrink-0" aria-hidden />
          <span className="sr-only">YouTube link</span>
          <input
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Drop a YouTube link"
            className={`w-full bg-transparent outline-none placeholder:text-secondary-text ${large ? "py-3 text-base" : "py-2.5 text-sm"}`}
          />
        </label>
        <button type="submit" disabled={pending} className={`btn btn-primary focus-ring ${large ? "px-7 py-3.5 text-base" : "px-5 py-2.5 text-sm"}`}>
          {pending && <FiLoader className="animate-spin" aria-hidden />}
          Get free clips
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-300 text-center">{error}</p>
      ) : (
        <p className="mt-3 text-sm text-secondary-text text-center">60 free minutes every month · No credit card · No watermark</p>
      )}
    </form>
  );
}
