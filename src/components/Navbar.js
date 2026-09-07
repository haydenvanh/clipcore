"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { IoClose, IoMenu } from "react-icons/io5";
import { FiLogOut, FiChevronDown, FiUser } from "react-icons/fi";
import config from "@/lib/config";
import { LogoMark } from "@/components/Logo";
import StatusChip from "@/components/landing/StatusChip";
import { PRIMARY_NAV } from "@/lib/content/nav";

/**
 * Marketing navigation with hover menus.
 *
 * The menus open on hover and on focus, and every item is a real link — a menu
 * that only responds to a mouse is unusable by keyboard, and one built from
 * buttons is unusable by anyone who wants to open a page in a new tab.
 */
function DesktopMenu({ item }) {
  const [open, setOpen] = useState(false);

  if (!item.menu) {
    return (
      <Link
        href={item.href}
        className="focus-ring rounded px-3 py-2 text-[13px] text-secondary-text hover:text-primary-text transition-colors"
      >
        {item.label}
      </Link>
    );
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <Link
        href={item.href}
        aria-expanded={open}
        className="focus-ring inline-flex items-center gap-1 rounded px-3 py-2 text-[13px] text-secondary-text hover:text-primary-text transition-colors"
      >
        {item.label}
        <FiChevronDown
          className={`text-[11px] transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </Link>

      {open && (
        <div className="absolute left-0 top-full pt-2 w-[420px]">
          <div className="panel p-2 shadow-xl grid grid-cols-2 gap-px">
            {item.menu.map((entry) => (
              <Link
                key={entry.href}
                href={entry.href}
                className="focus-ring rounded-lg px-3 py-2.5 hover:bg-bg-card-hover transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-primary-text">{entry.label}</span>
                  {entry.status && entry.status !== "shipped" && (
                    <StatusChip status={entry.status} />
                  )}
                </span>
                {entry.description && (
                  <span className="block text-[11px] text-secondary-text mt-0.5 leading-snug">
                    {entry.description}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const appName = config?.appName || "ClipCore";
  const inApp = pathname?.startsWith("/dashboard") || pathname?.startsWith("/gallery");

  return (
    <header className="sticky top-0 z-50 w-full border-b border-divider bg-bg-page/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 sm:px-6 lg:px-8 h-14">
        <Link href="/" className="focus-ring rounded flex items-center gap-2 shrink-0">
          <LogoMark size={20} className="text-primary-text" title={appName} />
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-primary-text">
            {appName}
          </span>
        </Link>

        {!inApp && (
          <nav className="hidden md:flex items-center gap-0.5" aria-label="Main">
            {PRIMARY_NAV.map((item) => (
              <DesktopMenu key={item.label} item={item} />
            ))}
          </nav>
        )}

        <div className="ml-auto hidden md:flex items-center gap-2">
          {status === "authenticated" ? (
            <>
              <Link
                href="/dashboard"
                className="focus-ring rounded px-3 py-2 text-[13px] text-secondary-text hover:text-primary-text transition-colors"
              >
                Studio
              </Link>
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  onBlur={() => setTimeout(() => setProfileOpen(false), 150)}
                  aria-label="Account menu"
                  aria-expanded={profileOpen}
                  className="focus-ring h-8 w-8 rounded-full border border-divider bg-bg-card flex items-center justify-center hover:bg-bg-card-hover transition-colors cursor-pointer overflow-hidden"
                >
                  {session.user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={session.user.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <FiUser className="text-secondary-text text-sm" />
                  )}
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-10 w-56 panel p-1 shadow-xl z-50">
                    <div className="px-3 py-2 text-xs text-secondary-text truncate border-b border-divider mb-1">
                      {session.user.email}
                    </div>
                    {[
                      { label: "Studio", href: "/dashboard" },
                      { label: "My clips", href: "/gallery" },
                      { label: "Billing", href: "/dashboard/billing" },
                      { label: "Connections", href: "/dashboard/connections" },
                    ].map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="block rounded px-3 py-2 text-[13px] text-primary-text hover:bg-bg-card-hover transition-colors"
                      >
                        {link.label}
                      </Link>
                    ))}
                    <button
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="mt-1 flex w-full items-center gap-2 rounded px-3 py-2 text-left text-[13px] text-secondary-text hover:bg-bg-card-hover hover:text-primary-text transition-colors cursor-pointer"
                    >
                      <FiLogOut className="text-xs" /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="focus-ring rounded px-3 py-2 text-[13px] text-secondary-text hover:text-primary-text transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/dashboard"
                className="focus-ring rounded-lg bg-primary hover:bg-primary-hover px-4 py-2 text-[13px] font-medium text-white transition-colors"
              >
                Start free
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
          aria-expanded={isOpen}
          className="focus-ring ml-auto md:hidden rounded p-2 text-primary-text cursor-pointer"
        >
          {isOpen ? <IoClose size={20} /> : <IoMenu size={20} />}
        </button>
      </div>

      {isOpen && (
        <div className="md:hidden border-t border-divider bg-bg-page px-5 py-4">
          <nav className="flex flex-col gap-0.5" aria-label="Mobile">
            {PRIMARY_NAV.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className="rounded px-3 py-2.5 text-sm text-primary-text hover:bg-bg-card transition-colors"
              >
                {item.label}
              </Link>
            ))}

            <div className="h-px bg-divider my-3" />

            {status === "authenticated" ? (
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded px-3 py-2.5 text-left text-sm text-secondary-text hover:bg-bg-card transition-colors cursor-pointer"
              >
                Sign out
              </button>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setIsOpen(false)}
                  className="rounded px-3 py-2.5 text-sm text-primary-text hover:bg-bg-card transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/dashboard"
                  onClick={() => setIsOpen(false)}
                  className="mt-1 rounded-lg bg-primary px-3 py-2.5 text-center text-sm font-medium text-white"
                >
                  Start free
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
