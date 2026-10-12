import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { getSessionUser } from "@/lib/auth";
import SignOutButton from "@/components/auth/SignOutButton";

export default async function Navbar() {
  const user = await getSessionUser();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-divider bg-bg-page/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 sm:px-6 lg:px-8 h-14">
        <Link href="/" className="focus-ring rounded flex items-center gap-2">
          <LogoMark size={20} className="text-primary-text" title="ClipCore" />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">ClipCore</span>
        </Link>

        {user && (
          <div className="flex items-center gap-2 min-w-0">
            {user.image && (
              // Google avatar; a plain <img> avoids configuring remote image domains.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" width={28} height={28} referrerPolicy="no-referrer" className="h-7 w-7 rounded-full" />
            )}
            <span className="hidden sm:block truncate text-sm text-secondary-text max-w-[16rem]">{user.email}</span>
            <SignOutButton />
          </div>
        )}
      </div>
    </header>
  );
}
