import { FaLink, FaWaveSquare, FaDownload } from "react-icons/fa";

const STEPS = [
  {
    icon: FaLink,
    title: "Drop in a video",
    body: "Paste a YouTube link or upload a file up to 5 hours long. We pull the source and normalize it.",
  },
  {
    icon: FaWaveSquare,
    title: "We find the moments",
    body: "Your audio is transcribed word by word, then scored on speech intensity, reactions, emotion, and topic shifts. The strongest moments rise to the top.",
  },
  {
    icon: FaDownload,
    title: "Post the clips",
    body: "Each moment is cut vertical, captioned in karaoke style, and exported without a watermark. Download and post.",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 scroll-mt-24"
    >
      <div className="text-center mb-14 space-y-3">
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
          Three steps. About six minutes.
        </h2>
        <p className="text-sm text-secondary-text max-w-xl mx-auto">
          No timeline, no keyframes, no editor to learn.
        </p>
      </div>

      <ol className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          return (
            <li
              key={step.title}
              className="relative bg-bg-card border border-divider/60 rounded-2xl p-7 flex flex-col gap-4"
            >
              <span className="absolute top-6 right-6 text-5xl font-black text-primary/10 leading-none select-none">
                {index + 1}
              </span>
              <div className="w-11 h-11 rounded-xl bg-primary/12 text-primary flex items-center justify-center">
                <Icon className="text-lg" />
              </div>
              <h3 className="text-base font-bold tracking-tight">{step.title}</h3>
              <p className="text-sm text-secondary-text leading-relaxed">{step.body}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
