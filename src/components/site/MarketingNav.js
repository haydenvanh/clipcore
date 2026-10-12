import Link from "next/link";
import Brand from "@/components/site/Brand";
import { getSessionUser } from "@/lib/auth";

const LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
];

export default async function MarketingNav() {
  const user = await getSessionUser();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-bg-page/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 sm:px-6">
        <div className="flex items-center gap-10">
          <Brand />
          <nav className="hidden md:flex items-center gap-7">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="focus-ring rounded text-sm text-secondary-text hover:text-primary-text transition-colors">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <Link href="/dashboard" className="btn btn-primary focus-ring px-4 py-2 text-sm">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="focus-ring rounded px-2 py-2 text-sm text-secondary-text hover:text-primary-text transition-colors">
                Sign in
              </Link>
              <Link href="/login?next=/dashboard" className="btn btn-primary focus-ring px-4 py-2 text-sm">
                Sign up — it&apos;s free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
