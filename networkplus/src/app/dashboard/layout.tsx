import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth() as any;
  
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { hasCompletedOnboarding: true },
  });

  if (user && !user.hasCompletedOnboarding) {
    redirect("/onboarding");
  }

  return <>{children}</>;
}
