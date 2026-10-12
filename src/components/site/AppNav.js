import Link from "next/link";
import Brand from "@/components/site/Brand";
import SignOutButton from "@/components/auth/SignOutButton";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PLANS } from "@/lib/plans";

export default async function AppNav() {
  const session = await getSessionUser();
  const user = session
    ? await prisma.user.findUnique({ where: { id: session.id }, select: { email: true, image: true, plan: true } })
    : null;
  const plan = PLANS[user?.plan] ?? PLANS.FREE;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-bg-page/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5 sm:px-6">
        <div className="flex items-center gap-8 min-w-0">
          <Brand href="/dashboard" />
          <nav className="flex items-center gap-1">
            <Link href="/dashboard" className="focus-ring rounded-lg px-3 py-1.5 text-sm text-secondary-text hover:text-primary-text hover:bg-bg-card transition-colors">
              Videos
            </Link>
            <Link href="/billing" className="focus-ring rounded-lg px-3 py-1.5 text-sm text-secondary-text hover:text-primary-text hover:bg-bg-card transition-colors">
              Billing
            </Link>
          </nav>
        </div>

        {user && (
          <div className="flex items-center gap-2 min-w-0">
            {plan.id === "FREE" ? (
              <Link href="/pricing" className="btn btn-primary focus-ring px-3.5 py-1.5 text-xs">
                Upgrade
              </Link>
            ) : (
              <span className="rounded-full border border-divider px-2.5 py-1 text-xs font-medium text-primary-text">{plan.name}</span>
            )}
            {user.image && (
              // Google avatar; a plain <img> avoids configuring remote image domains.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" width={28} height={28} referrerPolicy="no-referrer" className="h-7 w-7 rounded-full" />
            )}
            <span className="hidden lg:block truncate text-sm text-secondary-text max-w-[14rem]">{user.email}</span>
            <SignOutButton />
          </div>
        )}
      </div>
    </header>
  );
}
