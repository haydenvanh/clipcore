"use client";

import { useRef, useState } from "react";
import { FiUploadCloud, FiX } from "react-icons/fi";

const MAX_BYTES = 2 * 1024 ** 3;
const ACCEPT = "video/mp4,video/quicktime,video/x-matroska,video/webm,video/x-msvideo,.mp4,.mov,.mkv,.webm,.avi";

/**
 * Upload a video file instead of pasting a link.
 *
 * XMLHttpRequest rather than fetch, because fetch can't report upload
 * progress — and a 2 GB upload with no progress bar looks frozen.
 *
 * @param {{onUploaded: (videoId: string) => void, onLimit: (error: {message: string, upgrade: boolean}) => void, disabled?: boolean}} props
 */
export default function UploadButton({ onUploaded, onLimit, disabled }) {
  const input = useRef(null);
  const xhr = useRef(null);
  const [progress, setProgress] = useState(null); // 0..1 while uploading
  const [error, setError] = useState(null);

  function upload(file) {
    setError(null);
    if (!file) return;
    if (file.size > MAX_BYTES) return setError("That file is over 2 GB.");

    const request = new XMLHttpRequest();
    xhr.current = request;
    request.open("POST", "/api/videos/upload");
    request.setRequestHeader("Content-Type", file.type || "video/mp4");
    request.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
    request.upload.onprogress = (event) => event.lengthComputable && setProgress(event.loaded / event.total);
    request.onload = () => {
      setProgress(null);
      let data = {};
      try {
        data = JSON.parse(request.responseText);
      } catch {}
      if (request.status === 402 || request.status === 429) return onLimit?.({ message: data.error, upgrade: request.status === 402 });
      if (request.status !== 200) return setError(data.error || "The upload failed. Please try again.");
      onUploaded(data.videoId);
    };
    request.onerror = () => {
      setProgress(null);
      setError("The upload was interrupted. Check your connection and try again.");
    };
    request.onabort = () => setProgress(null);
    setProgress(0);
    request.send(file);
  }

  if (progress !== null) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.08]" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
          <div className="h-full rounded-full bg-white transition-[width]" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="tabular-nums text-secondary-text w-10 text-right">{Math.round(progress * 100)}%</span>
        <button type="button" onClick={() => xhr.current?.abort()} className="focus-ring rounded p-1 text-secondary-text hover:text-primary-text cursor-pointer" aria-label="Cancel upload">
          <FiX />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(event) => {
          upload(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        className="focus-ring inline-flex items-center gap-2 rounded-full border border-dashed border-divider px-4 py-2 text-sm text-secondary-text hover:text-primary-text hover:border-white/30 transition-colors disabled:opacity-50 cursor-pointer"
      >
        <FiUploadCloud aria-hidden /> Or upload a video file
      </button>
      <span className="ml-3 text-xs text-secondary-text">MP4, MOV, MKV, WebM · up to 2 GB</span>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
