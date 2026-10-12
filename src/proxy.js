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
const PUBLIC_PATHS = ["/login"];

/** next-auth's session cookie; large tokens are split into .0, .1, … */
function hasSessionCookie(request) {
  return request.cookies
    .getAll()
    .some(({ name }) => /^(__Secure-)?next-auth\.session-token(\.\d+)?$/.test(name));
}

export function proxy(request) {
  const { pathname, search } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (isPublic || hasSessionCookie(request)) return NextResponse.next();

  const login = new URL("/login", request.url);
  // Land them back where they were going once they've signed in.
  if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    // Pages only: API routes answer 401 themselves, and static assets need no
    // session.
    "/((?!api/|_next/static|_next/image|favicon.ico|icon.svg|apple-icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4)$).*)",
  ],
};
