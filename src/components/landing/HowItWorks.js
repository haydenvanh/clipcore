const STEPS = [
  { n: "1", title: "Paste a link", body: "Drop in any YouTube video — a podcast, stream, interview, or talk, up to 4 hours long." },
  { n: "2", title: "AI finds the moments", body: "ClipCore transcribes every word, then scores each stretch for hooks, reactions, and questions — cut on clean sentence breaks." },
  { n: "3", title: "Download your clips", body: "Each moment comes back as a vertical 9:16 clip with word-by-word captions, ready to post." },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 mx-auto w-full max-w-6xl px-5 sm:px-6 py-24">
      <div className="max-w-2xl space-y-3">
        <p className="eyebrow">How it works</p>
        <h2 className="text-3xl sm:text-5xl font-semibold">From one long video to a week of shorts.</h2>
      </div>
      <ol className="mt-12 grid gap-4 md:grid-cols-3">
        {STEPS.map((step) => (
          <li key={step.n} className="panel p-6 sm:p-7 space-y-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-semibold text-black">{step.n}</span>
            <h3 className="text-lg font-semibold">{step.title}</h3>
            <p className="text-sm leading-relaxed text-secondary-text">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
