import Link from "next/link";
import Brand from "@/components/site/Brand";

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06]">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 py-12 grid gap-10 sm:grid-cols-[1.5fr_1fr_1fr]">
        <div className="space-y-3">
          <Brand />
          <p className="text-sm text-secondary-text max-w-xs">
            Turn long videos into short, captioned clips for TikTok, YouTube Shorts, and Reels.
          </p>
        </div>
        <div className="space-y-3 text-sm">
          <p className="font-medium">Product</p>
          <ul className="space-y-2 text-secondary-text">
            <li><Link href="/#how-it-works" className="hover:text-primary-text">How it works</Link></li>
            <li><Link href="/#features" className="hover:text-primary-text">Features</Link></li>
            <li><Link href="/pricing" className="hover:text-primary-text">Pricing</Link></li>
          </ul>
        </div>
        <div className="space-y-3 text-sm">
          <p className="font-medium">Legal</p>
          <ul className="space-y-2 text-secondary-text">
            <li><Link href="/terms" className="hover:text-primary-text">Terms of Service</Link></li>
            <li><Link href="/privacy" className="hover:text-primary-text">Privacy Policy</Link></li>
          </ul>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-5 sm:px-6 pb-10 flex flex-col sm:flex-row gap-2 justify-between text-xs text-secondary-text">
        <p>© {new Date().getFullYear()} ClipCore</p>
        <p>
          Demo footage: <a href="https://mango.blender.org" className="underline hover:text-primary-text">Tears of Steel</a> © Blender Foundation, CC BY 3.0
        </p>
      </div>
    </footer>
  );
}
