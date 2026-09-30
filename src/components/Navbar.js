import Link from "next/link";
import { LogoMark } from "@/components/Logo";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-divider bg-bg-page/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center px-5 sm:px-6 lg:px-8 h-14">
        <Link href="/" className="focus-ring rounded flex items-center gap-2">
          <LogoMark size={20} className="text-primary-text" title="ClipCore" />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">ClipCore</span>
        </Link>
      </div>
    </header>
  );
}
