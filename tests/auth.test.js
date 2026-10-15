import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { canAccessKey } from "../src/lib/media-access.js";
import { proxy, canonicalRedirect } from "../src/proxy.js";

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

  it("lets the public marketing pages through", () => {
    for (const path of ["/", "/pricing", "/login", "/terms", "/privacy", "/opengraph-image"]) {
      expect(proxy(request(path)).headers.get("location")).toBeNull();
    }
  });

  it("protects the app pages, and doesn't treat every path as public because / is", () => {
    for (const path of ["/dashboard", "/billing", "/videos/abc", "/clips/x"]) {
      expect(new URL(proxy(request(path)).headers.get("location")).pathname).toBe("/login");
    }
  });

  it("lets a request with a session cookie through, including chunked and secure ones", () => {
    for (const cookie of [
      "next-auth.session-token=abc",
      "__Secure-next-auth.session-token=abc",
      "next-auth.session-token.0=abc",
    ]) {
      expect(proxy(request("/dashboard", cookie)).headers.get("location")).toBeNull();
    }
  });

  it("isn't fooled by a similarly named cookie", () => {
    expect(proxy(request("/dashboard", "next-auth.csrf-token=abc")).status).toBe(307);
  });
});

describe("canonicalRedirect — one address in production", () => {
  const prod = { NODE_ENV: "production", NEXTAUTH_URL: "https://useclipcore.com" };
  const request = (url, host) => new NextRequest(url, { headers: { host } });

  it("forwards www and the Railway address to the canonical domain, keeping the path", () => {
    for (const host of ["www.useclipcore.com", "clipcore-production.up.railway.app"]) {
      const response = canonicalRedirect(request(`https://${host}/pricing?interval=month`, host), prod);
      expect(response.status).toBe(308);
      expect(response.headers.get("location")).toBe("https://useclipcore.com/pricing?interval=month");
    }
  });

  it("leaves the canonical domain alone", () => {
    expect(canonicalRedirect(request("https://useclipcore.com/", "useclipcore.com"), prod)).toBeNull();
  });

  it("trusts the forwarded host behind the platform's proxy", () => {
    const req = new NextRequest("http://10.0.0.5:3000/", { headers: { host: "10.0.0.5:3000", "x-forwarded-host": "useclipcore.com" } });
    expect(canonicalRedirect(req, prod)).toBeNull();
  });

  it("does nothing outside production", () => {
    expect(canonicalRedirect(request("http://127.0.0.1:3000/", "127.0.0.1:3000"), { NODE_ENV: "development", NEXTAUTH_URL: "http://localhost:3000" })).toBeNull();
  });
});
