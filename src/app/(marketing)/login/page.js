import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LogoMark } from "@/components/Logo";
import SignInButton from "@/components/auth/SignInButton";

export const metadata = { title: "Sign in" };

/**
 * What went wrong, in words. next-auth sends these codes back as ?error=…
 * Google's own errors (redirect_uri_mismatch, invalid_client) are shown on
 * Google's page instead and never reach here.
 */
const ERRORS = {
  AccessDenied: "That Google account couldn't be used. Its email address must be verified with Google.",
  OAuthSignin: "Couldn't start sign-in with Google. Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
  OAuthCallback: "Google sign-in didn't complete. Please try again.",
  Callback: "Google sign-in didn't complete. Please try again.",
  Configuration: "Sign-in isn't configured on the server. Check NEXTAUTH_SECRET and NEXTAUTH_URL.",
};

/** Only same-site paths, so ?next= can't send someone to another website. */
function safeNext(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const next = safeNext(params?.next ?? params?.callbackUrl);

  if (await getSessionUser()) redirect(next);

  const error = params?.error ? ERRORS[params.error] ?? "Sign-in failed. Please try again." : null;

  return (
    <div className="flex-1 flex items-center justify-center px-5 py-24">
      <div className="panel w-full max-w-sm p-8 space-y-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <LogoMark size={36} className="text-primary-text" title="ClipCore" />
          <h1 className="text-xl font-semibold tracking-tight">Sign in to ClipCore</h1>
          <p className="text-sm text-secondary-text">
            Turn long videos into captioned vertical clips.
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 text-left">
            {error}
          </p>
        )}

        <SignInButton callbackUrl={next} />
      </div>
    </div>
  );
}
