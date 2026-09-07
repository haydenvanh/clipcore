"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { name: "Studio", href: "/dashboard" },
  { name: "My clips", href: "/gallery" },
  { name: "Connections", href: "/dashboard/connections" },
  { name: "Billing", href: "/dashboard/billing" },
];

export default function DashboardNav() {
  const pathname = usePathname();

  return (
    <div className="border-b border-divider/50">
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-1 overflow-x-auto">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-3.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-secondary-text hover:text-primary-text"
              }`}
            >
              {tab.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
