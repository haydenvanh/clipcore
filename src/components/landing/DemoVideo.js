/**
 * The real product demo recorded for this project, served from /public.
 *
 * Deliberately self-hosted: the GitHub user-attachments URL the README uses
 * redirects to a signed URL and fails as a <video src> with
 * MEDIA_ERR_SRC_NOT_SUPPORTED, which rendered the hero as a black void.
 *
 * preload="metadata" keeps LCP fast — the browser fetches enough to paint the
 * first frame rather than the whole 3 MB file.
 */
const DEMO_VIDEO_URL = "/demo.mp4";

export default function DemoVideo() {
  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
      <div
        className="relative rounded-2xl overflow-hidden border border-divider/60 shadow-2xl shadow-black/40"
        style={{
          // Sits behind the video, so a slow or failed load still reads as a
          // player rather than a black rectangle.
          background:
            "linear-gradient(135deg, var(--color-bg-card), var(--color-bg-elevated))",
        }}
      >
        <video
          src={DEMO_VIDEO_URL}
          controls
          playsInline
          muted
          loop
          preload="metadata"
          className="w-full aspect-video object-cover"
        >
          Your browser does not support embedded video.{" "}
          <a href={DEMO_VIDEO_URL}>Download the demo</a>.
        </video>
      </div>
      <p className="text-center text-[11px] text-secondary-text uppercase tracking-widest font-bold mt-4">
        A real source video, and the clips ClipCore produced from it
      </p>
    </section>
  );
}
