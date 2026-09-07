import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import * as Sentry from "@sentry/nextjs";
import { InsufficientCreditsError } from "@/lib/services/credits";

/**
 * Shared helpers for route handlers.
 *
 * Before this existed, each route re-implemented session checks and error
 * mapping slightly differently, which is how two status routes ended up with
 * no session check at all.
 */

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Returns the session user, or throws a 401 ApiError. */
export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new ApiError(401, "You must be signed in to do that.");
  }
  return session.user;
}

/** Parse a JSON body, rejecting anything that is not a JSON object. */
export async function readJson(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "Request body must be valid JSON.");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError(400, "Request body must be a JSON object.");
  }
  return body;
}

/**
 * Map a thrown error to a response. Client-safe messages are passed through;
 * anything else becomes a generic 500 so internal details do not leak.
 */
export function errorResponse(scope, error) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof InsufficientCreditsError) {
    return NextResponse.json(
      { error: "Insufficient credits.", required: error.required, available: error.available },
      { status: 402 }
    );
  }
  // Only genuinely unexpected failures reach here — the branches above are
  // expected outcomes and would be noise in the error tracker.
  console.error(`[${scope}]`, error);
  Sentry.captureException(error, { tags: { scope } });

  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

/** Wrap a handler so thrown ApiErrors become responses. */
export function handler(scope, fn) {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (error) {
      return errorResponse(scope, error);
    }
  };
}
