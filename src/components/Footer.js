import Link from "next/link";
import config from "@/lib/config";
import { LogoMark } from "@/components/Logo";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-divider/40 bg-bg-page py-8 text-xs text-secondary-text mt-auto">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <LogoMark size={16} className="text-secondary-text" />
          <span>
            &copy; {currentYear} {config.appName}. All rights reserved.
          </span>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/pricing" className="hover:text-primary-text transition-colors">
            Pricing
          </Link>
          <Link href="/#how-it-works" className="hover:text-primary-text transition-colors">
            How it works
          </Link>
          <Link href="/terms" className="hover:text-primary-text transition-colors">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-primary-text transition-colors">
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
