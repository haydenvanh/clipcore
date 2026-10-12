"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { FcGoogle } from "react-icons/fc";
import { FiLoader } from "react-icons/fi";

export default function SignInButton({ callbackUrl = "/dashboard" }) {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setPending(true);
        signIn("google", { callbackUrl });
      }}
      className="focus-ring w-full inline-flex items-center justify-center gap-3 rounded-lg bg-white px-6 py-3 text-sm font-medium text-neutral-900 hover:bg-neutral-100 transition-colors disabled:opacity-60 disabled:cursor-wait cursor-pointer"
    >
      {pending ? <FiLoader className="animate-spin" /> : <FcGoogle className="text-lg" />}
      Continue with Google
    </button>
  );
}
