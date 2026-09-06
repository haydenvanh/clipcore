/**
 * The questions people actually ask before paying, answered honestly.
 *
 * Deliberately a plain module rather than an export from the "use client" FAQ
 * component: server components (the landing page's JSON-LD) need the real
 * array, and a value imported across the client boundary arrives as a
 * reference proxy, not data.
 */
export const FAQ_ITEMS = [
  {
    q: "How long can my video be?",
    a: "Up to 60 minutes on Basic, 3 hours on Pro, and 5 hours on Ultra. There is no 2-minute cap on any plan — long-form is the normal case here, not a premium add-on.",
  },
  {
    q: "What does 1 credit actually buy?",
    a: "One minute of source video processed, rounded up. A 47-minute podcast costs 47 credits whether it produces 3 clips or 30. You are never charged per clip or per export.",
  },
  {
    q: "What happens if a job fails?",
    a: "Credits are held when a job starts and automatically refunded if it fails. You are only charged for video we actually processed, and every movement is recorded in your credit history.",
  },
  {
    q: "Do I own the clips?",
    a: "Yes. You keep full rights to everything you upload and everything we produce from it. We do not train models on your footage.",
  },
  {
    q: "What aspect ratios and platforms are supported?",
    a: "9:16 for TikTok, Reels, and Shorts; 1:1 for feeds; and 16:9 for YouTube and LinkedIn. Every clip is exported without a watermark on every paid plan.",
  },
  {
    q: "Which languages do captions support?",
    a: "English, Spanish, French, German, Italian, Portuguese, Japanese, and Korean today, with the language detected automatically from your audio. More are being added.",
  },
  {
    q: "What happens to unused credits?",
    a: "They roll over for one billing period, then expire. It stops credits accumulating indefinitely while giving you room for a quiet month.",
  },
  {
    q: "Can I cancel any time?",
    a: "Yes, from the billing portal in your dashboard. You keep access and any remaining credits until the end of the period you have already paid for. There is no annual lock-in.",
  },
];
