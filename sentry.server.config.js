import * as Sentry from "@sentry/nextjs";

/**
 * Server-side error reporting.
 *
 * Every init is guarded on SENTRY_DSN so local development and self-hosters
 * without a Sentry account run with reporting simply switched off, rather than
 * erroring or silently buffering events nobody will read.
 */
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    // 10% of transactions: enough to spot a slow route, cheap enough for the
    // free tier's 5k events/month.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    // We handle user data; never let the SDK attach request bodies or headers
    // that could carry a token.
    sendDefaultPii: false,
    beforeSend(event) {
      // Belt and braces: strip anything that looks like a credential before it
      // leaves the process.
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
        delete event.request.headers["stripe-signature"];
      }
      return event;
    },
  });
}
