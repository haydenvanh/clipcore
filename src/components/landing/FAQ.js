export const FAQ_ITEMS = [
  { q: "What counts as a minute?", a: "Minutes are the length of the videos you process. A 30-minute podcast uses 30 minutes, however many clips it produces. Minutes reset on the 1st of each month." },
  { q: "What if processing fails?", a: "Press Retry on the video. It picks up where it stopped, and retries never use extra minutes." },
  { q: "Is Unlimited really unlimited?", a: "Yes — there's no monthly cap on minutes. To keep processing fast for everyone, each account can have up to 3 videos processing at once, and each video can be up to 4 hours long." },
  { q: "Do clips have a watermark?", a: "No. Not on any plan, including Free." },
  { q: "Which videos work?", a: "Public or unlisted YouTube videos, or any video file you upload (MP4, MOV, MKV, WebM, or AVI, up to 2 GB). Private, members-only, and age-restricted YouTube videos can't be fetched — download and upload those instead." },
  { q: "Can I cancel anytime?", a: "Yes, from Billing in two clicks. You keep your plan until the end of the period you've paid for." },
  { q: "Will my launch price go up?", a: "No. The price you subscribe at is the price you keep for as long as your subscription stays active." },
];

export default function FAQ() {
  return (
    <section className="mx-auto w-full max-w-3xl px-5 sm:px-6 py-24">
      <h2 className="text-3xl sm:text-4xl font-semibold text-center">Questions</h2>
      <div className="mt-10 divide-y divide-divider border-y border-divider">
        {FAQ_ITEMS.map((item) => (
          <details key={item.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
              {item.q}
              <span className="text-secondary-text transition-transform group-open:rotate-45 text-xl leading-none" aria-hidden>+</span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-secondary-text">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
