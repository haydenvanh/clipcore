import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

/** Shared helpers for route handlers. */

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * The signed-in user, or a 401.
 *
 * Every route that reads or writes a user's data starts here and scopes its
 * queries by the returned id. The proxy's cookie check only decides whether to
 * show a page; this is the actual boundary.
 */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "Sign in to continue.");
  return user;
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
 * Map a thrown error to a response.
 *
 * ApiErrors carry a message written for the user. Anything else is unexpected:
 * its real message is shown in development, but in production it can contain
 * database or file-system details, so users get a generic one and the detail
 * goes to the server log.
 */
export function errorResponse(scope, error) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(`[${scope}]`, error);
  const message = process.env.NODE_ENV === "production" ? "Something went wrong." : error?.message;
  return NextResponse.json({ error: message || "Something went wrong." }, { status: 500 });
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
