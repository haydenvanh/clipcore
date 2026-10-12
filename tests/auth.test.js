import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { canAccessKey } from "../src/lib/media-access.js";
import { proxy } from "../src/proxy.js";

describe("canAccessKey — users only read their own files", () => {
  const owners = { clipA: "alice", clipB: "bob" };
  const lookups = { clipOwner: async (id) => owners[id] ?? null };

  it("allows a user's own sources and clips", async () => {
    expect(await canAccessKey("sources/alice/vid1/source.mp4", "alice", lookups)).toBe(true);
    expect(await canAccessKey("clips/alice/clipA/r1.mp4", "alice", lookups)).toBe(true);
  });

  it("refuses another user's files", async () => {
    expect(await canAccessKey("sources/bob/vid2/source.mp4", "alice", lookups)).toBe(false);
    expect(await canAccessKey("clips/bob/clipB/r2.jpg", "alice", lookups)).toBe(false);
  });

  it("checks caption files against the clip's owner", async () => {
    expect(await canAccessKey("captions/clipA.en.ass", "alice", lookups)).toBe(true);
    expect(await canAccessKey("captions/clipB.en.ass", "alice", lookups)).toBe(false);
    expect(await canAccessKey("captions/missing.en.ass", "alice", lookups)).toBe(false);
  });

  it("refuses a folder rather than a file, and anything unrecognised", async () => {
    expect(await canAccessKey("sources/alice", "alice", lookups)).toBe(false);
    expect(await canAccessKey("transcripts/vid1.json", "alice", lookups)).toBe(false);
    expect(await canAccessKey("sources/alice/x.mp4", "", lookups)).toBe(false);
  });
});

describe("proxy — signed-out visitors go to /login", () => {
  const request = (path, cookie) =>
    new NextRequest(`http://localhost:3000${path}`, cookie ? { headers: { cookie } } : undefined);

  it("redirects a signed-out visitor, remembering where they were going", () => {
    const response = proxy(request("/videos/abc?tab=clips"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location"));
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/videos/abc?tab=clips");
  });

  it("sends the home page to a plain /login", () => {
    const location = new URL(proxy(request("/")).headers.get("location"));
    expect(location.pathname).toBe("/login");
    expect(location.search).toBe("");
  });

  it("lets the login page through", () => {
    expect(proxy(request("/login")).headers.get("location")).toBeNull();
  });

  it("lets a request with a session cookie through, including chunked and secure ones", () => {
    for (const cookie of [
      "next-auth.session-token=abc",
      "__Secure-next-auth.session-token=abc",
      "next-auth.session-token.0=abc",
    ]) {
      expect(proxy(request("/", cookie)).headers.get("location")).toBeNull();
    }
  });

  it("isn't fooled by a similarly named cookie", () => {
    expect(proxy(request("/", "next-auth.csrf-token=abc")).status).toBe(307);
  });
});
