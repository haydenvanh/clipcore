"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { FiLink, FiUploadCloud, FiLoader } from "react-icons/fi";

const MAX_BYTES = 2 * 1024 * 1024 * 1024;

/**
 * Start a job from a link or a file.
 *
 * Uploads go straight from the browser to R2 through a presigned PUT — they
 * never pass through Next.js, which caps request bodies at 4.5 MB.
 */
export default function NewVideoForm({ onStarted }) {
  const [mode, setMode] = useState("link");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInput = useRef(null);

  const start = async (body) => {
    const res = await fetch("/api/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not start processing.");
    return data;
  };

  const submitLink = async () => {
    if (!url.trim()) return;
    setBusy(true);
    try {
      const result = await start({ sourceUrl: url.trim() });
      toast.success("Processing started.");
      setUrl("");
      onStarted?.(result.videoId);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  /** Read the duration locally so the plan's length cap fails fast. */
  const probeDuration = (file) =>
    new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      const done = (value) => {
        URL.revokeObjectURL(video.src);
        resolve(value);
      };
      video.onloadedmetadata = () => done(Math.round(video.duration));
      video.onerror = () => done(null);
      setTimeout(() => done(null), 5000);
      video.src = URL.createObjectURL(file);
    });

  const submitFile = async (file) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error("That file is larger than the 2 GB limit.");
      return;
    }

    setBusy(true);
    setProgress(0);
    try {
      const durationSeconds = await probeDuration(file);

      const presignRes = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: file.type || "video/mp4",
          contentLength: file.size,
          filename: file.name,
          durationSeconds,
        }),
      });
      const presign = await presignRes.json();
      if (!presignRes.ok) throw new Error(presign.error || "Could not prepare the upload.");

      // XHR rather than fetch: fetch still cannot report upload progress, and a
      // 2 GB upload with no progress bar looks like a hang.
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", presign.uploadUrl, true);
        // Must match the signed content type exactly or the signature fails.
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`Upload failed (${xhr.status})`));
        xhr.onerror = () => reject(new Error("Upload failed. Check your connection."));
        xhr.send(file);
      });

      const result = await start({ videoId: presign.videoId, durationSeconds });
      toast.success("Upload complete. Processing started.");
      onStarted?.(result.videoId);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
      setProgress(0);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <div className="bg-bg-card border border-divider/60 rounded-2xl p-6 sm:p-8">
      <div className="flex gap-1 mb-6 border-b border-divider/40">
        {[
          { id: "link", label: "Paste a link", icon: FiLink },
          { id: "upload", label: "Upload a file", icon: FiUploadCloud },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setMode(tab.id)}
              disabled={busy}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors disabled:opacity-50 ${
                mode === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-secondary-text hover:text-primary-text"
              }`}
            >
              <Icon className="text-sm" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {mode === "link" ? (
        <div className="space-y-4">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !busy && submitLink()}
            placeholder="https://youtube.com/watch?v=..."
            disabled={busy}
            className="w-full bg-bg-page border border-divider/60 rounded-lg px-4 py-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow disabled:opacity-50"
          />
          <p className="text-xs text-secondary-text">
            YouTube links work today. TikTok and Instagram are coming soon.
          </p>
          <button
            onClick={submitLink}
            disabled={busy || !url.trim()}
            className="w-full bg-primary hover:bg-primary-hover text-white rounded-lg py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? <><FiLoader className="animate-spin" /> Starting…</> : "Find my clips"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <label
            className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed border-divider rounded-xl py-12 transition-colors ${
              busy ? "opacity-60" : "cursor-pointer hover:border-primary/50 hover:bg-bg-page/40"
            }`}
          >
            <FiUploadCloud className="text-2xl text-secondary-text" />
            <span className="text-sm font-semibold">
              {busy ? `Uploading… ${progress}%` : "Choose a video file"}
            </span>
            <span className="text-xs text-secondary-text">MP4, MOV, MKV or WebM · up to 2 GB</span>
            <input
              ref={fileInput}
              type="file"
              accept="video/*,audio/*"
              disabled={busy}
              className="hidden"
              onChange={(e) => submitFile(e.target.files?.[0])}
            />
          </label>

          {busy && progress > 0 && (
            <div className="h-1.5 bg-bg-page rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
