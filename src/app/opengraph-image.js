import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * The card shown when a ClipCore link is shared (X, iMessage, Discord,
 * Slack, LinkedIn). Built from real demo output, so it shows the product.
 */
export const alt = "ClipCore — turn one long video into captioned vertical clips";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function frame(name) {
  const data = await readFile(join(process.cwd(), "public/demo", name));
  return `data:image/jpeg;base64,${data.toString("base64")}`;
}

export default async function Image() {
  const frames = await Promise.all(["clip-1.jpg", "clip-2.jpg", "clip-3.jpg"].map(frame));

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#030303", color: "#f7f8f8", padding: "64px 72px", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", width: 600 }}>
          <div style={{ display: "flex", alignItems: "center", fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>
            <div style={{ width: 22, height: 22, background: "#f7f8f8", borderRadius: 4, marginRight: 14 }} />
            ClipCore
          </div>
          <div style={{ fontSize: 66, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, marginTop: 40 }}>
            1 long video. 10 viral clips. Captions included.
          </div>
          <div style={{ fontSize: 28, color: "#8a8f98", marginTop: 28 }}>
            Paste a YouTube link. Get vertical clips for TikTok, Shorts, and Reels.
          </div>
          <div style={{ display: "flex", marginTop: 40, fontSize: 24, color: "#0a0a0a", background: "#ffffff", borderRadius: 999, padding: "12px 26px", alignSelf: "flex-start", fontWeight: 600 }}>
            useclipcore.com
          </div>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          {frames.map((src, i) => (
            <img key={i} src={src} width={150} height={267} style={{ borderRadius: 18, border: "2px solid rgba(255,255,255,0.15)", marginTop: i === 1 ? -60 : 40 }} alt="" />
          ))}
        </div>
      </div>
    ),
    size
  );
}
