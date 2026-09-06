import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Navbar from "../components/Navbar";
import config from "@/lib/config";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata = {
  title: {
    default: `${config.appName} — ${config.appTagline}`,
    template: `%s · ${config.appName}`,
  },
  description: config.appDescription,
};

export default function RootLayout({ children }) {
  const theme = config?.theme || "slate-indigo";

  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable} w-full scroll-smooth`} data-theme={theme}>
      <body className={`${inter.className} min-h-dvh w-full flex flex-col antialiased bg-bg-page text-primary-text font-sans`}>
        <Providers>
          <Navbar />
          <div className="flex-1 flex flex-col min-h-0">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}

