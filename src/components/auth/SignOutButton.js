"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="focus-ring rounded-lg px-3 py-1.5 text-sm text-secondary-text hover:text-primary-text hover:bg-bg-card transition-colors cursor-pointer"
    >
      Sign out
    </button>
  );
}
