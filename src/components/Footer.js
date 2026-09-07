import Link from "next/link";
import config from "@/lib/config";
import { LogoMark } from "@/components/Logo";
import { FOOTER_SECTIONS } from "@/lib/content/nav";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-divider bg-bg-page mt-auto">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="focus-ring rounded inline-flex items-center gap-2">
              <LogoMark size={18} className="text-primary-text" title={config.appName} />
              <span className="text-[14px] font-semibold text-primary-text">{config.appName}</span>
            </Link>
            <p className="mt-3 text-[12px] text-secondary-text leading-relaxed max-w-[200px]">
              {config.appTagline}
            </p>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <nav key={section.title} aria-label={section.title}>
              <h2 className="text-[12px] font-medium text-primary-text">{section.title}</h2>
              <ul className="mt-3 space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="focus-ring rounded text-[12px] text-secondary-text hover:text-primary-text transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-divider flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[12px] text-secondary-text">
            © {year} {config.appName}. All rights reserved.
          </p>
          <p className="text-[12px] text-secondary-text">Upload once. Grow everywhere.</p>
        </div>
      </div>
    </footer>
  );
}
