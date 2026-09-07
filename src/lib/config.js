/**
 * Centralized configuration for ClipCore.
 *
 * Everything that reads process.env goes through here so that a misconfigured
 * deploy is detectable in one place. Values that must never reach the browser
 * (secrets) are only read server-side.
 */

const config = {
  appName: "ClipCore",
  appTagline: "AI Content Operating System",
  appDescription:
    "ClipCore finds the moments worth posting in your long-form video and turns them into captioned, platform-ready clips.",

  /**
   * Visual theme. Previously read as `config.theme` in layout.js and
   * providers.js but never defined here, so NEXT_PUBLIC_THEME did nothing.
   * Must be one of the [data-theme] blocks in globals.css.
   */
  theme: process.env.NEXT_PUBLIC_THEME || "slate-indigo",

  auth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    secret: process.env.NEXTAUTH_SECRET,
    url: process.env.NEXTAUTH_URL || "http://localhost:3000",
    webhook_url:
      process.env.WEBHOOK_URL ||
      process.env.NEXTAUTH_URL ||
      "http://localhost:3000",
  },

  stripe: {
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },

  ai: {
    aiclips: {
      apiKey: process.env.AICLIPS_API_KEY,
      baseUrl: "https://api.muapi.ai/api/v1",
      youtubeEndpoint: "https://api.muapi.ai/api/v1/youtube-download",
      clippingEndpoint: "https://api.muapi.ai/api/v1/ai-clipping",
      /**
       * Shared secret appended to the callback URL we hand the provider and
       * verified on the way back in. Without it /api/webhook/muapi is an
       * unauthenticated write to any user's job.
       */
      webhookSecret: process.env.MUAPI_WEBHOOK_SECRET,
    },
  },

  db: {
    url: process.env.DATABASE_URL,
  },
};

// Warn loudly at boot rather than failing mysteriously at request time.
const requiredKeys = [
  ["GOOGLE_CLIENT_ID", config.auth.google.clientId],
  ["GOOGLE_CLIENT_SECRET", config.auth.google.clientSecret],
  ["NEXTAUTH_SECRET", config.auth.secret],
  ["STRIPE_SECRET_KEY", config.stripe.secretKey],
  ["DATABASE_URL", config.db.url],
];

const recommendedKeys = [
  ["MUAPI_WEBHOOK_SECRET", config.ai.aiclips.webhookSecret],
  ["STRIPE_WEBHOOK_SECRET", config.stripe.webhookSecret],
];

if (typeof window === "undefined") {
  for (const [name, value] of requiredKeys) {
    if (!value) console.warn(`[CONFIG] Missing required environment variable: ${name}`);
  }
  for (const [name, value] of recommendedKeys) {
    if (!value) console.warn(`[CONFIG] Missing recommended environment variable: ${name}`);
  }
}

export default config;
