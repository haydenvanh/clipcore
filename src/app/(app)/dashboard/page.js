import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUsage } from "@/lib/usage";
import UsageMeter from "@/components/billing/UsageMeter";
import Studio from "@/components/dashboard/Studio";

export const metadata = { title: "Videos" };

export default async function DashboardPage({ searchParams }) {
  const session = await getSessionUser();
  if (!session) redirect("/login?next=/dashboard");

  const { url } = await searchParams;
  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { id: true, plan: true, name: true } });
  const usage = await getUsage(prisma, user);
  const firstName = user.name?.split(" ")[0];

  return (
    <div className="max-w-3xl mx-auto w-full px-5 sm:px-6 py-10 space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{firstName ? `Welcome back, ${firstName}` : "Your videos"}</h1>
        <p className="text-sm text-secondary-text">Paste a link and ClipCore does the rest.</p>
      </div>
      <UsageMeter usage={usage} compact />
      <Studio initialUrl={typeof url === "string" ? url : undefined} />
    </div>
  );
}
