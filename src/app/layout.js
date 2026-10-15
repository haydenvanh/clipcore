import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || "http://localhost:3000"),
  title: { default: "ClipCore — Turn long videos into viral clips", template: "%s · ClipCore" },
  description:
    "Paste a YouTube link. ClipCore finds the best moments and turns them into vertical clips with animated captions — ready for TikTok, Shorts, and Reels.",
  openGraph: { type: "website", siteName: "ClipCore" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} w-full`} data-theme="slate-indigo">
      <body className={`${inter.className} min-h-dvh w-full flex flex-col antialiased bg-bg-page text-primary-text font-sans`}>
        <Toaster position="top-right" toastOptions={{ style: { background: "#141417", color: "#f7f8f8", border: "1px solid #1f1f24" } }} />
        {children}
      </body>
    </html>
  );
}
