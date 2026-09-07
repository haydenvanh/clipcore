"use client";

import { signIn, useSession } from "next-auth/react";
import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FaGoogle, FaInfoCircle } from "react-icons/fa";
import config from "@/lib/config";

function LoginContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("callbackUrl") || searchParams.get("next") || "/";

  useEffect(() => {
    if (status === "authenticated") {
      router.push(next);
    }
  }, [status, router, next]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-bg-page px-6 text-primary-text select-none">
      <div className="relative bg-bg-card border border-divider w-full max-w-md rounded-lg p-8 space-y-8 shadow-2xl animate-scale-up">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-2xl text-white font-black shadow-md shadow-primary/25">
            {config.appName.charAt(0)}
          </div>
          <h2 className="text-2xl font-black tracking-tight">Sign in to {config.appName}</h2>
          <p className="text-xs font-semibold text-secondary-text leading-relaxed px-4">
            You get 10 free credits — enough to clip a ten-minute video. No card required.
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => signIn("google", { callbackUrl: next })}
            className="w-full py-3.5 bg-white text-neutral-900 rounded-full text-xs font-bold flex items-center justify-center gap-3 hover:opacity-90 transition-all shadow-md active:scale-[0.98] cursor-pointer"
          >
            <FaGoogle className="text-sm text-red-500" />
            <span>Continue with Google</span>
          </button>
        </div>

        <div className="flex items-start gap-2.5 bg-primary/5 border border-primary/10 p-3.5 rounded text-[11px] leading-relaxed text-secondary-text">
          <FaInfoCircle className="text-primary text-xs shrink-0 mt-0.5" />
          <span>
            By signing in you agree to our{" "}
            <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link> and{" "}
            <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
            Payments are handled by Stripe — we never see your card details.
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={
      <div className="min-h-dvh flex items-center justify-center bg-bg-page text-primary-text">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
