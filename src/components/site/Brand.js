import Link from "next/link";
import { LogoMark } from "@/components/Logo";

export default function Brand({ href = "/" }) {
  return (
    <Link href={href} className="focus-ring rounded flex items-center gap-2 shrink-0">
      <LogoMark size={22} className="text-primary-text" title="ClipCore" />
      <span className="text-[16px] font-semibold tracking-[-0.01em]">ClipCore</span>
    </Link>
  );
}
