import { describe, it, expect } from "vitest";
import { assertSafeUrl, detectSource, isSupportedSourceUrl } from "@/lib/url-guard";

describe("assertSafeUrl — SSRF protection", () => {
  // Each of these defeated the previous `url.includes("youtube.com")` guard.
  const attacks = [
    ["cloud metadata with allowlist token in the query", "http://169.254.169.254/latest/meta-data/?x=youtube.com"],
    ["GCP metadata host", "http://metadata.google.internal/computeMetadata/v1/"],
    ["loopback by name", "http://localhost:3000/admin"],
    ["loopback IPv4", "http://127.0.0.1/"],
    ["loopback IPv6", "http://[::1]/"],
    ["private 10/8", "http://10.0.0.5/"],
    ["private 172.16/12", "http://172.16.0.1/"],
    ["private 192.168/16", "http://192.168.1.1/"],
    ["carrier-grade NAT", "http://100.100.100.200/"],
    ["this-network 0/8", "http://0.0.0.0/"],
    ["link-local IPv6", "http://[fe80::1]/"],
    ["unique-local IPv6", "http://[fd00::1]/"],
    ["internal TLD", "http://db.internal/"],
    ["mDNS", "http://printer.local/"],
    ["allowlisted string in the path only", "https://evil.example/youtube.com/video"],
    ["allowlisted string as a subdomain suffix trick", "https://youtube.com.evil.example/"],
    ["non-HTTP scheme", "file:///etc/passwd"],
    ["ftp scheme", "ftp://youtube.com/x"],
    ["embedded credentials", "https://admin:hunter2@youtube.com/x"],
  ];

  for (const [name, url] of attacks) {
    it(`rejects ${name}`, () => {
      expect(() => assertSafeUrl(url)).toThrow();
    });
  }

  it("rejects a private address even when any host is allowed", () => {
    expect(() => assertSafeUrl("http://169.254.169.254/", { allowAnyHost: true })).toThrow();
  });

  it("rejects non-strings, empties, and oversized inputs", () => {
    expect(() => assertSafeUrl(null)).toThrow();
    expect(() => assertSafeUrl("")).toThrow();
    expect(() => assertSafeUrl("https://youtube.com/" + "a".repeat(3000))).toThrow();
  });
});

describe("assertSafeUrl — legitimate sources", () => {
  const allowed = [
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "YOUTUBE"],
    ["https://youtu.be/dQw4w9WgXcQ", "YOUTUBE"],
    ["https://m.youtube.com/watch?v=x", "YOUTUBE"],
    ["https://www.tiktok.com/@user/video/123", "TIKTOK"],
    ["https://vm.tiktok.com/ZM123/", "TIKTOK"],
    ["https://www.instagram.com/reel/Cabc123/", "INSTAGRAM"],
  ];

  for (const [url, source] of allowed) {
    it(`accepts ${url} as ${source}`, () => {
      expect(() => assertSafeUrl(url)).not.toThrow();
      expect(detectSource(url)).toBe(source);
      expect(isSupportedSourceUrl(url)).toBe(true);
    });
  }

  it("allows an arbitrary public CDN when allowAnyHost is set", () => {
    expect(() => assertSafeUrl("https://cdn.muapi.ai/x.mp4", { allowAnyHost: true })).not.toThrow();
  });

  it("still rejects that CDN under the strict source allowlist", () => {
    expect(() => assertSafeUrl("https://cdn.muapi.ai/x.mp4")).toThrow();
  });
});
