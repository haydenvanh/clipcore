import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Shared helpers for route handlers.
 *
 * ClipCore is a private, single-user tool: there is no sign-in. Every record
 * still belongs to a User row, because Video, Clip and Render all carry a
 * userId and keeping one owner row is a far smaller change than threading its
 * removal through the schema, the worker and every query. That owner is created
 * on first use and returned by getOwner().
 */

export const OWNER_ID = "local-owner";

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

let ownerReady = null;

/**
 * The single local user that owns everything.
 *
 * Upserted once per server process and memoised, so routes can call it freely
 * without a write on every request.
 */
export async function getOwner() {
  if (!ownerReady) {
    ownerReady = prisma.user
      .upsert({
        where: { id: OWNER_ID },
        create: { id: OWNER_ID, name: "Owner" },
        update: {},
        select: { id: true, name: true },
      })
      .catch((error) => {
        // Don't cache a failure: a database that was briefly unreachable
        // should not poison every later request in this process.
        ownerReady = null;
        throw error;
      });
  }
  return ownerReady;
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
 * The real message is returned rather than a generic "something went wrong":
 * the only person who ever sees this is the owner, and hiding the cause from
 * them just means reading server logs to find out what broke.
 */
export function errorResponse(scope, error) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(`[${scope}]`, error);
  return NextResponse.json(
    { error: error?.message || "Something went wrong." },
    { status: 500 }
  );
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
