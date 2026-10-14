import { NextResponse } from "next/server";

/**
 * Send signed-out visitors to /login before a page renders.
 *
 * Named `proxy`, not `middleware`: Next 16 renamed the convention.
 *
 * A cookie check only, as the Next docs recommend for proxy: it runs on every
 * request, including prefetches, so it must not hit the database. It decides
 * whether to render or redirect; the real boundary is requireUser() in each
 * route handler, which validates the session and scopes every query.
 */

/** Pages anyone can open. Everything else needs a session. */
const PUBLIC_PATHS = ["/", "/pricing", "/login", "/terms", "/privacy"];

/** next-auth's session cookie; large tokens are split into .0, .1, … */
function hasSessionCookie(request) {
  return request.cookies
    .getAll()
    .some(({ name }) => /^(__Secure-)?next-auth\.session-token(\.\d+)?$/.test(name));
}

/**
 * In production, one address only: www, the Railway address, and any other
 * host forward to the canonical one in NEXTAUTH_URL.
 *
 * Sign-in depends on it: next-auth keeps its state cookie on the host sign-in
 * started from, and Google always returns to NEXTAUTH_URL. Start on www, come
 * back to the bare domain, and the cookie is missing — "State cookie was
 * missing" and a failed sign-in.
 */
function canonicalRedirect(request, env = process.env) {
  if (env.NODE_ENV !== "production" || !env.NEXTAUTH_URL) return null;
  let canonical;
  try {
    canonical = new URL(env.NEXTAUTH_URL);
  } catch {
    return null;
  }
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "").split(",")[0].trim();
  if (!host || host === canonical.host) return null;

  const target = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, canonical.origin);
  return NextResponse.redirect(target, 308);
}

export { canonicalRedirect };

export function proxy(request) {
  const redirect = canonicalRedirect(request);
  if (redirect) return redirect;

  const { pathname, search } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || (path !== "/" && pathname.startsWith(`${path}/`)));
  if (isPublic || hasSessionCookie(request)) return NextResponse.next();

  const login = new URL("/login", request.url);
  // Land them back where they were going once they've signed in.
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    // Pages only: API routes answer 401 themselves, and static assets need no
    // session.
    "/((?!api/|_next/static|_next/image|favicon.ico|icon.svg|apple-icon.svg|demo/|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4)$).*)",
  ],
};
