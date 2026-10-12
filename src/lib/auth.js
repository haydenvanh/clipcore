import { cache } from "react";
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

/**
 * Sign-in with Google.
 *
 * Sessions are stateless: an encrypted, signed cookie (NEXTAUTH_SECRET) that
 * carries the user's id. That needs no Account or Session tables and no
 * database adapter — each Google account maps to one User row by its verified
 * email, upserted on sign-in.
 *
 * Google sends the browser back to `${NEXTAUTH_URL}/api/auth/callback/google`.
 * That exact URL must be listed under "Authorized redirect URIs" on the OAuth
 * client in Google Cloud, or Google answers with redirect_uri_mismatch.
 */
export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],

  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/login", error: "/login" },

  callbacks: {
    /** Only Google accounts whose email address Google has verified. */
    async signIn({ account, profile }) {
      return account?.provider === "google" && Boolean(profile?.email) && profile.email_verified === true;
    },

    /** On sign-in, find or create the user and remember their id in the cookie. */
    async jwt({ token, account, profile }) {
      if (account && profile?.email) {
        const email = profile.email.toLowerCase();
        const user = await prisma.user.upsert({
          where: { email },
          create: { email, name: profile.name ?? null, image: profile.picture ?? null },
          update: { name: profile.name ?? null, image: profile.picture ?? null },
          select: { id: true },
        });
        token.uid = user.id;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user && token.uid) session.user.id = token.uid;
      return session;
    },
  },
};

/**
 * The signed-in user, or null.
 *
 * Re-reads the row rather than trusting the cookie alone, so a deleted account
 * stops working immediately instead of when its cookie expires. Memoised per
 * request, so a page and the components inside it share one lookup.
 */
export const getSessionUser = cache(async () => {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  if (!id) return null;
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, image: true },
  });
});
