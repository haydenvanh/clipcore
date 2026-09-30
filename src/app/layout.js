import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import Navbar from "@/components/Navbar";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata = {
  title: { default: "ClipCore", template: "%s · ClipCore" },
  description: "Turn a YouTube video into captioned vertical clips.",
  // Private tool: keep it out of search indexes if it is ever exposed.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} w-full`} data-theme="slate-indigo">
      <body className={`${inter.className} min-h-dvh w-full flex flex-col antialiased bg-bg-page text-primary-text font-sans`}>
        <Toaster position="top-right" />
        <Navbar />
        <main className="flex-1 flex flex-col min-h-0">{children}</main>
      </body>
    </html>
  );
}
