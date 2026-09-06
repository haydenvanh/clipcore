import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "./prisma";
import { CreditService } from "./services/credits";

/** Credits handed to a new account so they can try the product immediately. */
export const SIGNUP_BONUS_CREDITS = 10;

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],

  // Database session strategy (the adapter default). Kept deliberately: it is
  // working, and switching to JWT is only required once a credentials provider
  // is added, which is gated behind real signup data (docs/ROADMAP.md item 17).
  session: { strategy: "database" },

  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = user.role;
        // Present for first paint only. The live balance comes from /api/me,
        // because a session value goes stale the moment a job runs.
        session.user.credits = user.credits;
      }
      return session;
    },
  },

  events: {
    /**
     * Grant the signup bonus as a ledger entry rather than a column default.
     *
     * User.credits defaults to 0: if the column granted the bonus silently,
     * every account would sit permanently 10 credits out of sync with the
     * ledger and nightly reconciliation would flag all of them.
     */
    async createUser({ user }) {
      try {
        await CreditService.grant(user.id, SIGNUP_BONUS_CREDITS, {
          type: "GRANT",
          refType: "signup",
          refId: user.id,
          idempotencyKey: `signup:${user.id}`,
          description: "Welcome credits",
        });
        await prisma.event.create({
          data: { userId: user.id, type: "signup", payload: { provider: "google" } },
        });
      } catch (error) {
        // Never block sign-in on bookkeeping.
        console.error("[AUTH] Failed to grant signup credits", error);
      }
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/login" },
};
