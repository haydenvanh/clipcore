import { NextResponse } from "next/server";

/**
 * Route protection and security headers.
 *
 * Named `proxy`, not `middleware`: Next 16 deprecated the middleware filename
 * in favour of proxy, which always runs on the Node runtime. Verified against
 * the bundled upgrade guide (node_modules/next/dist/docs/.../version-16.md).
 *
 * Until now /dashboard and /gallery protected themselves with a client-side
 * useEffect redirect, which flashes the page before bouncing and is not a
 * security boundary. The APIs were protected; the pages were not.
 */

/** Pages that require a signed-in user. */
const PROTECTED_PREFIXES = ["/dashboard", "/gallery"];

/**
 * Headers applied to every response.
 *
 * No CSP here: this app loads Google avatars, Stripe, and inline styles from
 * Tailwind, and a CSP written without measuring what actually loads breaks the
 * product in ways that only show up in production. It belongs in its own change
 * with report-only first.
 */
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "X-DNS-Prefetch-Control": "on",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  // Two years, subdomains included — the value Google's HSTS preload list wants.
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
};

function withSecurityHeaders(response) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}

/**
 * Is there a session cookie?
 *
 * A cookie check only, deliberately: this decides whether to render or
 * redirect, and every route handler still calls getServerSession before
 * touching data. Validating the session here would mean a database round trip
 * on every asset request to save nothing.
 */
function hasSessionCookie(request) {
  return Boolean(
    request.cookies.get("next-auth.session-token") ||
      request.cookies.get("__Secure-next-auth.session-token")
  );
}

export function proxy(request) {
  const { pathname, search } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtected && !hasSessionCookie(request)) {
    const login = new URL("/login", request.url);
    // Preserve where they were going, so signing in lands them there.
    login.searchParams.set("next", `${pathname}${search}`);
    return withSecurityHeaders(NextResponse.redirect(login));
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    // Everything except static assets and image optimization, which do not
    // need a session check and would only add latency.
    "/((?!_next/static|_next/image|favicon.ico|demo.mp4|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4)$).*)",
  ],
};
